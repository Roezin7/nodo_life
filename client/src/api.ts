// Cliente HTTP mínimo para la API. Guarda el JWT en localStorage.

const TOKEN_KEY = 'nodo_vida_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (esMutacion) {
      const { encolar } = await import('./offline');
      await encolar({ method, path, body, token: auth ? getToken() : null });
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
