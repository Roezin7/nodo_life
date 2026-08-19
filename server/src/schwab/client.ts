import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';

const OAUTH_AUTHORIZE = 'https://api.schwabapi.com/v1/oauth/authorize';
const OAUTH_TOKEN = 'https://api.schwabapi.com/v1/oauth/token';

export interface SchwabToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
}

export function schwabDisponible() {
  return Boolean(env.SCHWAB_CLIENT_ID && env.SCHWAB_CLIENT_SECRET && env.SCHWAB_REDIRECT_URI && env.SCHWAB_TOKEN_ENCRYPTION_KEY);
}

function exigirConfiguracion() {
  if (!schwabDisponible()) {
    throw new HttpError(503, 'Schwab no está configurado. Agrega las credenciales de la Trader API en Coolify.');
  }
}

export function urlAutorizacion(state: string) {
  exigirConfiguracion();
  const q = new URLSearchParams({
    client_id: env.SCHWAB_CLIENT_ID,
    redirect_uri: env.SCHWAB_REDIRECT_URI,
    response_type: 'code',
    state,
  });
  return `${OAUTH_AUTHORIZE}?${q.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<SchwabToken> {
  exigirConfiguracion();
  const auth = Buffer.from(`${env.SCHWAB_CLIENT_ID}:${env.SCHWAB_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new HttpError(502, 'Schwab rechazó la autenticación OAuth. Revisa el callback y el estado de la aplicación.');
  }
  return data as unknown as SchwabToken;
}

export function intercambiarCodigo(code: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.SCHWAB_REDIRECT_URI,
  }));
}

export function renovarToken(refreshToken: string) {
  return tokenRequest(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }));
}

export async function schwabGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${env.SCHWAB_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new HttpError(response.status === 401 ? 401 : 502, `Schwab devolvió HTTP ${response.status}.`);
    throw error;
  }
  return data as T;
}
