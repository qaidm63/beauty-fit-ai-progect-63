import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

/**
 * Fallback storage for the access token used during development when the
 * HttpOnly cookie cannot be set (e.g. cross-origin local preview). In
 * production the HttpOnly cookie set by the backend is the primary path.
 */
export const AUTH_TOKEN_FALLBACK_KEY = 'bf_access_token_fallback';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_FALLBACK_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(AUTH_TOKEN_FALLBACK_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_FALLBACK_KEY);
  } catch {
    /* ignore */
  }
}

/** Authorization header derived from the fallback token (dev only). */
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

    // Attach the dev fallback token to every request if present.
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // On 401, drop the stale fallback token so the user can re-login.
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

  async login() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/login`
      );
      // The backend returns the OIDC authorization URL as JSON.
      const redirectUrl = response.data?.redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error('Login URL missing from response');
      }
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || 'Failed to initiate login'
      );
    }
  }

  async logout() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/logout`
      );
      // Clear the dev fallback token regardless of the OIDC redirect.
      clearAuthToken();
      const redirectUrl = response.data?.redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      clearAuthToken();
      throw new Error(error.response?.data?.detail || 'Failed to logout');
    }
  }
}

export const authApi = new RPApi();
