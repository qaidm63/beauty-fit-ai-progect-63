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

    // On 401, drop the stale token so the user can re-login.
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) {
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
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/me`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        return null;
      }
      throw new Error(
        error.response?.data?.detail || 'Failed to get user info'
      );
    }
  }
}

export const authApi = new RPApi();
