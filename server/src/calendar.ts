import ical, { type VEvent } from "node-ical";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const DAY = 86400000;
export const localDate = (d: Date, tz = "America/Mexico_City") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const plain = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "object" && value !== null && "val" in value
      ? String((value as { val: unknown }).val)
      : "";
export async function parseCalendar(raw: string, now = new Date()) {
  if (!raw.includes("BEGIN:VCALENDAR") || !raw.includes("END:VCALENDAR"))
    throw Error("Formato de calendario inválido");
  const parsed = await ical.async.parseICS(raw),
    from = new Date(`${localDate(now)}T00:00:00-06:00`);
  from.setTime(from.getTime() - 7 * DAY);
  const to = new Date(from.getTime() + 68 * DAY);
  const events = [];
  for (const component of Object.values(parsed)) {
    if (component?.type !== "VEVENT") continue;
    const item = component as VEvent;
    if (String(item.status).toUpperCase() === "CANCELLED" || item.recurrenceid)
      continue;
    if (item.rrule && /FREQ=(SECONDLY|MINUTELY)/.test(item.rrule.toString()))
      throw Error("Recurrencia demasiado frecuente");
    for (const instance of ical.expandRecurringEvent(item, {
      from,
      to,
      expandOngoing: true,
    })) {
      if (String(instance.event.status).toUpperCase() === "CANCELLED") continue;
      const title = plain(instance.summary).slice(0, 500) || "Sin título";
      const routine = [
        "46778sfjmv3j50j0ie9n4jls7s",
        "cfgqde4c7gpchif9knj4cf30vc",
      ].some(
        (id) =>
          String(item.uid).startsWith(id + "@") || String(item.uid) === id,
      );
      const category =
        /prueba.*(aviso|notifica|nodo)|test.*(aviso|notifica)/i.test(title)
          ? "test"
          : routine
            ? "reminder"
            : instance.isFullDay &&
                /aniversario|cumpleaños|festivo|natalicio/i.test(title)
              ? "observance"
              : "meeting";
      const start = instance.isFullDay
        ? localDate(instance.start, instance.start.tz || "UTC")
        : instance.start.toISOString();
      const end = instance.isFullDay
        ? localDate(instance.end, instance.end.tz || instance.start.tz || "UTC")
        : instance.end.toISOString();
      if (end <= start) continue;
      events.push({
        id: `${item.uid}|${start}`.slice(0, 500),
        title,
        start,
        end,
        all_day: instance.isFullDay,
        category,
        location: plain(instance.event.location).slice(0, 500),
      });
      if (events.length > 2000) throw Error("Demasiadas citas en la ventana");
    }
  }
  return { events, window_start: localDate(from), window_end: localDate(to) };
}
function persist(params: unknown) {
  return new Promise<void>((ok, no) => {
    const c = spawn("python3", [resolve("calendar_store.py")], {
      stdio: ["pipe", "pipe", "ignore"],
      env: process.env,
    });
    let output = "";
    const timer = setTimeout(() => {
      c.kill();
      no(Error("Base no disponible"));
    }, 15000);
    c.stdout.on("data", (x) => (output += String(x)));
    c.on("error", () => {
      clearTimeout(timer);
      no(Error("Base no disponible"));
    });
    c.on("close", () => {
      clearTimeout(timer);
      try {
        const r = JSON.parse(output);
        if (r.stored) ok();
        else no(Error("No se pudo actualizar la agenda"));
      } catch {
        no(Error("No se pudo actualizar la agenda"));
      }
    });
    c.stdin.end(JSON.stringify(params));
  });
}
export async function syncCalendar() {
  let config: { feeds: { id: string; name: string; url: string }[] };
  try {
    config = JSON.parse(
      readFileSync(
        process.env.CALENDAR_FILE || "/run/nodo-calendar.json",
        "utf8",
      ),
    );
  } catch {
    return;
  }
  for (const feed of config.feeds) {
    if (feed.id !== "primary") continue;
    const observed_at = new Date().toISOString();
    try {
      const u = new URL(feed.url);
      if (
        u.origin !== "https://calendar.google.com" ||
        u.username ||
        u.password ||
        !u.pathname.startsWith("/calendar/ical/") ||
        !u.pathname.includes("/private-")
      )
        throw Error("Destino inválido");
      const res = await fetch(feed.url, {
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok || !res.body) throw Error("Google no respondió");
      const reader = res.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 4 * 1024 * 1024) {
          await reader.cancel();
          throw Error("Calendario demasiado grande");
        }
        chunks.push(value);
      }
      const parsed = await parseCalendar(
        Buffer.concat(chunks).toString("utf8"),
      );
      await persist({
        source_id: feed.id,
        name: feed.name,
        observed_at,
        ...parsed,
      });
    } catch {
      // Never log or return the bearer feed URL or upstream response body.
      await persist({
        source_id: feed.id,
        name: feed.name,
        observed_at,
        events: [],
        window_start: null,
        window_end: null,
        error:
          "No se pudo actualizar desde Google. Se conserva la última copia; revisa Google Calendar.",
      }).catch(() => {});
    }
  }
}
export function startCalendarSync() {
  if (process.env.DISABLE_CALENDAR_SYNC === "1") return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await syncCalendar();
    } finally {
      busy = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 5 * 60 * 1000);
  timer.unref();
}
