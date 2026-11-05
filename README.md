# Nodo Vida 1.0

Interfaz privada sobre la base canónica compartida de Nodo. Conserva identidad, temas, navegación y PWA del proyecto anterior. Sustituye todas sus funciones de negocio: no contiene Prisma, seed, coaches, Schwab, colas offline ni planificadores legados.

## Arquitectura
React/Vite → Express con sesión HttpOnly y validación de origen → puente Python de operaciones acotadas → clases Memory/Inbox/Health/Finance existentes → SQLite canónica. No expone SQL ni shell desde el navegador. Importes en centavos; correcciones con versión; escrituras con ID estable para reintentos.

## Desarrollo
`npm ci`; configurar AUTH_FILE (JSON privado con hash bcrypt existente, nombre y secreto de sesión), NODO_DB (base de pruebas) y CANONICAL_MODULE_DIR (clases canónicas); `npm run build`; ejecutar desde server `node dist/index.js`. Nunca usar una base real para pruebas de escritura. El servidor escucha 4000; Vite 5173.

## Producción
Dockerfile sin migraciones ni seed. Usuario 996:986 debe coincidir con jarvis-memory en el host. Montar `/opt/jarvis-memory:/canonical:ro`, `/var/lib/jarvis-memory:/data` y `/etc/nodo-vida/auth.json:/run/nodo-auth.json:ro`. Env: NODO_DB=/data/context.sqlite3, CANONICAL_MODULE_DIR=/canonical, APP_ORIGIN=https://dominio, NODE_ENV=production. HTTPS obligatorio antes de login. Auth y archivos de datos nunca se versionan.

## Límites
La agenda muestra seguimientos documentales, no sincroniza Google Calendar. No activa push ni duplica automatizaciones. Los registros sin conexión no se dan por guardados. La memoria admite propuestas para revisión, no sustitución silenciosa. La web no ejecuta operaciones bancarias. Calorías desconocidas se mantienen desconocidas.

## Comprobaciones
`npm run build`; `npx tsc -p client/tsconfig.json --noEmit`; `CANONICAL_MODULE_DIR=... python3 -m unittest discover -s server -p test_bridge.py -v`. Pruebas HTTP y visuales se documentan en el expediente de implementación.
