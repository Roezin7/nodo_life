export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const listeners = new Set<() => void>();
export function onMutacion(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: "Respuesta inválida" }));
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false)
      window.dispatchEvent(new Event("nodo:unauthorized"));
    throw new ApiError(
      data.error || "No se pudo completar la solicitud",
      res.status,
    );
  }
  return data as T;
}
export async function query<T>(
  op: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return api<T>("/query", { method: "POST", body: { op, params } });
}
// Stable ID supplied by the form and retained across retries, never a silent offline queue.
export async function mutate<T>(
  op: string,
  params: Record<string, unknown>,
  request_id: string,
): Promise<T> {
  const result = await query<T>(op, { ...params, request_id });
  listeners.forEach((fn) => fn());
  return result;
}
export function localDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
