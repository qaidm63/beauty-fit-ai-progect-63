import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/httpClient";
import { detectFaceLandmarks, loadImageFromBase64 } from "@/lib/faceLandmarker";
import Navbar from "@/components/Navbar";
import {
  Camera,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sun,
  Eye,
  SmilePlus,
  Gem,
} from "lucide-react";

/** LocalStorage keys for caching the last successful analysis. */
const LS_LAST_IMAGE = "beautylens.lastUserImage";
const LS_LAST_RESULT = "beautylens.lastResult";

const guidelines = [
  { icon: Sun, text: "Good, even lighting", color: "#C9A96E" },
  { icon: Eye, text: "Face the camera directly", color: "#8E9CC3" },
  { icon: SmilePlus, text: "Neutral expression, no sunglasses", color: "#B8706A" },
];

type AnalysisState = "idle" | "uploading" | "analyzing" | "done" | "error";

/**
 * Resize and compress an image file to reduce payload size.
 * Returns a base64 data URI of the compressed JPEG.
 */
function compressImageToBase64(file: File, maxDim = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function AnalyzePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<AnalysisState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");


  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      setState("uploading");
      setErrorMsg("");

      // Animate progress bar
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 5 + 1;
        if (p >= 85) {
          p = 85;
          clearInterval(interval);
        }
        setProgress(Math.min(p, 85));
      }, 200);

      try {
        // Compress image
        const base64Data = await compressImageToBase64(file, 800, 0.7);

        setState("analyzing");

        // ── Step 1: Detect landmarks in the browser using MediaPipe WASM ──
        const imgEl = await loadImageFromBase64(base64Data);
        const detection = await detectFaceLandmarks(imgEl);

        // ── Step 2: Send landmarks (not image) to backend for scoring ──
        const payload = {
          landmarks: detection.landmarks.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
          })),
          image_width: detection.imageWidth,
          image_height: detection.imageHeight,
        };

        // ─────────────────────────────────────────────────────────────────
        // Retry logic for transient platform-level errors.
        //
        // The Atoms dev load balancer occasionally returns:
        //   "failed the initial dns/balancer resolve for '...dev.atoms.dev'
        //    with: failed to get from node cache: could not acquire callback
        //    lock: timeout"
        //
        // This is a cold-start / DNS-resolve flake from the platform, NOT a
        // bug in our backend. When the node finally wakes up, subsequent
        // requests succeed immediately. We retry aggressively with
        // exponential backoff so the user doesn't have to.
        // ─────────────────────────────────────────────────────────────────
        const MAX_RETRIES = 6;
        let lastError: unknown = null;
        let response: unknown = null;

        // Delay schedule (ms): 2s, 4s, 8s, 15s, 22s, 30s → ~81s total worst-case
        const BACKOFF_MS = [2000, 4000, 8000, 15000, 22000, 30000];

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            response = await api.post(
              "/api/v1/face-analysis/analyze-landmarks",
              payload,
              { timeout: 90000 }
            );
            break;
          } catch (retryErr: unknown) {
            lastError = retryErr;

            // Pull whatever text we can out of the error to decide whether to
            // retry. Transient platform errors surface via .message, .detail
            // (ApiError) or .data.detail depending on the error stage.
            const errRec = retryErr as {
              message?: string;
              detail?: string;
              status?: number;
              data?: { message?: string; detail?: string; status?: number };
            };
            const errMsg = [
              errRec?.message,
              errRec?.detail,
              errRec?.data?.message,
              errRec?.data?.detail,
            ]
              .map((v) => (v == null ? "" : String(v)))
              .join(" ")
              .toLowerCase();

            const status = Number(errRec?.status ?? errRec?.data?.status ?? 0);
            const isTransient =
              errMsg.includes("dns") ||
              errMsg.includes("balancer") ||
              errMsg.includes("timeout") ||
              errMsg.includes("econnrefused") ||
              errMsg.includes("network") ||
              errMsg.includes("callback lock") ||
              errMsg.includes("node cache") ||
              errMsg.includes("failed to get from node cache") ||
              errMsg.includes("502") ||
              errMsg.includes("503") ||
              errMsg.includes("504") ||
              status === 500 ||
              status === 502 ||
              status === 503 ||
              status === 504;

            if (isTransient && attempt < MAX_RETRIES) {
              // eslint-disable-next-line no-console
              console.warn(
                `[analyze] transient error on attempt ${attempt + 1}/${
                  MAX_RETRIES + 1
                }; retrying in ${BACKOFF_MS[attempt]}ms`,
                retryErr
              );
              await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
              continue;
            }
            throw retryErr;
          }
        }

        if (!response) throw lastError;

        clearInterval(interval);
        setProgress(100);

        // `api.post` resolves with the parsed response body directly.
        const result = (response ?? {}) as Record<string, unknown>;
        setState("done");

        // Cache the successful upload + analysis for quick re-testing.
        try {
          localStorage.setItem(LS_LAST_IMAGE, base64Data);
          localStorage.setItem(LS_LAST_RESULT, JSON.stringify(result));
        } catch (storageErr) {
          // Quota exceeded or private-mode — non-fatal.
          console.warn("Failed to cache analysis:", storageErr);
        }

        setTimeout(() => {
          navigate("/results", { state: { result, userImage: base64Data } });
        }, 400);
      } catch (err: unknown) {
        clearInterval(interval);
        setProgress(0);
        setState("error");
        const errObj = err as
          | (Record<string, unknown> & { detail?: string })
          | null;
        const rawDetail =
          errObj?.detail ??
          errObj?.data?.detail ??
          errObj?.data?.message ??
          errObj?.response?.data?.detail ??
          errObj?.message ??
          "";
        const detailStr = String(rawDetail);
        const lowerDetail = detailStr.toLowerCase();
        const status = Number(
          errObj?.status ?? errObj?.data?.status ?? errObj?.response?.data?.status ?? 0
        );
        const isTransient =
          lowerDetail.includes("dns") ||
          lowerDetail.includes("balancer") ||
          lowerDetail.includes("timeout") ||
          lowerDetail.includes("network") ||
          lowerDetail.includes("callback lock") ||
          lowerDetail.includes("node cache") ||
          lowerDetail.includes("failed to get from node cache") ||
          lowerDetail.includes("econnrefused") ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;
        const detail = isTransient
          ? "The analysis server is temporarily unavailable (cold start or network hiccup). We already retried several times. Please wait ~30 seconds, then tap 'Try Again' — it almost always works on the next attempt."
          : detailStr ||
            "Analysis failed. Please try again with a clear, front-facing photo.";
        setErrorMsg(detail);
      }
    },
    [navigate]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = () => {
    setState("idle");
    setPreview(null);
    setProgress(0);
    setErrorMsg("");
  };

  const isProcessing = state === "uploading" || state === "analyzing";

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Flowing sand blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[450px] h-[450px] rounded-full blur-[110px] animate-sand-flow"
          style={{
            top: "15%",
            right: "-5%",
            background: "radial-gradient(circle, rgba(142,156,195,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] animate-sand-flow-reverse"
          style={{
            bottom: "10%",
            left: "-3%",
            background: "radial-gradient(circle, rgba(168,139,157,0.09) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full blur-[80px] animate-sand-flow-slow"
          style={{
            top: "50%",
            left: "30%",
            background: "radial-gradient(circle, rgba(201,169,110,0.07) 0%, transparent 70%)",
            animationDelay: "-8s",
          }}
        />
        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.012] animate-grain-drift"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
          }}
        />
      </div>

      <Navbar />

      <div className="max-w-[720px] mx-auto px-6 pt-32 pb-20 relative z-10">
        {/* Header */}
        <div className="text-center mb-10 stagger-children">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-cool text-xs font-semibold font-body text-[#6B7AA0] mb-5 shadow-sm">
            <Gem className="w-3.5 h-3.5 text-[#8E9CC3]" />
            AI Face Analysis
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#2D2226] mb-4">
            Let's analyze{" "}
            <span className="italic text-gradient-cool">your face</span>
          </h1>
          <p className="font-body text-base text-[#5C4A42] max-w-md mx-auto">
            Upload a clear selfie and our AI will use facial landmark analysis to
            identify your face shape, features, and find the perfect makeup styles for you.
          </p>
        </div>



        {/* Upload Card */}
        <div className="glass-card-strong rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
          {/* Subtle accent top border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />

          {/* Guidelines */}
          {state === "idle" && (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {guidelines.map((g, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF5F0] border border-[#E8DDD6]/60"
                >
                  <g.icon className="w-4 h-4" style={{ color: g.color }} />
                  <span className="font-body text-xs font-medium text-[#5C4A42]">{g.text}</span>
                </div>
              ))}
            </div>
          )}



          {/* Drop Zone / Preview */}
          {!preview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                dragOver
                  ? "border-[#8E9CC3] bg-[#8E9CC3]/5 scale-[1.01]"
                  : "border-[#E8DDD6] hover:border-[#8E9CC3]/50 hover:bg-[#F5F7FC]/60"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "linear-gradient(135deg, rgba(184,112,106,0.1), rgba(142,156,195,0.1))" }}
              >
                <Camera className="w-8 h-8 text-[#8E9CC3]" />
              </div>
              <p className="font-body text-base font-semibold text-[#2D2226] mb-2">
                Drop your selfie here
              </p>
              <p className="font-body text-sm text-[#9B8A82] mb-5">
                or click to browse · JPG, PNG up to 10 MB
              </p>
              <div
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold font-body shadow-md hover:shadow-lg transition-shadow"
                style={{ background: "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)" }}
              >
                <Upload className="w-4 h-4" />
                Choose Photo
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src={preview}
                  alt="Your selfie"
                  className={`w-full max-h-[400px] object-cover transition-all duration-500 ${
                    isProcessing ? "brightness-90" : ""
                  }`}
                />

                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2D2226]/40 backdrop-blur-sm">
                    <div className="glass-card-strong rounded-2xl px-8 py-6 text-center shadow-xl">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft"
                        style={{ background: "linear-gradient(135deg, #B8706A, #8E9CC3)" }}
                      >
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <p className="font-body text-sm font-semibold text-[#2D2226] mb-1">
                        {state === "uploading"
                          ? "Processing your photo..."
                          : "Analyzing facial landmarks..."}
                      </p>
                      <p className="font-body text-xs text-[#9B8A82] mb-4">
                        {state === "uploading"
                          ? "Preparing for analysis"
                          : "Computing face shape, features & style scores"}
                      </p>
                      {/* Progress bar */}
                      <div className="w-48 h-1.5 bg-[#E8DDD6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                            background: "linear-gradient(90deg, #B8706A, #8E9CC3, #C9A96E)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Remove button */}
                {!isProcessing && state !== "done" && (
                  <button
                    onClick={reset}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center hover:bg-white transition-colors shadow-md"
                  >
                    <X className="w-4 h-4 text-[#5C4A42]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="mt-6">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-body text-sm font-semibold text-red-700">
                    Analysis failed
                  </p>
                  <p className="font-body text-xs text-red-500 mt-1">
                    {errorMsg || "Please upload a clear, front-facing photo and try again."}
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="mt-4 w-full py-3 rounded-xl border-2 border-[#8E9CC3]/25 text-[#6B7AA0] text-sm font-semibold font-body hover:border-[#8E9CC3]/50 transition-all !bg-transparent"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { icon: CheckCircle2, text: "No filters or beauty mode", color: "#B8706A" },
            { icon: CheckCircle2, text: "Your photo stays private", color: "#8E9CC3" },
            { icon: CheckCircle2, text: "AI-powered landmark analysis", color: "#C9A96E" },
          ].map((tip, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-card-warm"
            >
              <tip.icon className="w-4 h-4 flex-shrink-0" style={{ color: tip.color }} />
              <span className="font-body text-xs text-[#5C4A42]">
                {tip.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}