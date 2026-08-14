import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

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

/** Authorization header derived from the current session token. */
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
 * — used by the axios 401 interceptor to avoid killing a still-valid
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

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach the session access token to every request if present.
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // On 401, attempt a Supabase session refresh before giving up. Only clear
    // the token if the refresh fails — this prevents a single transient 401
    // (e.g. during a token rotation) from killing the entire session and
    // trapping the user in a login loop.
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error?.config;
        if (
          error?.response?.status === 401 &&
          !originalRequest?._retried
        ) {
          originalRequest._retried = true;
          const refreshed = await tryRefreshSession();
          if (refreshed) {
            // Re-attach the (possibly new) token and replay the request.
            const token = getAuthToken();
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return this.client(originalRequest);
          }
          // Refresh failed — token is genuinely invalid; clear it.
          clearAuthToken();
        }
        return Promise.reject(error);
      }
    );
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  async getCurrentUser() {
    const response = await this.client.get(
      `${this.getBaseURL()}/api/v1/auth/me`
    );
    return response.data;
  }
}

export const authApi = new RPApi();
