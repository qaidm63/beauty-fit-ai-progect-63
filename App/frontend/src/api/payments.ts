import { getAPIBaseURL } from '@/lib/config';
import { authHeaders } from '@/lib/auth';

interface CreatePaymentSessionParams {
  plan: 'one_time' | 'monthly';
  style_id?: string;
  success_url?: string;
  cancel_url?: string;
}

interface CreatePaymentSessionResponse {
  url: string | null;
  session_id: string;
}

interface VerifyPaymentResponse {
  status: string;
  payment_status: string;
  plan: string;
  style_id: string;
  amount_total: number;
  currency: string;
}

/**
 * Fetch with a timeout. Rejects with an error if the request takes longer
 * than `timeoutMs` milliseconds.
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export async function createPaymentSession(
  params: CreatePaymentSessionParams
): Promise<CreatePaymentSessionResponse> {
  const baseUrl = getAPIBaseURL();

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/api/v1/payments/create_payment_session`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(params),
      },
      15000
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Payment request timed out. Please check your connection and try again.'
      );
    }
    throw new Error(
      'Unable to reach the payment server. Please try again later.'
    );
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Payment failed' }));
    const detail: string = error.detail || 'Failed to create payment session';
    if (response.status === 401) {
      throw new Error('LOGIN_REQUIRED');
    }
    // Provide a user-friendly message for Stripe configuration issues
    if (detail.toLowerCase().includes('stripe is not configured')) {
      throw new Error(
        'Payments are being set up. Please try again after the site is published.'
      );
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function verifyPayment(
  sessionId: string
): Promise<VerifyPaymentResponse> {
  const baseUrl = getAPIBaseURL();

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/api/v1/payments/verify_payment`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ session_id: sessionId }),
      },
      15000
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Verification request timed out. Please try again.');
    }
    throw new Error(
      'Unable to reach the payment server. Please try again later.'
    );
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Verification failed' }));
    if (response.status === 401) {
      throw new Error('LOGIN_REQUIRED');
    }
    throw new Error(error.detail || 'Failed to verify payment');
  }

  return response.json();
}