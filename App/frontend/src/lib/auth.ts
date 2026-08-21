import { api } from './httpClient';

/**
 * Auth token store.
 *
 * The frontend authenticates against Supabase Auth. The resulting `access_token`
 * is persisted to sessionStorage (plus an in-memory mirror so synchronous call
 * sites like the axios interceptor never depend on storage availability). Every
 * outbound API request attaches it as `Authorization: Bearer <token>`.
 */
export const AUTH_TOKEN_FALLBACK_KEY = 'bf_access_token_fallback';

let memoryToken: string | null = null;

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_FALLBACK_KEY);
  } catch {
    return null;
  }
}

function writeStorage(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_FALLBACK_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_FALLBACK_KEY);
    }
  } catch {
    /* ignore — in-memory mirror still holds the token for this session */
  }
}

export function getAuthToken(): string | null {
  return memoryToken ?? readStorage();
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  writeStorage(token);
}

export function clearAuthToken(): void {
  memoryToken = null;
  writeStorage(null);
}

/**
 * Authorization header derived from the current session token.
 *
 * @deprecated the unified httpClient attaches the token automatically; kept
 * only for call sites that hand-roll requests.
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Attempt to refresh the Supabase session and sync the access token.
 * Returns true if a valid session was recovered (new token stored),
 * false if the session is genuinely gone.
 *
 * This is the single source of truth for "can we still authenticate?"
 * — used by the 401 interceptor to avoid killing a still-valid
 * session on a transient rejection.
 */
let refreshPromise: Promise<boolean> | null = null;

export async function tryRefreshSession(): Promise<boolean> {
  // De-duplicate concurrent refresh attempts.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { getSupabase } = await import('./supabaseClient');
      const supabase = getSupabase();
      if (!supabase) return false;

      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) {
        return false;
      }
      setAuthToken(data.session.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Resolve the current user from the backend (`/api/v1/auth/me`). */
export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  name?: string | null;
  role: string;
  last_login?: string | null;
}> {
  return api.get('/api/v1/auth/me');
}
