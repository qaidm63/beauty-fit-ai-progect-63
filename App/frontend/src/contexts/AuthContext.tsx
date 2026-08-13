import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { authApi, clearAuthToken, setAuthToken } from '../lib/auth';
import { getSupabase } from '../lib/supabaseClient';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  last_login?: string;
}

export type SocialProvider = 'google' | 'apple' | 'facebook';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface RegisterResult {
  ok: boolean;
  needsEmailConfirmation?: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (
    email: string,
    password: string,
    username?: string
  ) => Promise<RegisterResult>;
  loginWithOAuth: (provider: SocialProvider) => Promise<void>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Store the Supabase access token so HTTP clients attach it as Bearer. */
function syncAccessToken(token: string | null): void {
  if (token) {
    setAuthToken(token);
  } else {
    clearAuthToken();
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const supabase = getSupabase();
    try {
      if (!supabase) {
        setUser(null);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setUser(null);
        return;
      }

      syncAccessToken(session.access_token);

      const userData = await authApi.getCurrentUser();
      if (!mountedRef.current) return;
      setUser(userData);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const supabase = getSupabase();
      setError(null);
      if (!supabase) {
        return { ok: false, error: 'Supabase is not configured.' };
      }

      try {
        const { data, error: authError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          return { ok: false, error: authError.message };
        }
        if (data.session?.access_token) {
          syncAccessToken(data.session.access_token);
        }
        const userData = await authApi.getCurrentUser();
        if (mountedRef.current) setUser(userData);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Login failed',
        };
      }
    },
    []
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      username?: string
    ): Promise<RegisterResult> => {
      const supabase = getSupabase();
      setError(null);
      if (!supabase) {
        return { ok: false, error: 'Supabase is not configured.' };
      }

      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: username ? { name: username, username } : undefined,
          },
        });
        if (authError) {
          return { ok: false, error: authError.message };
        }

        if (data.session?.access_token) {
          syncAccessToken(data.session.access_token);
          const userData = await authApi.getCurrentUser();
          if (mountedRef.current) setUser(userData);
          return { ok: true };
        }

        // No session means email confirmation is required before the user
        // can sign in.
        return { ok: true, needsEmailConfirmation: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Registration failed',
        };
      }
    },
    []
  );

  const loginWithOAuth = useCallback(async (provider: SocialProvider) => {
    const supabase = getSupabase();
    setError(null);
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (authError) {
      setError(authError.message);
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      const supabase = getSupabase();
      setError(null);
      if (!supabase) {
        return { ok: false, error: 'Supabase is not configured.' };
      }
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/callback` }
      );
      if (authError) {
        return { ok: false, error: authError.message };
      }
      return { ok: true };
    },
    []
  );

  const logout = useCallback(async () => {
    const supabase = getSupabase();
    setError(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
    syncAccessToken(null);
    if (mountedRef.current) setUser(null);
  }, []);

  useEffect(() => {
    checkAuthStatus();

    const supabase = getSupabase();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        syncAccessToken(session.access_token);
        // Keep the backend view of the user fresh after sign-in/refresh.
        authApi
          .getCurrentUser()
          .then((userData) => {
            if (mountedRef.current) setUser(userData);
          })
          .catch(() => {
            if (mountedRef.current) setUser(null);
          });
      } else {
        syncAccessToken(null);
        if (mountedRef.current) setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuthStatus]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    register,
    loginWithOAuth,
    resetPassword,
    logout,
    refetch: checkAuthStatus,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
