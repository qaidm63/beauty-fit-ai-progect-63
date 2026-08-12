import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthToken } from '../lib/auth';

/**
 * Handles the backend OIDC callback redirect: `${backend}/auth/callback?token=...`.
 *
 * The backend sets the app JWT as an HttpOnly cookie (primary path). For
 * development environments where the cookie cannot be set cross-origin, we also
 * persist the token to sessionStorage as a fallback that the HTTP client sends
 * via the Authorization header.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAuthToken(token);
    }
    const expiresAt = searchParams.get('expires_at');
    if (expiresAt) {
      try {
        sessionStorage.setItem('bf_expires_at', expiresAt);
      } catch {
        /* ignore */
      }
    }
    navigate('/', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}
