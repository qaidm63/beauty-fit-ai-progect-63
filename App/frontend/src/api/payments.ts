import { ApiError, api } from '@/lib/httpClient';

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
  entitlement_granted: boolean;
}

const PAYMENT_TIMEOUT_MS = 15_000;

/**
 * Create a Stripe checkout session for the given plan.
 */
export async function createPaymentSession(
  params: CreatePaymentSessionParams
): Promise<CreatePaymentSessionResponse> {
  try {
    return await api.post<CreatePaymentSessionResponse>(
      '/api/v1/payments/create_payment_session',
      params,
      { timeout: PAYMENT_TIMEOUT_MS }
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error('LOGIN_REQUIRED');
    }
    if (err instanceof ApiError && err.status === 408) {
      throw new Error(
        'Payment request timed out. Please check your connection and try again.'
      );
    }
    if (err instanceof ApiError) {
      // Provide a user-friendly message for Stripe configuration issues.
      if (err.detail.toLowerCase().includes('stripe is not configured')) {
        throw new Error(
          'Payments are being set up. Please try again after the site is published.'
        );
      }
      throw new Error(err.detail || 'Failed to create payment session');
    }
    throw new Error(
      'Unable to reach the payment server. Please try again later.'
    );
  }
}

/**
 * Verify a Stripe checkout session (grants the Pro entitlement server-side).
 */
export async function verifyPayment(
  sessionId: string
): Promise<VerifyPaymentResponse> {
  try {
    return await api.post<VerifyPaymentResponse>(
      '/api/v1/payments/verify_payment',
      { session_id: sessionId },
      { timeout: PAYMENT_TIMEOUT_MS }
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error('LOGIN_REQUIRED');
    }
    if (err instanceof ApiError && err.status === 408) {
      throw new Error('Verification request timed out. Please try again.');
    }
    if (err instanceof ApiError) {
      throw new Error(err.detail || 'Failed to verify payment');
    }
    throw new Error(
      'Unable to reach the payment server. Please try again later.'
    );
  }
}