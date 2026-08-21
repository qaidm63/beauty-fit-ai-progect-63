import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo, useCallback, useState } from "react";
import Navbar from "@/components/Navbar";
import FaceLandmarkDiagram from "@/components/FaceLandmarkDiagram";
import { useProEntitlement } from "@/hooks/useProEntitlement";
import { type EntitlementStatus } from "@/lib/proTutorial";
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  Crown,
  Gem,
  TrendingUp,
  Target,
  Lock,
  CheckCircle2,
  Palette,
  Wand2,
  BookOpen,
  Lightbulb,
  Layers,
  Eye,
} from "lucide-react";

/* ─── Types matching backend response ─── */
interface LandmarkPoint {
  x: number;
  y: number;
}

interface Metrics {
  face_ratio: number;
  jaw_ratio: number;
  jaw_angle: number;
  eye_aspect_ratio: number;
  eye_tilt_angle: number;
  eye_spacing_ratio: number;
  lid_visibility: number;
  nose_bridge_height: number;
  alar_width_ratio: number;
  lip_width_ratio: number;
  lip_height_ratio: number;
  cupid_bow_ratio: number;
  forehead_ratio: number;
  chin_ratio: number;
}

interface StyleScores {
  sweet: number;
  sexy: number;
  powerful: number;
  elegant: number;
  natural: number;
  androgynous: number;
}

interface Recommendation {
  style: string;
  style_name: string;
  score: number;
  match: string;
}

interface LandmarkGroups {
  jawline: LandmarkPoint[];
  forehead_contour: LandmarkPoint[];
  right_brow: LandmarkPoint[];
  left_brow: LandmarkPoint[];
  right_eye: LandmarkPoint[];
  left_eye: LandmarkPoint[];
  nose_bridge: LandmarkPoint[];
  nose_base: LandmarkPoint[];
  outer_lip: LandmarkPoint[];
  inner_lip: LandmarkPoint[];
}

interface AnalysisResult {
  face_shape: string;
  eye_tags: string[];
  facial_tags: string[];
  metrics: Metrics;
  style_scores: StyleScores;
  recommendations: Recommendation[];
  landmark_groups?: LandmarkGroups;
  forehead_contour?: LandmarkPoint[];
}

/* ─── Style theme palettes ─── */
interface StyleTheme {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  gradientSubtle: string;
  bg: string;
  cardBorder: string;
  tagBg: string;
  tagText: string;
}

const STYLE_THEMES: Record<string, StyleTheme> = {
  sweet: {
    primary: "#E8829A",
    secondary: "#F5B0C4",
    accent: "#FFD6E4",
    gradient: "linear-gradient(135deg, #E8829A 0%, #F5B0C4 50%, #FFD6E4 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(232,130,154,0.08) 0%, rgba(245,176,196,0.05) 100%)",
    bg: "#FFF5F8",
    cardBorder: "rgba(232,130,154,0.2)",
    tagBg: "#FFF0F5",
    tagText: "#C4607A",
  },
  sexy: {
    primary: "#8B2252",
    secondary: "#C44D7B",
    accent: "#E8829A",
    gradient: "linear-gradient(135deg, #8B2252 0%, #C44D7B 50%, #E8829A 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(139,34,82,0.08) 0%, rgba(196,77,123,0.05) 100%)",
    bg: "#FDF2F6",
    cardBorder: "rgba(139,34,82,0.2)",
    tagBg: "#FBE8F0",
    tagText: "#8B2252",
  },
  powerful: {
    primary: "#4A3728",
    secondary: "#7A5C48",
    accent: "#B8956A",
    gradient: "linear-gradient(135deg, #4A3728 0%, #7A5C48 50%, #B8956A 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(74,55,40,0.08) 0%, rgba(122,92,72,0.05) 100%)",
    bg: "#FAF5F0",
    cardBorder: "rgba(74,55,40,0.2)",
    tagBg: "#F5EDE5",
    tagText: "#5C4332",
  },
  elegant: {
    primary: "#6B5B8A",
    secondary: "#9B8BB8",
    accent: "#C9B8E0",
    gradient: "linear-gradient(135deg, #6B5B8A 0%, #9B8BB8 50%, #C9B8E0 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(107,91,138,0.08) 0%, rgba(155,139,184,0.05) 100%)",
    bg: "#F8F5FC",
    cardBorder: "rgba(107,91,138,0.2)",
    tagBg: "#F0ECF8",
    tagText: "#6B5B8A",
  },
  natural: {
    primary: "#5A8A6B",
    secondary: "#8BB89B",
    accent: "#B8E0C9",
    gradient: "linear-gradient(135deg, #5A8A6B 0%, #8BB89B 50%, #B8E0C9 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(90,138,107,0.08) 0%, rgba(139,184,155,0.05) 100%)",
    bg: "#F5FAF7",
    cardBorder: "rgba(90,138,107,0.2)",
    tagBg: "#ECF5F0",
    tagText: "#3D6B4F",
  },
  androgynous: {
    primary: "#5A6A7A",
    secondary: "#8899AA",
    accent: "#B0C0D0",
    gradient: "linear-gradient(135deg, #5A6A7A 0%, #8899AA 50%, #B0C0D0 100%)",
    gradientSubtle: "linear-gradient(135deg, rgba(90,106,122,0.08) 0%, rgba(136,153,170,0.05) 100%)",
    bg: "#F5F7FA",
    cardBorder: "rgba(90,106,122,0.2)",
    tagBg: "#ECF0F5",
    tagText: "#4A5A6A",
  },
};

/* ─── Display helpers (English only) ─── */

const faceShapeLabels: Record<string, string> = {
  OVAL: "Oval", ROUND: "Round", SQUARE: "Square",
  HEART: "Heart", OBLONG: "Oblong", DIAMOND: "Diamond",
};

const faceShapeDescriptions: Record<string, string> = {
  OVAL: "Your face has balanced proportions with gently rounded contours. This versatile shape works beautifully with almost any makeup style — you have the freedom to experiment.",
  ROUND: "Your face has soft, equal proportions with full cheeks. Strategic contouring and angular elements can add dimension and create the illusion of length.",
  SQUARE: "Your face features a strong jawline and forehead of similar width. Softening the angles with blush placement and rounded eye makeup creates a beautiful contrast.",
  HEART: "Your face is wider at the forehead and cheekbones, tapering to a narrower chin. This shape benefits from soft contouring at the temples and emphasis on the lower face.",
  OBLONG: "Your face is longer than it is wide, with a narrow structure. Horizontal emphasis through blush and eyeshadow can create the appearance of width and balance.",
  DIAMOND: "Your face has prominent cheekbones with a narrower forehead and jawline. This striking shape benefits from highlighting the cheekbones and softening the overall look.",
};

const eyeTagLabels: Record<string, string> = {
  MONOLID: "Monolid", HOODED: "Hooded", DOUBLE_LID: "Double Lid",
  UPTURNED: "Upturned", DOWNTURNED: "Downturned", ROUND_EYE: "Round Eye",
  ALMOND_EYE: "Almond Eye", WIDE_SET: "Wide-Set", CLOSE_SET: "Close-Set",
};

const facialTagLabels: Record<string, string> = {
  LOW_NOSE_BRIDGE: "Low Nose Bridge", HIGH_NOSE_BRIDGE: "High Nose Bridge",
  WIDE_ALAR: "Wide Alar", NARROW_ALAR: "Narrow Alar",
  THIN_LIP: "Thin Lip", FULL_LIP: "Full Lip",
  DEFINED_BOW: "Defined Bow", FLAT_BOW: "Flat Bow",
  WIDE_LIP: "Wide Lip", SMALL_MOUTH: "Small Mouth",
};

const styleDescriptions: Record<string, { tagline: string; keyFocus: string[]; image: string }> = {
  sweet: {
    tagline: "Soft, youthful charm with round eye emphasis and gentle color palettes",
    keyFocus: ["Round eye enhancement", "Gradient lip", "Soft blush", "Dewy skin"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxycgiaafma/makeup-style-natural.png",
  },
  sexy: {
    tagline: "Bold allure with cat-eye lines, sculpted contours and statement lips",
    keyFocus: ["Cat-eye liner", "Deep lip color", "Sculpted contour", "Smoky eye"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxybtqaafna/makeup-style-glam.png",
  },
  powerful: {
    tagline: "Commanding presence with strong brows, angular contour and matte finish",
    keyFocus: ["Strong brow shaping", "Angular contour", "Matte finish", "Bold lip"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxybtqaafna/makeup-style-glam.png",
  },
  elegant: {
    tagline: "Refined sophistication with balanced proportions and classic techniques",
    keyFocus: ["Classic winged liner", "Defined cupid's bow", "Subtle highlight", "Nude palette"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxycgiaafma/makeup-style-natural.png",
  },
  natural: {
    tagline: "Effortless beauty that embraces your authentic features with minimal touch",
    keyFocus: ["Tinted moisturizer", "Cream blush", "Clear lip balm", "Brow gel"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxycgiaafma/makeup-style-natural.png",
  },
  androgynous: {
    tagline: "Gender-fluid aesthetic with structured lines and neutral tones",
    keyFocus: ["Straight brow", "Matte skin", "Neutral contour", "Bare lip"],
    image: "https://mgx-backend-cdn.metadl.com/generate/images/1030796/2026-04-21/naxybtqaafna/makeup-style-glam.png",
  },
};

const matchBadgeClass: Record<string, string> = {
  STRONG: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MODERATE: "bg-blue-50 text-blue-700 border-blue-200",
  MILD: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-gray-50 text-gray-600 border-gray-200",
};

/* ─── Metric display config ─── */
const metricSections = [
  {
    label: "Face Shape",
    color: "#9B7DD4",
    items: [
      { key: "face_ratio", label: "Face Ratio", desc: "Height / Width" },
      { key: "forehead_ratio", label: "Forehead Ratio", desc: "Forehead / Cheekbone" },
      { key: "jaw_ratio", label: "Jaw Ratio", desc: "Cheekbone / Jaw" },
      { key: "jaw_angle", label: "Jaw Angle", desc: "Degrees", suffix: "°" },
      { key: "chin_ratio", label: "Chin Ratio", desc: "Chin / Cheekbone" },
    ],
  },
  {
    label: "Eyes",
    color: "#4CAF7D",
    items: [
      { key: "eye_aspect_ratio", label: "Eye Aspect Ratio", desc: "Width / Height" },
      { key: "eye_tilt_angle", label: "Eye Tilt", desc: "Degrees", suffix: "°" },
      { key: "eye_spacing_ratio", label: "Eye Spacing", desc: "Spacing / Face Width" },
      { key: "lid_visibility", label: "Lid Visibility", desc: "Crease exposure" },
    ],
  },
  {
    label: "Nose",
    color: "#E8943A",
    items: [
      { key: "nose_bridge_height", label: "Bridge Height", desc: "Relative to face" },
      { key: "alar_width_ratio", label: "Alar Width", desc: "Alar / Cheekbone" },
    ],
  },
  {
    label: "Lips",
    color: "#E06B8A",
    items: [
      { key: "lip_width_ratio", label: "Lip Width", desc: "Lip / Cheekbone" },
      { key: "lip_height_ratio", label: "Lip Fullness", desc: "Height / Face" },
      { key: "cupid_bow_ratio", label: "Cupid's Bow", desc: "Bow definition" },
    ],
  },
];

/* ─── Mock data for demo/preview mode ─── */
const DEMO_RESULT: AnalysisResult = {
  face_shape: "OVAL",
  eye_tags: ["DOUBLE_LID", "ALMOND_EYE", "CLOSE_SET"],
  facial_tags: ["HIGH_NOSE_BRIDGE", "NARROW_ALAR", "FULL_LIP", "DEFINED_BOW"],
  metrics: {
    face_ratio: 1.382, jaw_ratio: 1.145, jaw_angle: 128.4,
    eye_aspect_ratio: 0.312, eye_tilt_angle: 4.7, eye_spacing_ratio: 0.348,
    lid_visibility: 0.065, nose_bridge_height: 0.042, alar_width_ratio: 0.228,
    lip_width_ratio: 0.395, lip_height_ratio: 0.048, cupid_bow_ratio: 0.185,
    forehead_ratio: 0.345, chin_ratio: 0.198,
  },
  style_scores: { sweet: 72, sexy: 58, powerful: 45, elegant: 81, natural: 68, androgynous: 35 },
  recommendations: [
    { style: "elegant", style_name: "Elegant", score: 81, match: "STRONG" },
    { style: "sweet", style_name: "Sweet", score: 72, match: "MODERATE" },
    { style: "natural", style_name: "Natural", score: 68, match: "MODERATE" },
    { style: "sexy", style_name: "Sexy", score: 58, match: "MILD" },
    { style: "powerful", style_name: "Powerful", score: 45, match: "MILD" },
    { style: "androgynous", style_name: "Androgynous", score: 35, match: "LOW" },
  ],
};

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const isDemo = !location.state?.result;
  const result = (location.state?.result as AnalysisResult | undefined) ?? DEMO_RESULT;
  // Fallback demo portrait so the Pro Tutorial stylized images can render
  // even when the user arrived via "View Demo Results" without uploading.
  const DEMO_PORTRAIT =
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80";
  const userImage =
    (location.state?.userImage as string | undefined) ??
    (isDemo ? DEMO_PORTRAIT : undefined);

  const topStyle = result.recommendations[0]?.style || "elegant";
  const theme = STYLE_THEMES[topStyle] || STYLE_THEMES.elegant;
  const topStyles = result.recommendations.slice(0, 3);

  const { checkEntitlement, isChecking, error: entitlementError, cachedStatus } = useProEntitlement();
  const [checkingStyleId, setCheckingStyleId] = useState<string | null>(null);

  const buildProTutorialState = useCallback((styleId: string, styleName: string) => {
    const rec = result.recommendations.find((r) => r.style === styleId);
    const styleScores: Record<string, number> = {};
    result.recommendations.forEach((r) => {
      styleScores[r.style] = r.score;
    });
    return {
      style: {
        id: styleId,
        name: styleName,
        tagline: styleDescriptions[styleId]?.tagline || '',
        image: styleDescriptions[styleId]?.image || '',
        match: rec?.score || 0,
        keyFocus: styleDescriptions[styleId]?.keyFocus || [],
      },
      faceShape: result.face_shape,
      eyeTags: result.eye_tags,
      facialTags: result.facial_tags,
      metrics: result.metrics as Record<string, number>,
      styleScores,
      userImage,
    };
  }, [result, userImage]);

  const handleStyleCardClick = useCallback((styleId: string, styleName: string) => {
    setCheckingStyleId(styleId);
    checkEntitlement(styleId, styleName, (hasAccess) => {
      setCheckingStyleId(null);
      if (hasAccess) {
        navigate(`/style/${styleId}/pro`, { state: buildProTutorialState(styleId, styleName) });
      } else {
        navigate('/checkout/plan', {
          state: { styleId, styleName },
        });
      }
    });
  }, [checkEntitlement, navigate, buildProTutorialState]);

  // Memoize score colors based on theme
  const scoreColors = useMemo(() => {
    return result.recommendations.map((_, i) => {
      const t = i / Math.max(result.recommendations.length - 1, 1);
      return {
        bg: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
        text: theme.primary,
        opacity: 1 - t * 0.4,
      };
    });
  }, [result.recommendations, theme]);

  useEffect(() => {
    // Don't redirect — show demo mode if no state
  }, [navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: theme.bg }}>
      {/* Flowing blobs using theme colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] animate-sand-flow"
          style={{
            top: "10%",
            right: "-5%",
            background: `radial-gradient(circle, ${theme.primary}12 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] animate-sand-flow-reverse"
          style={{
            bottom: "15%",
            left: "-3%",
            background: `radial-gradient(circle, ${theme.secondary}10 0%, transparent 70%)`,
          }}
        />
      </div>

      <Navbar />

      <div className="max-w-[1100px] mx-auto px-6 pt-32 pb-20 relative z-10">
        {/* Header — artistic emphasis on the top style name */}
        <div className="text-center mb-14 stagger-children">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold font-body mb-6 shadow-sm backdrop-blur-sm"
            style={{ background: `${theme.primary}12`, color: theme.primary, border: `1px solid ${theme.cardBorder}` }}
          >
            <Crown className="w-3.5 h-3.5" style={{ color: theme.primary }} />
            AI Beauty Analysis Complete
          </div>
          <h1
            className="font-display italic text-6xl sm:text-8xl lg:text-9xl font-bold tracking-tight mb-5"
            style={{
              background: theme.gradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            {result.recommendations[0]?.style_name || "Elegant"}
          </h1>
          <p className="font-body text-base sm:text-lg text-[#5C4A42] max-w-2xl mx-auto leading-relaxed">
            Our AI analyzed <span className="font-semibold" style={{ color: theme.primary }}>478 facial landmarks</span> across
            14 biometric dimensions — from orbital geometry to vermilion architecture — and identified{" "}
            <span className="font-semibold" style={{ color: theme.primary }}>
              {result.recommendations[0]?.style_name}
            </span>{" "}
            as the aesthetic signature that harmonizes most naturally with your unique facial proportions.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: Photo with Landmark Overlay (tags outside image)
            + Face Shape Summary at bottom
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="rounded-3xl p-6 sm:p-8 shadow-xl mb-10 animate-fade-in-up relative overflow-hidden backdrop-blur-sm"
          style={{ background: "rgba(255,255,255,0.85)", border: `1px solid ${theme.cardBorder}` }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: theme.gradient }} />

          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${theme.primary}15` }}
            >
              <Target className="w-5 h-5" style={{ color: theme.primary }} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-[#2D2226]">Facial Landmark Analysis</h3>
              <p className="font-body text-xs text-[#9B8A82]">Key features detected from your facial geometry</p>
            </div>
          </div>

          {/* Centered image with tags on both sides (handled by the SVG component) */}
          <div className="flex justify-center">
            <div className="w-full max-w-[700px]">
              <FaceLandmarkDiagram
                userImage={userImage}
                landmarkGroups={result.landmark_groups}
                foreheadContour={result.forehead_contour}
                metrics={result.metrics}
                faceShape={result.face_shape}
                eyeTags={result.eye_tags}
                facialTags={result.facial_tags}
                themeColor={theme.primary}
              />
            </div>
          </div>

          {/* Face shape description — at the bottom of this section */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
            <p className="font-body text-sm text-[#5C4A42] leading-relaxed max-w-2xl mx-auto text-center">
              {faceShapeDescriptions[result.face_shape] || faceShapeDescriptions["OVAL"]}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: Detailed Metrics Grid
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="rounded-3xl p-6 sm:p-8 shadow-xl mb-10 animate-fade-in-up relative overflow-hidden backdrop-blur-sm"
          style={{ animationDelay: "100ms", background: "rgba(255,255,255,0.85)", border: `1px solid ${theme.cardBorder}` }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: theme.gradient }} />
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${theme.primary}15` }}
            >
              <Target className="w-5 h-5" style={{ color: theme.primary }} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-[#2D2226]">Facial Metrics</h3>
              <p className="font-body text-xs text-[#9B8A82]">Precise measurements from 478-point landmark detection</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {metricSections.map((section) => (
              <div key={section.label} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: section.color }} />
                  <span className="font-body text-xs font-bold uppercase tracking-wider" style={{ color: section.color }}>
                    {section.label}
                  </span>
                </div>
                {section.items.map((item) => {
                  const val = result.metrics[item.key as keyof Metrics];
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${theme.cardBorder}` }}
                    >
                      <div>
                        <span className="font-body text-sm font-medium text-[#2D2226]">{item.label}</span>
                        <span className="font-body text-[10px] text-[#9B8A82] ml-2">{item.desc}</span>
                      </div>
                      <span className="font-display text-lg font-bold" style={{ color: section.color }}>
                        {typeof val === "number" ? val.toFixed(item.key === "jaw_angle" || item.key === "eye_tilt_angle" ? 1 : 3) : val}
                        {item.suffix || ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: Style Dimension Scores
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="rounded-3xl p-6 sm:p-8 shadow-xl mb-10 animate-fade-in-up relative overflow-hidden backdrop-blur-sm"
          style={{ animationDelay: "150ms", background: "rgba(255,255,255,0.85)", border: `1px solid ${theme.cardBorder}` }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: theme.gradient }} />
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${theme.primary}15` }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: theme.primary }} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-[#2D2226]">Style Dimension Scores</h3>
              <p className="font-body text-xs text-[#9B8A82]">Based on facial landmark analysis across 6 beauty dimensions</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {result.recommendations.map((rec, i) => {
              const isTop = i === 0;
              const recTheme = STYLE_THEMES[rec.style] || STYLE_THEMES.elegant;
              const isCheckingThis = checkingStyleId === rec.style;
              return (
                <button
                  key={rec.style}
                  onClick={() => handleStyleCardClick(rec.style, rec.style_name)}
                  disabled={isCheckingThis}
                  className="group relative p-4 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl block text-left w-full cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    background: isTop ? theme.gradientSubtle : "rgba(255,255,255,0.6)",
                    border: `1px solid ${isTop ? theme.primary + "40" : theme.cardBorder}`,
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                    style={{
                      height: `${rec.score}%`,
                      background: recTheme.gradient,
                      opacity: 0.08,
                    }}
                  />
                  {/* Pro lock badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, rgba(201,169,110,0.95), rgba(184,112,106,0.95))",
                    }}>
                    <Lock className="w-2.5 h-2.5 text-white" />
                    <span className="font-body text-[9px] font-bold text-white uppercase tracking-wider">
                      Pro
                    </span>
                  </div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2 pr-12">
                      <span className="font-body text-xs font-bold text-[#2D2226] uppercase tracking-wider">
                        {rec.style_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${matchBadgeClass[rec.match] || ""}`}>
                        {rec.match}
                      </span>
                    </div>
                    <div className="flex items-end gap-1">
                      <span
                        className="font-display text-3xl font-bold"
                        style={{ color: scoreColors[i]?.text || theme.primary, opacity: scoreColors[i]?.opacity || 1 }}
                      >
                        {rec.score}
                      </span>
                      <span className="font-body text-xs text-[#9B8A82] mb-1">/100</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `${theme.primary}15` }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${rec.score}%`, background: recTheme.gradient }}
                      />
                    </div>
                    {/* Unlock hint — shown on hover */}
                    <div className="mt-3 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-all">
                      <span className="font-body text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: recTheme.primary }}>
                        Unlock report
                      </span>
                      <span className="font-body text-[9px] text-[#9B8A82]">
                        $1.80 / $7.99·mo
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tap hint */}
          <p className="font-body text-xs text-center text-[#9B8A82] mt-5 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            Tap any style above to unlock its complete personalized report
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3.5: AI Authority — trust & credibility insight
            Specialized makeup AI trained on 100,000+ face database
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="relative rounded-3xl p-6 sm:p-10 shadow-xl mb-10 overflow-hidden animate-fade-in-up"
          style={{ animationDelay: "170ms" }}
        >
          {/* Dark authority background */}
          <div className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #1E1518 0%, #2D2226 40%, #1D1F2B 100%)",
            }} />
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, #B8706A, #8E9CC3, #C9A96E)" }} />
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-[380px] h-[380px] rounded-full blur-[100px] pointer-events-none"
            style={{ background: `${theme.primary}25` }} />
          <div className="absolute -bottom-20 -left-10 w-[300px] h-[300px] rounded-full blur-[90px] pointer-events-none"
            style={{ background: `${theme.secondary}18` }} />

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(184,112,106,0.18), rgba(201,169,110,0.18))",
                border: "1px solid rgba(201,169,110,0.3)",
              }}>
              <Sparkles className="w-3.5 h-3.5 text-[#C9A96E]" />
              <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.25em]">
                Why BeautyFit AI
              </span>
            </div>

            <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-[1.1] max-w-3xl">
              Not a generic chatbot.{" "}
              <span className="italic"
                style={{
                  background:
                    "linear-gradient(135deg, #E8B4A6 0%, #B8C4D8 50%, #E8D5A6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                A specialist in makeup &amp; style.
              </span>
            </h3>
            <p className="font-body text-base text-[#B8C4D8]/85 leading-relaxed max-w-3xl mb-8">
              BeautyFit runs on a proprietary AI model specifically fine-tuned by{" "}
              <span className="text-white font-semibold">professional makeup artists and celebrity stylists</span> —
              not a general-purpose language model. It has been trained and benchmarked against an{" "}
              <span className="text-white font-semibold">exclusive database of 100,000+ analyzed faces</span>{" "}
              and hundreds of expert style guides, so every report reflects real professional technique, not guesswork.
            </p>

            {/* Stat grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  stat: "100,000+",
                  label: "Faces analyzed",
                  desc: "Exclusive training database across ages, ethnicities, and features.",
                },
                {
                  stat: "478",
                  label: "Landmark points",
                  desc: "Precision facial geometry mapped on every single analysis.",
                },
                {
                  stat: "Pro-trained",
                  label: "Makeup & style AI",
                  desc: "Fine-tuned with working makeup artists and stylists — not a generic LLM.",
                },
                {
                  stat: "6 styles",
                  label: "Aesthetic dimensions",
                  desc: "Scored against Sweet, Sexy, Powerful, Elegant, Natural, Androgynous.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 sm:p-5 border backdrop-blur-sm"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="font-display text-2xl sm:text-3xl font-bold mb-1"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8D5A6 0%, #E8B4A6 50%, #B8C4D8 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                    {item.stat}
                  </div>
                  <div className="font-body text-[11px] font-bold text-[#C9A96E] uppercase tracking-[0.15em] mb-2">
                    {item.label}
                  </div>
                  <p className="font-body text-[12px] text-[#B8C4D8]/70 leading-snug">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: BIG PRO UPGRADE — promotes the complete report
            Replaces the old "Your top makeup styles" preview (moved to Pro).
            ═══════════════════════════════════════════════════════════════ */}
        <ProPromoSection
          theme={theme}
          topStyles={topStyles}
          result={result}
          userImage={userImage}
          checkEntitlement={checkEntitlement}
          isChecking={isChecking}
        />

        {/* Bottom action — re-analyze */}
        <div className="flex items-center justify-center mt-12">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 text-sm font-semibold font-body transition-all duration-300 !bg-transparent hover:brightness-95"
            style={{ borderColor: `${theme.primary}40`, color: theme.primary }}
          >
            <RotateCcw className="w-4 h-4" />
            Analyze Another Photo
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Pro Promotion Section
   A big, sales-oriented CTA block that teases what users unlock with Pro:
   personalized sub-styles, step-by-step tutorial, color palette, pro tips.
   ═══════════════════════════════════════════════════════════════════════ */
interface ProPromoSectionProps {
  theme: StyleTheme;
  topStyles: Recommendation[];
  result: AnalysisResult;
  userImage?: string;
  checkEntitlement: (styleId: string, styleName: string, onSuccess: (hasAccess: boolean) => void) => Promise<void>;
  isChecking: boolean;
}

function ProPromoSection({ theme, topStyles, result, userImage, checkEntitlement, isChecking }: ProPromoSectionProps) {
  const navigate = useNavigate();
  const bestStyle = topStyles[0];

  const buildProTutorialState = useCallback((styleId: string, styleName: string) => {
    const rec = result.recommendations.find((r) => r.style === styleId);
    const styleScores: Record<string, number> = {};
    result.recommendations.forEach((r) => {
      styleScores[r.style] = r.score;
    });
    return {
      style: {
        id: styleId,
        name: styleName,
        tagline: styleDescriptions[styleId]?.tagline || '',
        image: styleDescriptions[styleId]?.image || '',
        match: rec?.score || 0,
        keyFocus: styleDescriptions[styleId]?.keyFocus || [],
      },
      faceShape: result.face_shape,
      eyeTags: result.eye_tags,
      facialTags: result.facial_tags,
      metrics: result.metrics as Record<string, number>,
      styleScores,
      userImage,
    };
  }, [result, userImage]);

  const handleGoToCheckout = useCallback(() => {
    if (!bestStyle) return;
    checkEntitlement(bestStyle.style, bestStyle.style_name, (hasAccess) => {
      if (hasAccess) {
        navigate(`/style/${bestStyle.style}/pro`, { state: buildProTutorialState(bestStyle.style, bestStyle.style_name) });
      } else {
        navigate('/checkout/plan', {
          state: { styleId: bestStyle.style, styleName: bestStyle.style_name },
        });
      }
    });
  }, [bestStyle, checkEntitlement, navigate, buildProTutorialState]);

  if (!bestStyle) return null;
  const bestDesc =
    styleDescriptions[bestStyle.style] || styleDescriptions.natural;

  const proFeatures = [
    {
      icon: Layers,
      title: "Sub-styles matched to you",
      desc: "Multiple variations within your top style, with the one that suits your features marked.",
    },
    {
      icon: Wand2,
      title: "Step-by-step tutorial",
      desc: "5–7 numbered steps with techniques, placements, and product suggestions tailored to your face.",
    },
    {
      icon: Palette,
      title: "Personal color palette",
      desc: "6 curated hex-code swatches that harmonize with your features and undertones.",
    },
    {
      icon: Lightbulb,
      title: "Pro tips from experts",
      desc: "Application secrets and fixes written against professional makeup guides.",
    },
    {
      icon: BookOpen,
      title: "Why this style works",
      desc: "Personalized analysis connecting your metrics, eye traits, and face shape to the look.",
    },
    {
      icon: Eye,
      title: "Top 3 style reports",
      desc: "Unlock the complete guide for every one of your top matches, not just the #1.",
    },
  ];

  const paletteTeaser = ["#E8C9B0", "#C97A6B", "#6B4B3E", "#2D2226", "#F5E6DE", "#8E7166"];

  const proLinkState = {
    style: {
      id: bestStyle.style,
      name: bestStyle.style_name,
      tagline: bestDesc.tagline,
      image: bestDesc.image,
      match: bestStyle.score,
      keyFocus: bestDesc.keyFocus,
    },
    faceShape: result.face_shape,
    eyeTags: result.eye_tags,
    facialTags: result.facial_tags,
    styleScores: result.style_scores,
    metrics: result.metrics,
    // Pass the user's uploaded photo through so the Pro tutorial page can use it
    // for img2img makeup visualizations (overall + sub-style thumbnails).
    userImage,
  };

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up"
      style={{ animationDelay: "200ms" }}>
      {/* Rich dark gradient background */}
      <div className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1E1518 0%, #1D1F2B 30%, #2D2226 60%, #1E1518 100%)",
        }} />
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-[420px] h-[420px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: `${theme.primary}20` }} />
      <div className="absolute bottom-0 left-0 w-[360px] h-[360px] rounded-full blur-[90px] pointer-events-none"
        style={{ background: `${theme.secondary}18` }} />
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, #B8706A, #8E9CC3, #C9A96E)" }} />

      <div className="relative z-10 p-8 sm:p-12">
        {/* Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(184,112,106,0.18), rgba(201,169,110,0.18))",
              border: "1px solid rgba(201,169,110,0.3)",
            }}>
            <Gem className="w-3.5 h-3.5 text-[#C9A96E]" />
            <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.25em]">
              BeautyFit Pro Report
            </span>
          </div>

          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-[1.05]">
            Unlock your complete{" "}
            <span className="italic"
              style={{
                background:
                  "linear-gradient(135deg, #E8B4A6 0%, #B8C4D8 50%, #E8D5A6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
              {bestStyle.style_name}
            </span>{" "}
            report
          </h2>
          <p className="font-body text-base sm:text-lg text-[#B8C4D8]/80 leading-relaxed max-w-2xl">
            You're seeing <span className="text-white font-semibold">the free snapshot</span>. The full Pro
            report turns your facial analysis into an actionable, personalized makeup playbook —
            written by AI against professional style guides.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {proFeatures.map((f, i) => (
            <div
              key={i}
              className="relative rounded-2xl p-5 border backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(184,112,106,0.22), rgba(142,156,195,0.22))",
                  border: "1px solid rgba(201,169,110,0.25)",
                }}
              >
                <f.icon className="w-5 h-5 text-[#E8D5A6]" />
              </div>
              <h3 className="font-display text-base font-semibold text-white mb-1.5">
                {f.title}
              </h3>
              <p className="font-body text-[13px] text-[#B8C4D8]/70 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Visual teaser — mock report preview */}
        <div className="mt-10 grid lg:grid-cols-[1.15fr_1fr] gap-6">
          {/* Left: mocked step card + palette */}
          <div className="rounded-2xl p-6 border relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.1)",
            }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C9A96E]" />
                <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.2em]">
                  Preview — Step 1 of 6
                </span>
              </div>
              <span className="font-body text-[10px] text-[#B8C4D8]/60">
                Your {bestStyle.style_name} report
              </span>
            </div>

            {/* Sample step */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold"
                style={{ background: "linear-gradient(135deg, #B8706A, #8E9CC3)" }}
              >
                1
              </div>
              <div className="flex-1">
                <h4 className="font-display text-lg font-semibold text-white mb-1">
                  Base &amp; Skin Finish
                </h4>
                <p className="font-body text-sm text-[#B8C4D8]/80 leading-relaxed mb-3">
                  Build a luminous, satin base that enhances your{" "}
                  <span className="text-white">{result.face_shape.toLowerCase()}</span>{" "}
                  face shape without masking natural texture…
                </p>
                <div className="relative">
                  {/* Blur teaser for locked content */}
                  <p className="font-body text-[13px] text-[#B8C4D8]/50 leading-relaxed blur-[3px] select-none">
                    Press a damp beauty sponge in stippling motions along the T-zone and
                    cheekbones, layering only where needed to preserve the lived-in glow
                    that suits your metrics. Set sparingly — only the chin and sides of
                    the nose — so cream products beneath can…
                  </p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2D2226]/80 backdrop-blur border border-[#C9A96E]/30">
                      <Lock className="w-3 h-3 text-[#C9A96E]" />
                      <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.15em]">
                        Pro only
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Palette teaser */}
            <div className="pt-5 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-3.5 h-3.5 text-[#E8B4A6]" />
                <span className="font-body text-[10px] font-bold text-[#E8B4A6] uppercase tracking-[0.2em]">
                  Your color palette
                </span>
              </div>
              <div className="flex gap-2.5">
                {paletteTeaser.map((hex, i) => (
                  <div
                    key={`${hex}-${i}`}
                    className="flex-1 h-10 rounded-lg shadow-inner"
                    style={{ background: hex, opacity: 0.85 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: value stack + CTA */}
          <div className="rounded-2xl p-6 border relative overflow-hidden flex flex-col"
            style={{
              background:
                "linear-gradient(160deg, rgba(184,112,106,0.12), rgba(142,156,195,0.08) 45%, rgba(201,169,110,0.12))",
              borderColor: "rgba(201,169,110,0.3)",
            }}>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-[#C9A96E]" />
              <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.2em]">
                Everything included
              </span>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {[
                `Full ${bestStyle.style_name} playbook with 5–7 personalized steps`,
                "Recommended sub-style matched to your features",
                "Custom 6-color palette for your skin and undertones",
                "Expert application techniques and pro tips",
                "Access to all top 3 style reports, not just one",
                "Unlimited regenerations as your look evolves",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A96E] flex-shrink-0 mt-0.5" />
                  <span className="font-body text-sm text-white/90 leading-snug">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            {/* Pricing — two plans */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              {/* One-time plan */}
              <button
                onClick={handleGoToCheckout}
                disabled={isChecking}
                className="group relative block w-full text-left rounded-2xl p-4 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-wait"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.14)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-body text-[10px] font-bold text-[#B8C4D8] uppercase tracking-[0.2em]">
                        One-time
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold font-body uppercase tracking-wider text-[#1E1518]"
                        style={{ background: "linear-gradient(135deg, #E8D5A6, #C9A96E)" }}>
                        Try it
                      </span>
                    </div>
                    <p className="font-body text-xs text-[#B8C4D8]/70 leading-snug">
                      Get one complete report. No subscription.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="font-display text-2xl font-bold text-white">$1.80</span>
                    </div>
                    <span className="font-body text-[10px] text-[#B8C4D8]/60">once</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {isChecking ? (
                    <span className="flex items-center gap-2 font-body text-xs font-semibold text-[#E8D5A6]">
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Checking access...
                    </span>
                  ) : (
                    <>
                      <span className="font-body text-xs font-semibold text-[#E8D5A6] group-hover:text-white transition-colors">
                        Unlock this report
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#E8D5A6] group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </>
                  )}
                </div>
              </button>

              {/* Monthly subscription — recommended */}
              <button
                onClick={handleGoToCheckout}
                disabled={isChecking}
                className="group relative block w-full text-left rounded-2xl p-4 border-2 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 disabled:cursor-wait"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(184,112,106,0.22), rgba(142,156,195,0.16) 50%, rgba(201,169,110,0.22))",
                  borderColor: "rgba(201,169,110,0.55)",
                }}
              >
                {/* Best value badge */}
                <div className="absolute -top-px right-4 px-2.5 py-0.5 rounded-b-md text-[9px] font-bold font-body uppercase tracking-wider text-[#1E1518]"
                  style={{ background: "linear-gradient(135deg, #E8D5A6, #C9A96E)" }}>
                  Best value
                </div>
                <div className="flex items-start justify-between gap-3 mt-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-3.5 h-3.5 text-[#C9A96E]" />
                      <span className="font-body text-[10px] font-bold text-[#C9A96E] uppercase tracking-[0.2em]">
                        Pro monthly
                      </span>
                    </div>
                    <p className="font-body text-xs text-white/80 leading-snug">
                      All top 3 style reports + unlimited regenerations.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="font-display text-2xl font-bold text-white">$7.99</span>
                      <span className="font-body text-[11px] text-[#B8C4D8]/80">/mo</span>
                    </div>
                    <span className="font-body text-[10px] text-[#C9A96E]">Cancel anytime</span>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold font-body shadow-lg group-hover:brightness-110 transition-all disabled:opacity-70"
                  style={{
                    background:
                      "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)",
                  }}>
                  {isChecking ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Checking access...
                    </span>
                  ) : (
                    <>
                      <Gem className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      Unlock Complete Report
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>

              <p className="text-center font-body text-[11px] text-[#B8C4D8]/60 pt-1">
                Secure checkout · Instant access · Join thousands who've found their signature look
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}