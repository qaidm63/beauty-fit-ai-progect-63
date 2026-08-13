import { useState, FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { useAuth, SocialProvider } from '@/contexts/AuthContext';
import {
  User,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

/* ── Brand icons (inline SVG — lucide dropped brand marks) ─────────────── */

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

const SOCIALS: { provider: SocialProvider; label: string; icon: typeof GoogleIcon }[] = [
  { provider: 'google', label: 'Google', icon: GoogleIcon },
  { provider: 'apple', label: 'Apple', icon: AppleIcon },
  { provider: 'facebook', label: 'Facebook', icon: FacebookIcon },
];

/* ── Shared input shell ─────────────────────────────────────────────────── */

interface InputShellProps {
  icon: React.ReactNode;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  autoComplete?: string;
}

function InputShell({
  icon,
  placeholder,
  type = 'text',
  value,
  onChange,
  name,
  autoComplete,
}: InputShellProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] focus-within:border-[#C9A96E]/60 focus-within:bg-white/[0.06] transition-all duration-300">
      <span className="text-[#B8C4D8]/50 flex-shrink-0">{icon}</span>
      <input
        type={type}
        name={name}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none font-body text-sm text-white placeholder:text-[#B8C4D8]/40"
      />
    </div>
  );
}

const GRADIENT_BTN =
  'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)';

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function AuthPage() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    error: authError,
    login,
    register,
    loginWithOAuth,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [submitting, setSubmitting] = useState<'login' | 'register' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [registeredPending, setRegisteredPending] = useState(false);

  const effectiveError = formError ?? authError;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting('login');
    const res = await login(loginEmail.trim(), loginPassword);
    setSubmitting(null);
    if (!res.ok) {
      setFormError(res.error ?? 'Login failed. Please try again.');
      return;
    }
    navigate('/', { replace: true });
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting('register');
    const res = await register(
      regEmail.trim(),
      regPassword,
      regUsername.trim() || undefined
    );
    setSubmitting(null);
    if (!res.ok) {
      setFormError(res.error ?? 'Registration failed. Please try again.');
      return;
    }
    if (res.needsEmailConfirmation) {
      setRegisteredPending(true);
      return;
    }
    navigate('/', { replace: true });
  };

  const handleOAuth = async (provider: SocialProvider) => {
    setFormError(null);
    await loginWithOAuth(provider);
  };

  const handleForgotPassword = async () => {
    setFormError(null);
    if (!loginEmail.trim()) {
      setFormError('Enter your email address to receive a reset link.');
      return;
    }
    const res = await resetPassword(loginEmail.trim());
    if (!res.ok) {
      setFormError(res.error ?? 'Failed to send reset link.');
      return;
    }
    setForgotSent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0D12]">
        <Loader2 className="w-10 h-10 text-[#C9A96E] animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const switchText =
    mode === 'login' ? (
      <>
        <span className="font-display text-3xl font-bold text-white leading-tight">
          Hello, Welcome!
        </span>
        <span className="font-body text-sm text-white/80 leading-relaxed">
          Enter your details to start your journey with BeautyFit. New here?
          Create an account and unlock your beauty genome.
        </span>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setMode('register');
          }}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[#2D2226] text-sm font-semibold font-body shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
        >
          Register
          <ArrowRight className="w-4 h-4" />
        </button>
      </>
    ) : (
      <>
        <span className="font-display text-3xl font-bold text-white leading-tight">
          Hello, Welcome!
        </span>
        <span className="font-body text-sm text-white/80 leading-relaxed">
          Already have an account? Sign in to continue your personalized beauty
          experience.
        </span>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setMode('login');
          }}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[#2D2226] text-sm font-semibold font-body shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
        >
          Login
          <ArrowRight className="w-4 h-4" />
        </button>
      </>
    );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0F0D12]">
      {/* Background effects */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{
            top: '-10%',
            right: '-10%',
            background:
              'radial-gradient(circle, rgba(184,112,106,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            bottom: '-5%',
            left: '-8%',
            background:
              'radial-gradient(circle, rgba(142,156,195,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      <Navbar />

      <div className="max-w-5xl mx-auto px-6 pt-32 pb-20 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(184,112,106,0.18), rgba(201,169,110,0.18))',
              border: '1px solid rgba(201,169,110,0.3)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C9A96E]" />
            <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.25em]">
              Welcome to BeautyFit
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-[1.1]">
            Your personal{' '}
            <span
              className="italic"
              style={{
                background:
                  'linear-gradient(135deg, #E8B4A6 0%, #B8C4D8 50%, #E8D5A6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              beauty coach
            </span>
          </h1>
          <p className="font-body text-base text-[#B8C4D8]/80 max-w-xl mx-auto leading-relaxed">
            Sign in to continue analyzing your face, unlock Pro reports, and
            track your style history.
          </p>
        </div>

        {/* Sliding card */}
        <div
          className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
          style={{ background: '#16131B' }}
        >
          <div className="grid md:grid-cols-2 min-h-[580px]">
            {/* Login form */}
            <div
              className={`${mode === 'login' ? 'flex' : 'hidden md:flex'} flex-col justify-center p-8 sm:p-10 relative z-10`}
            >
              {forgotSent ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <h2 className="font-display text-2xl font-bold text-white mb-2">
                    Check your inbox
                  </h2>
                  <p className="font-body text-sm text-[#B8C4D8]/70 leading-relaxed">
                    If an account exists for <b>{loginEmail}</b>, a password
                    reset link is on its way.
                  </p>
                  <button
                    type="button"
                    onClick={() => setForgotSent(false)}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 text-white text-sm font-semibold font-body hover:bg-white/10 transition-all"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold text-white mb-1">
                    Welcome back
                  </h2>
                  <p className="font-body text-sm text-[#B8C4D8]/60 mb-8">
                    Sign in to your account
                  </p>

                  {effectiveError && (
                    <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p className="font-body text-xs text-red-300">
                        {effectiveError}
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <InputShell
                      icon={<User className="w-4 h-4" />}
                      placeholder="Username or Email"
                      type="email"
                      name="login-email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={setLoginEmail}
                    />
                    <InputShell
                      icon={<Lock className="w-4 h-4" />}
                      placeholder="Password"
                      type="password"
                      name="login-password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="font-body text-xs text-[#C9A96E] hover:text-[#E8D5A6] transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting === 'login'}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-semibold font-body shadow-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-wait transition-all duration-300"
                      style={{ background: GRADIENT_BTN }}
                    >
                      {submitting === 'login' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Login
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <AuthDivider label="or login with social platforms" />
                  <SocialButtons onSelect={handleOAuth} />
                </>
              )}
            </div>

            {/* Register form */}
            <div
              className={`${mode === 'register' ? 'flex' : 'hidden md:flex'} flex-col justify-center p-8 sm:p-10 relative z-10`}
            >
              {registeredPending ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <h2 className="font-display text-2xl font-bold text-white mb-2">
                    Almost there!
                  </h2>
                  <p className="font-body text-sm text-[#B8C4D8]/70 leading-relaxed">
                    We sent a confirmation link to <b>{regEmail}</b>. Please
                    verify your email to activate your account.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 text-white text-sm font-semibold font-body hover:bg-white/10 transition-all"
                  >
                    Go to login
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold text-white mb-1">
                    Create account
                  </h2>
                  <p className="font-body text-sm text-[#B8C4D8]/60 mb-8">
                    Join BeautyFit for free
                  </p>

                  {effectiveError && (
                    <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p className="font-body text-xs text-red-300">
                        {effectiveError}
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4">
                    <InputShell
                      icon={<User className="w-4 h-4" />}
                      placeholder="Username"
                      name="reg-username"
                      autoComplete="username"
                      value={regUsername}
                      onChange={setRegUsername}
                    />
                    <InputShell
                      icon={<Mail className="w-4 h-4" />}
                      placeholder="Email"
                      type="email"
                      name="reg-email"
                      autoComplete="email"
                      value={regEmail}
                      onChange={setRegEmail}
                    />
                    <InputShell
                      icon={<Lock className="w-4 h-4" />}
                      placeholder="Password"
                      type="password"
                      name="reg-password"
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={setRegPassword}
                    />

                    <button
                      type="submit"
                      disabled={submitting === 'register'}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-semibold font-body shadow-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-wait transition-all duration-300"
                      style={{ background: GRADIENT_BTN }}
                    >
                      {submitting === 'register' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Register
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <AuthDivider label="or register with social platforms" />
                  <SocialButtons onSelect={handleOAuth} />
                </>
              )}
            </div>
          </div>

          {/* Overlay switch panel (desktop) */}
          <div
            className={`absolute inset-y-0 left-0 w-1/2 hidden md:flex flex-col items-center justify-center gap-6 text-center px-10 z-20 transition-transform duration-700 ease-in-out ${
              mode === 'login' ? 'translate-x-full' : 'translate-x-0'
            }`}
            style={{
              background: GRADIENT_BTN,
            }}
          >
            {switchText}
          </div>

          {/* Mobile switch bar */}
          <div className="md:hidden px-8 py-5 border-t border-white/10 bg-white/[0.02] text-center">
            <p className="font-body text-xs text-[#B8C4D8]/70 mb-3">
              {mode === 'login'
                ? 'New to BeautyFit?'
                : 'Already have an account?'}
            </p>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setMode(mode === 'login' ? 'register' : 'login');
              }}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white text-sm font-semibold font-body shadow-lg hover:brightness-110 transition-all duration-300"
              style={{ background: GRADIENT_BTN }}
            >
              {mode === 'login' ? 'Register' : 'Login'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trust line */}
        <div className="text-center mt-8">
          <p className="font-body text-[12px] text-[#B8C4D8]/50">
            Your data stays private · Face analysis runs entirely on your device
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────────── */

function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-white/10" />
      <span className="font-body text-[10px] uppercase tracking-[0.2em] text-[#B8C4D8]/50">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function SocialButtons({ onSelect }: { onSelect: (p: SocialProvider) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {SOCIALS.map(({ provider, label, icon: Icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => onSelect(provider)}
          aria-label={`Sign in with ${label}`}
          title={`Sign in with ${label}`}
          className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center hover:bg-white/10 hover:scale-105 transition-all duration-300"
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
