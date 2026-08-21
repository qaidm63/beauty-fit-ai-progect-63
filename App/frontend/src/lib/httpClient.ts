/**
 * Unified HTTP client for the BeautyFit frontend.
 *
 * Phase 1 consolidation: every module (auth, payments, pro tutorials,
 * stylize, settings, lipsticks) previously hand-rolled its own fetch/axios
 * stack. This is the single axios instance the whole app shares, providing:
 *
 *  - base URL resolution at request time (runtime config may load async)
 *  - automatic `Authorization: Bearer` attachment from the session store
 *  - 401 handling: attempt one Supabase session refresh, replay once, then
 *    clear the token instead of killing the session on a transient rejection
 *  - normalized `ApiError` with FastAPI `detail` extraction
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAPIBaseURL } from './config';
import { clearAuthToken, getAuthToken, tryRefreshSession } from './auth';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string, message?: string) {
    super(message ?? (detail || `Request failed with status ${status}`));
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Extract a human-readable detail string from a FastAPI-style error body. */
export function extractApiDetail(payload: unknown): string {
  if (payload == null) return '';
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const obj = d as { msg?: unknown; loc?: unknown };
          const msg = typeof obj.msg === 'string' ? obj.msg : '';
          const loc = Array.isArray(obj.loc) ? obj.loc.join('.') : '';
          return loc ? `${loc}: ${msg}` : msg;
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return '';
}

interface RetriedRequestConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

const httpClient: AxiosInstance = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90_000,
});

// Resolve the API base URL at request time (runtime config may still be
// loading when modules are first imported) and attach the session token.
httpClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const base = getAPIBaseURL().replace(/\/$/, '');
    config.url = `${base}${url}`;
  }
  const token = getAuthToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: try a Supabase session refresh and replay the request once; only
// clear the token when the refresh genuinely fails.
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriedRequestConfig | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        const token = getAuthToken();
        if (token) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, unknown>).Authorization = `Bearer ${token}`;
          return httpClient(original);
        }
      }
      clearAuthToken();
    }
    return Promise.reject(error);
  }
);

/** Convert any axios error into an ApiError with a readable message.
 *
 * AbortSignal cancellations are re-thrown as `DOMException('AbortError')` so
 * callers that distinguish "user cancelled" from "request failed" keep working.
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const axiosErr = error as AxiosError<{ detail?: unknown }>;
  if (axiosErr?.isAxiosError) {
    if (axiosErr.code === 'ERR_CANCELED') {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const status = axiosErr.response?.status ?? 0;
    const detail = extractApiDetail(axiosErr.response?.data);
    if (status === 401) {
      return new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
      return new ApiError(408, 'Request timed out. Please try again.');
    }
    return new ApiError(status, detail || 'Network error. Please try again.');
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new ApiError(0, message);
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await httpClient.request<T>(config);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),
};

export default httpClient;