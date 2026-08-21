/**
 * Client helper for the /api/v1/pro/stylize endpoint.
 *
 * Takes a style id (and optional sub_style display name) plus the user's photo
 * as a base64 data URI, and returns the generated image reference — either an
 * http(s) URL or a base64 data URI that can be embedded in an <img src=...>.
 *
 * Uses the shared unified HTTP client (src/lib/httpClient.ts).
 */

import { api } from './httpClient';
import { getAPIBaseURL } from './config';

export interface StylizeRequest {
  style: string;
  /** Sub-style display name. Omit or pass null for the "overall" look. */
  sub_style?: string | null;
  /** User photo as data URI (data:image/...;base64,...) or http(s) URL. */
  image: string;
  user_image?: string;
}

export interface StylizeResponse {
  style: string;
  sub_style?: string | null;
  /** Generated image URL or base64 data URI — embed directly in <img>. */
  image: string;
  image_url?: string;
}

/**
 * Helper to ensure the returned image string is a fully qualified URL or Base64 URI,
 * preventing Vercel 404 relative-path fallbacks.
 */
function normalizeImageUrl(data: any): string {
  const rawImage = typeof data === 'string' ? data : (data?.image || data?.image_url || data?.preview_url);
  if (!rawImage) return '';

  // Return immediately if it's already a base64 data URI or absolute HTTP(S) URL
  if (rawImage.startsWith('data:') || rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
    return rawImage;
  }

  // Prepend backend base URL to relative paths to direct requests to Render instead of Vercel
  const baseURL = getAPIBaseURL();
  const cleanBase = baseURL.replace(/\/$/, '');
  const cleanPath = rawImage.replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * POST the stylize request and return the parsed response.
 *
 * Throws `Error` with a human-readable message on any non-2xx response or
 * network failure.
 */
export async function stylizeImage(
  req: StylizeRequest,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<StylizeResponse> {
  // Default client-side timeout: 210s (backend caps at 180s; give a buffer
  // for network + response serialization).
  const timeoutMs = opts?.timeoutMs ?? 210_000;

  const userImg = req.image || req.user_image || '';

  const result = await api.post<StylizeResponse>(
    '/api/v1/pro/stylize',
    {
      style: req.style,
      sub_style: req.sub_style ?? null,
      image: userImg,
      user_image: userImg,
    },
    {
      signal: opts?.signal,
      timeout: timeoutMs,
    }
  );

  // Normalize image string to handle Base64, relative paths, and key variations safely
  const validImage = normalizeImageUrl(result);
  if (!validImage) {
    throw new Error('Stylize response missing image field.');
  }

  return {
    ...result,
    image: validImage,
    image_url: validImage,
  };
}