import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthToken } from '../lib/auth';
import { getSupabase } from '../lib/supabaseClient';

/**
 * Handles auth callbacks from two sources:
 *   1. Backend OIDC redirect: `${backend}/auth/callback?token=...` — stores the
 *      application JWT (kept for compatibility with the OIDC flow).
 *   2. Supabase OAuth return (`signInWithOAuth`): supabase-js parses the
 *      `#access_token=...` URL fragment and surfaces it via `getSession()`.
 *      We store the access token so API requests attach it as Bearer.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) navigate('/', { replace: true });
    };

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

    // For the Supabase OAuth path, capture the session created from the URL
    // fragment. The access token (or the app token above) is then attached to
    // all subsequent API calls via the auth token store.
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (data.session?.access_token) {
            setAuthToken(data.session.access_token);
          }
        })
        .finally(finish);
    } else {
      finish();
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0D12]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A96E] mx-auto mb-4"></div>
        <p className="text-[#B8C4D8]">Processing authentication...</p>
      </div>
    </div>
  );
}
