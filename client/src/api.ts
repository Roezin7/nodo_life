// Cliente HTTP mínimo para la API. La sesión vive en una cookie HttpOnly.
// Limpia tokens de versiones anteriores que pudieran seguir en el navegador.
try { localStorage.removeItem('nodo_vida_token'); } catch { /* ignore */ }

export function getToken(): string | null {
  return null;
}
export function setToken(_token: string | null) { /* compatibilidad con versiones anteriores */ }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// --- Bus de mutaciones: cualquier escritura exitosa avisa para que TODAS las
//     vistas cargadas (useCargar) se refresquen al instante, sin cablear cada una. ---
const mutacionListeners = new Set<() => void>();
export function onMutacion(fn: () => void): () => void {
  mutacionListeners.add(fn);
  return () => { mutacionListeners.delete(fn); };
}
export function notificarMutacion() {
  for (const l of mutacionListeners) l();
}

/** Resultado sintético cuando una mutación se encola offline. */
export interface Encolado { queued: true }
export const fueEncolado = (r: unknown): r is Encolado =>
  typeof r === 'object' && r !== null && (r as Encolado).queued === true;

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const esMutacion = method !== 'GET' && method !== 'HEAD';
  const idempotencyKey = esMutacion && auth ? crypto.randomUUID() : null;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Nunca encolar login ni ninguna mutación explícitamente anónima:
    // evita guardar credenciales o repetir operaciones públicas.
    if (esMutacion && auth && idempotencyKey) {
      const { encolar } = await import('./offline');
      await encolar({ method, path, body, token: null, idempotencyKey });
      return { queued: true } as T;
    }
    throw new ApiError(0, 'Sin conexión');
  }

  if (res.status === 204) {
    if (esMutacion) notificarMutacion();
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null); // token inválido -> forzar re-login
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Error de red');
  }
  if (esMutacion) notificarMutacion();
  return data as T;
}

/** Formatea un número como pesos mexicanos. */
export function mxn(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
}

/** Formatea una fracción 0..1 como porcentaje. */
export function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}
