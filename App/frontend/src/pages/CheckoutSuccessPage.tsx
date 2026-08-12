import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPayment } from '@/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { CheckCircle2, Loader2, XCircle, ArrowRight } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [plan, setPlan] = useState('');
  const [styleId, setStyleId] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    verifyPayment(sessionId)
      .then((result) => {
        if (result.payment_status === 'paid' || result.status === 'complete') {
          setStatus('success');
          setPlan(result.plan);
          setStyleId(result.style_id);
        } else {
          setStatus('error');
        }
      })
      .catch((err: unknown) => {
        // Payment verification requires an authenticated session.
        if (err instanceof Error && err.message === 'LOGIN_REQUIRED') {
          setLoginRequired(true);
        }
        setStatus('error');
      });
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 pt-32 pb-20 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-[#8E9CC3] animate-spin" />
            <h2 className="font-display text-2xl font-bold text-[#2D2226]">
              Verifying your payment...
            </h2>
            <p className="font-body text-sm text-[#9B8A82]">
              Please wait while we confirm your purchase.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(90,138,107,0.15), rgba(139,184,155,0.1))' }}>
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="font-display text-3xl font-bold text-[#2D2226]">
              Payment Successful!
            </h2>
            <p className="font-body text-base text-[#5C4A42] leading-relaxed">
              {plan === 'monthly'
                ? 'Your Pro Monthly subscription is now active. Enjoy unlimited access to all style reports!'
                : 'Your report has been unlocked. Enjoy your personalized style guide!'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              {styleId && (
                <Link
                  to={`/style/${styleId}/pro`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold font-body shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)' }}
                >
                  View Your Report
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                to="/results"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 text-sm font-semibold font-body transition-all !bg-transparent"
                style={{ borderColor: 'rgba(184,112,106,0.4)', color: '#B8706A' }}
              >
                Back to Results
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="font-display text-3xl font-bold text-[#2D2226]">
              Payment Issue
            </h2>
            <p className="font-body text-base text-[#5C4A42] leading-relaxed">
              {loginRequired
                ? 'You need to be signed in to claim your purchase. Sign in below and your Pro access will unlock automatically.'
                : "We couldn't verify your payment. If you were charged, please contact support."}
            </p>
            {loginRequired ? (
              <button
                onClick={() => login()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold font-body shadow-md hover:shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)' }}
              >
                Sign in to claim access
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/results')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 text-sm font-semibold font-body transition-all !bg-transparent"
                style={{ borderColor: 'rgba(184,112,106,0.4)', color: '#B8706A' }}
              >
                Back to Results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}