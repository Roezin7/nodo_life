import { pushRoutes,pushReceiptRoute,startPushSender } from "./push.js";
import { startCalendarSync } from "./calendar.js";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const config = JSON.parse(
  readFileSync(process.env.AUTH_FILE || "/run/nodo-auth.json", "utf8"),
) as { pin_hash: string; nombre: string; secret: string };
if (!config.secret || config.secret.length < 32 || !config.pin_hash)
  throw new Error("Configuración de acceso ausente");
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "30kb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", version: "1.3.0" }),
);
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const allowed = process.env.APP_ORIGIN;
    if (
      !origin ||
      (origin !== allowed &&
        !(
          process.env.NODE_ENV !== "production" &&
          [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4000",
          ].includes(origin)
        ))
    ) {
      res.status(403).json({ error: "Origen no autorizado" });
      return;
    }
  }
  next();
});
const cookie = "nodo_vida_session";
app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera 15 minutos." },
  }),
  async (req, res) => {
    const pin = req.body?.pin;
    if (
      typeof pin !== "string" ||
      !/^\d{3,12}$/.test(pin) ||
      !(await bcrypt.compare(pin, config.pin_hash))
    ) {
      res.status(401).json({ error: "PIN incorrecto" });
      return;
    }
    const token = jwt.sign({ sub: "arturo" }, config.secret, {
      expiresIn: "7d",
      issuer: "nodo-vida",
      audience: "nodo-vida",
    });
    res.cookie(cookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 86400000,
      path: "/",
    });
    res.json({ usuario: { id: 1, nombre: config.nombre } });
  },
);
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(cookie, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ ok: true });
});
pushReceiptRoute(app);
app.use("/api", (req, res, next) => {
  try {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookie + "="))
      ?.slice(cookie.length + 1);
    if (!token) throw Error();
    jwt.verify(decodeURIComponent(token), config.secret, {
      issuer: "nodo-vida",
      audience: "nodo-vida",
      algorithms: ["HS256"],
    });
    next();
  } catch {
    res.status(401).json({ error: "Inicia sesión para consultar Nodo." });
  }
});
app.get("/api/auth/me", (_req, res) =>
  res.json({ id: 1, nombre: config.nombre }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
pushRoutes(app);
const reads = new Set([
  "overview",
  "notifications",
  "agenda",
  "tasks",
  "health",
  "health.trend",
  "finance",
  "memory",
  "system",
]);
const writes = new Set([
  "notification.ack",
  "task.capture",
  "task.update",
  "health.capture",
  "health.correct",
  "finance.capture",
  "finance.correct",
  "memory.propose",
]);
app.post("/api/query", (req, res) => {
  const { op, params = {} } = req.body || {};
  if (!reads.has(op) && !writes.has(op)) {
    res.status(400).json({ error: "Operación no admitida" });
    return;
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }
  const child = spawn(
    process.env.PYTHON || "python3",
    [resolve("web_bridge.py")],
    { stdio: ["pipe", "pipe", "ignore"], env: process.env },
  );
  let output = "";
  let ended = false;
  const finish = (status: number, data: unknown) => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    res.status(status).json(data);
  };
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    finish(504, {
      error: "La base tardó demasiado. Puedes reintentar la misma solicitud.",
    });
  }, 15000);
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > 2000000) {
      child.kill();
      finish(502, { error: "Respuesta demasiado grande" });
    }
  });
  child.on("error", () =>
    finish(503, { error: "Base temporalmente no disponible" }),
  );
  child.on("close", () => {
    try {
      const result = JSON.parse(output);
      if (result.ok) finish(200, result.data);
      else
        finish(result.error.includes("versión") ? 409 : 400, {
          error: result.error,
        });
    } catch {
      finish(503, { error: "Base temporalmente no disponible" });
    }
  });
  child.stdin.end(JSON.stringify({ op, params }));
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Ruta no disponible" }),
);
app.use(express.static(resolve("public"), { index: false, maxAge: "1h", setHeaders(res,path){ if(/(?:sw\.js|registerSW\.js|push-sw\.js|index\.html|manifest\.webmanifest)$/.test(path))res.setHeader("Cache-Control","no-cache"); } }));
app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(resolve("public/index.html"));
});
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(400).json({ error: "Solicitud inválida" });
  },
);
app.listen(Number(process.env.PORT || 4000), "0.0.0.0", () => {
  console.log("Nodo Vida 1.3 listo");
  startCalendarSync();
  startPushSender();
});
