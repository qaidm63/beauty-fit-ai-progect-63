import { ApiError, api } from './httpClient';
import { getAPIBaseURL } from './config';

export interface ProTutorialRequest {
  style: string;
  image?: string;
  face_shape?: string;
  eye_tags?: string[];
  facial_tags?: string[];
  metrics?: Record<string, number | string>;
  score?: number;
}

export interface TutorialStep {
  title: string;
  description: string;
  products: string[];
  technique: string;
}

export interface SubStyle {
  name: string;
  summary: string;
  best_for: string;
}

export interface ProTutorialResponse {
  style: string;
  overview: string;
  personalized_analysis: string;
  steps: TutorialStep[];
  sub_styles: SubStyle[];
  recommended_sub_style?: string | null;
  color_palette: string[];
  pro_tips: string[];
  simulation_prompt: string;
}

export interface StylizeRequest {
  style: string;
  sub_style?: string | null;
  image?: string;
  user_image?: string;
}

export interface StylizeResponse {
  style: string;
  sub_style?: string | null;
  image?: string;       // المفتاح القادم من Render
  image_url?: string;   // المفتاح الاحتياطي
  preview_url?: string;
}

/**
 * Helper to normalize the returned image string into a fully qualified URL or
 * base64 data URI, preventing Vercel 404 relative-path fallbacks.
 */
export function normalizeImageUrl(data: any): string {
  if (!data) return '';

  const rawImage = typeof data === 'string' ? data : (data.image || data.image_url || data.preview_url);
  if (!rawImage) return '';

  if (rawImage.startsWith('data:') || rawImage.startsWith('http')) {
    return rawImage;
  }

  const baseURL = getAPIBaseURL();
  const cleanBase = baseURL.replace(/\/$/, '');
  const cleanPath = rawImage.replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Call the backend Pro tutorial endpoint.
 */
export async function generateProTutorial(
  req: ProTutorialRequest
): Promise<ProTutorialResponse> {
  return api.post<ProTutorialResponse>('/api/v1/pro/tutorial', req, {
    timeout: 90_000,
  });
}

/**
 * Generate an AI-stylized look image (img2img).
 */
export async function stylizeProLook(
  req: StylizeRequest
): Promise<StylizeResponse> {
  // توحيد اسم مفتاح الصورة ليكون متوافقاً سواء أُرسل image أو user_image
  const payload = {
    ...req,
    user_image: req.user_image || req.image,
    image: req.image || req.user_image,
  };

  const result = await api.post<StylizeResponse>('/api/v1/pro/stylize', payload, {
    timeout: 210_000,
  });

  const validUrl = normalizeImageUrl(result);
  return {
    ...result,
    image: validUrl,
    image_url: validUrl,
  };
}

// تصدير باسم متوافق مع الاستيرادات الأخرى في المشروع
export const stylizeImage = stylizeProLook;

/**
 * Fetch the current user's Pro entitlement status from the backend.
 *
 * This is the authoritative check: Pro access is granted server-side after
 * payment (Stripe webhook / verify) and stored in the database. The old
 * client-side localStorage flag has been removed because it could be forged.
 */
export interface EntitlementStatus {
  has_pro: boolean;
  plan: string;
  expires_at: string | null;
  is_developer: boolean;
}

export interface EntitlementResult {
  status: EntitlementStatus | null;
  error: Error | null;
}

const NO_ENTITLEMENT: EntitlementStatus = {
  has_pro: false,
  plan: '',
  expires_at: null,
  is_developer: false,
};

export async function getProEntitlement(): Promise<EntitlementResult> {
  try {
    const status = await api.get<EntitlementStatus>(
      '/api/v1/payments/entitlement'
    );
    return { status: status ?? NO_ENTITLEMENT, error: null };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return {
        status: NO_ENTITLEMENT,
        error: new Error('UNAUTHENTICATED'),
      };
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { status: null, error: new Error(message) };
  }
}