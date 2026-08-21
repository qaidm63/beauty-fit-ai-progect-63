import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { createPaymentSession } from "@/api/payments";
import {
  Crown,
  Gem,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Sparkles,
  Loader2,
} from "lucide-react";

export default function CheckoutPlanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // styleId/styleName arrive from either router state (ResultsPage click) or
  // from query params (reconstructing the URL after a login redirect).
  const styleId =
    (location.state?.styleId as string) ||
    searchParams.get("style_id") ||
    "";
  const styleName =
    (location.state?.styleName as string) ||
    searchParams.get("style_name") ||
    "Pro";

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth guard: if the user lands here without a session, send them to login
  // with a return URL so they come straight back after authenticating.
  useEffect(() => {
    if (authLoading) return;
    // Development bypass: allow access without auth if env var is set
    const canBypassDev = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_STRIPE === 'true';
    if (!user && !canBypassDev) {
      const params = new URLSearchParams({
        return_to: "/checkout/plan",
        style_id: styleId,
        style_name: styleName,
      });
      navigate(`/login?${params.toString()}`, { replace: true });
    }
  }, [user, authLoading, styleId, styleName, navigate]);

  const redirectToLogin = useCallback(() => {
    const params = new URLSearchParams({
      return_to: "/checkout/plan",
      style_id: styleId,
      style_name: styleName,
    });
    navigate(`/login?${params.toString()}`, { replace: true });
  }, [styleId, styleName, navigate]);

  const handleCheckout = useCallback(
    async (plan: "one_time" | "monthly") => {
      setCheckoutLoading(plan);
      setErrorMessage(null);
      try {
        const res = await createPaymentSession({
          plan,
          style_id: styleId,
        });
        if (res.url) {
          window.location.href = res.url;
        } else {
          throw new Error("No checkout URL returned. Please try again.");
        }
      } catch (err: unknown) {
        console.error("Checkout error:", err);
        const message =
          err instanceof Error ? err.message : "Unable to start checkout.";

        // If authentication is required, redirect to login preserving the
        // checkout context so the user returns here after authenticating
        // — instead of being dropped on the home page (which caused the
        // closed login loop).
        if (message === "LOGIN_REQUIRED") {
          redirectToLogin();
          return;
        }
        setErrorMessage(message);
        setCheckoutLoading(null);
      }
    },
    [styleId, redirectToLogin]
  );

  // While the auth state is still loading, show a spinner instead of the
  // plan cards (which would immediately redirect on a missing session).
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0D12]">
        <Loader2 className="w-8 h-8 text-[#C9A96E] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0F0D12]">
      {/* Full-screen loading overlay */}
      {checkoutLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#1A1720]/90 border border-white/10 shadow-2xl">
            <Loader2 className="w-10 h-10 text-[#C9A96E] animate-spin" />
            <p className="font-body text-base text-white">
              Connecting to Stripe checkout...
            </p>
            <p className="font-body text-xs text-[#B8C4D8]/60">
              This may take a few seconds
            </p>
          </div>
        </div>
      )}

      {/* Background effects */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{
            top: "-10%",
            right: "-10%",
            background:
              "radial-gradient(circle, rgba(184,112,106,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            bottom: "-5%",
            left: "-8%",
            background:
              "radial-gradient(circle, rgba(142,156,195,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      <Navbar />

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-20 relative z-10">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[#B8C4D8]/70 hover:text-white text-sm font-body mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to results
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(184,112,106,0.18), rgba(201,169,110,0.18))",
              border: "1px solid rgba(201,169,110,0.3)",
            }}
          >
            <Gem className="w-3.5 h-3.5 text-[#C9A96E]" />
            <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.25em]">
              Choose Your Plan
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-[1.1]">
            Unlock your{" "}
            <span
              className="italic"
              style={{
                background:
                  "linear-gradient(135deg, #E8B4A6 0%, #B8C4D8 50%, #E8D5A6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {styleName}
            </span>{" "}
            report
          </h1>
          <p className="font-body text-base text-[#B8C4D8]/80 max-w-xl mx-auto leading-relaxed">
            Select a plan below to get your personalized makeup playbook —
            written by AI against professional style guides.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
            <p className="font-body text-sm text-red-300">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="mt-2 font-body text-xs text-red-400 hover:text-red-200 underline transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {/* One-time plan */}
          <button
            onClick={() => handleCheckout("one_time")}
            disabled={checkoutLoading !== null}
            className="group relative rounded-2xl p-6 border text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl disabled:opacity-60 disabled:cursor-wait"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-[#B8C4D8]" />
                <span className="font-body text-[11px] font-bold text-[#B8C4D8] uppercase tracking-[0.2em]">
                  One-time
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-white">
                  $1.80
                </span>
                <span className="font-body text-sm text-[#B8C4D8]/60">
                  once
                </span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6">
              {[
                "One complete style report",
                "Step-by-step tutorial",
                "Personal color palette",
                "Pro tips from experts",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#B8C4D8]/60 flex-shrink-0 mt-0.5" />
                  <span className="font-body text-sm text-[#B8C4D8]/80">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/20 text-white text-sm font-semibold font-body group-hover:bg-white/10 transition-all">
              {checkoutLoading === "one_time" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  <span>Get this report</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>

          {/* Monthly subscription — recommended */}
          <button
            onClick={() => handleCheckout("monthly")}
            disabled={checkoutLoading !== null}
            className="group relative rounded-2xl p-6 border-2 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl disabled:opacity-60 disabled:cursor-wait overflow-hidden"
            style={{
              background:
                "linear-gradient(160deg, rgba(184,112,106,0.15), rgba(142,156,195,0.10) 50%, rgba(201,169,110,0.15))",
              borderColor: "rgba(201,169,110,0.5)",
            }}
          >
            {/* Best value badge */}
            <div
              className="absolute -top-px right-5 px-3 py-1 rounded-b-lg text-[10px] font-bold font-body uppercase tracking-wider text-[#1E1518]"
              style={{
                background: "linear-gradient(135deg, #E8D5A6, #C9A96E)",
              }}
            >
              Best value
            </div>

            <div className="mb-4 mt-1">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-[#C9A96E]" />
                <span className="font-body text-[11px] font-bold text-[#C9A96E] uppercase tracking-[0.2em]">
                  Pro Monthly
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-white">
                  $7.99
                </span>
                <span className="font-body text-sm text-[#B8C4D8]/60">
                  /month
                </span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6">
              {[
                "All top 3 style reports",
                "Unlimited regenerations",
                "Step-by-step tutorials for each",
                "Personal color palettes",
                "Pro tips from experts",
                "Cancel anytime",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A96E] flex-shrink-0 mt-0.5" />
                  <span className="font-body text-sm text-white/90">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold font-body shadow-lg group-hover:brightness-110 transition-all"
              style={{
                background:
                  "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)",
              }}
            >
              {checkoutLoading === "monthly" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  <Gem className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>Unlock all reports</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </div>

        {/* Trust line */}
        <div className="text-center mt-8">
          <p className="font-body text-[12px] text-[#B8C4D8]/50 flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3" />
            Secure checkout via Stripe · Instant access · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}