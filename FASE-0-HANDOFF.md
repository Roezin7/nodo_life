# Nodo Vida — Handoff de Fase 0 (inspección + reconciliación)

> Léeme **antes** que el `PROMPT_Maestro_Nodo_Vida.md`. Aquí está la decisión ya tomada
> tras inspeccionar el repo real de Nodo. Esto evita re-hacer el análisis.

## Qué es "Nodo" en realidad (fuente de verdad = su repo)

El repo hermano se llama **Sistema Ibérico** y vive en:

```
/Users/arturohernandez/Desktop/Ibérico/Sistema Iberico
```

Es un back-office **multi-negocio** (multi-tenant) para bar/restaurante, con branding visual "NODO".
Para construir Nodo Vida, **lee ese repo como fuente de verdad** (el código gana sobre cualquier spec).

### Stack real a replicar
- **Cliente:** React 18 + Vite 6 + `vite-plugin-pwa` + react-router v6, `idb` (cola offline),
  **CSS plano con tokens** (`styles.css`) — sin Tailwind, sin librería de componentes. Tema claro/oscuro.
- **Servidor:** Express 4 + **Prisma** (Postgres) + `@anthropic-ai/sdk` + JWT + bcrypt + **zod** +
  helmet/cors/compression/express-rate-limit. **ESM puro** (imports con `.js`). `tsx` en dev, `tsc` build.
- **Estructura:** monorepo **npm workspaces** (`server` + `client`). Single-service: el server sirve
  la PWA compilada + la API. Deploy en Render (`render.yaml`) + `Dockerfile`, healthcheck `/api/health`.
- **Modelo IA = propone-confirma** (la IA nunca escribe directo en datos de dominio).

## Decisiones de Fase 0 (ya acordadas con el usuario)

1. **Repo separado** (este). No es monorepo con Ibérico.
2. **Design system = copia inicial, luego diverge.** Ya está copiado en `design-system/`
   (`styles.css`, `theme.ts`, `icons.tsx`, `brand/`). NO se mantiene sincronizado automáticamente:
   adáptalo libremente a Nodo Vida. Nota: `styles.css` trae acentos de marca Ibérico (vino `#6e1423`)
   y el wordmark "NODO"; los tokens base (neutros, radios, sombras, tipografía, tema) son genéricos y
   se quedan; cambia solo el acento de marca si quieres.
3. **Usuario único, sin multi-tenant ni roles.** Simplificar el auth de Ibérico:
   - Quitar `negocio_id` y `rol` del JWT y del middleware.
   - Una sola fila `usuario(id, nombre, pin_hash)`; login = solo PIN (sin pantalla de selección de usuario).
   - Reutilizables casi tal cual: `auth/jwt.ts`, `auth/middleware.ts` (solo `requireAuth`),
     `client/src/api.ts`, `client/src/auth.tsx`, `client/src/offline.ts` (renombrar `TOKEN_KEY`/`DB_NAME`).

## Mapa de reutilización (Ibérico → Nodo Vida)

| Pieza de Ibérico | Acción | Nota |
|---|---|---|
| `client/src/api.ts` (HTTP + encolado offline) | Copiar directo | renombrar `iberico_token` |
| `client/src/offline.ts` (cola IndexedDB + sync FIFO) | Copiar directo | renombrar `iberico-offline` |
| `server/src/auth/*`, `client/src/auth.tsx` | Adaptar | quitar negocio/rol → usuario único |
| `server/src/silvia/agent.ts` (loop de tools + tabla de memoria) | Adaptar | base de la "Silvia personal"; nuevo system prompt + contexto |
| `server/src/inventario/draft.ts` (`tool_choice` forzado → borrador editable, NO escribe) | Patrón clave | ESTE es el "captura asistida": "gasté 500 en súper" → borrador → confirmar |
| `server/src/middleware/error.ts`, `lib/bigint.ts`, `env.ts`, `db.ts`, `index.ts` | Copiar directo | infraestructura + endurecimiento de prod (CSP/CORS/rate-limit/SPA fallback) |
| Convención `routes/service/logic + *.test.ts` (vitest) | Replicar | mantener el split por módulo |
| Tokens CSS + `theme.ts` + `icons.tsx` + `brand/` | Ya copiado en `design-system/` | adaptar a gusto |
| **Finanzas de Ibérico** (semanas, arqueo, cierres, comisión 1.99%) | **NO usar** | Nodo Vida = finanzas personales SIN cuadre/arqueo. Heredar solo el patrón (Decimal, zod, service/logic) |
| **Schema multi-tenant** (`negocio_id` en todo, `RolUsuario`) | **NO usar** | Reescribir el schema con `area_id` como eje (ver prompt §2–3) |

## Tres ajustes respecto al prompt maestro

1. **Auth:** el prompt ya pide usuario único — coincide; es una *simplificación* del código de Ibérico.
2. **"Motor de snapshots → tendencias":** en Ibérico NO existe como motor genérico. `snapshots_patrimonio`
   tiene **columnas fijas** de bar (banco/efectivo/inventario/pasivos). Construye la versión **genérica**
   con `desglose_json` que el prompt ya especifica (sirve para patrimonio, peso, hábitos, objetivos).
3. **Silvia personal:** además de conversar (patrón de `agent.ts`) debe **capturar** (patrón de `draft.ts`).
   Fusiona ambos: propone borrador → el usuario confirma → el código escribe. Nunca escribe directo.

## Orden de construcción
Sigue las fases del prompt maestro (§6). La Fase 0 (esta) ya está hecha: stack entendido,
design system copiado, decisiones de auth/repo tomadas.
