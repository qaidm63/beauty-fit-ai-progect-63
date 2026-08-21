import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, Search, Filter, X, Loader2, ChevronLeft, ChevronRight, Palette, Copy, Sparkles, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { detectFaceLandmarks, loadImageFromBase64, type NormalizedLandmark } from '@/lib/faceLandmarker';
import {
  findFromImage,
  getDupes,
  getFilters,
  listLipsticks,
  recommendBySkin,
  searchByColor,
  semanticSearch,
  type FiltersData,
  type LipstickItem,
} from '@/api/lipsticks';

// MediaPipe lip landmark indices (outer + inner lip)
const OUTER_LIP_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
  409, 270, 269, 267, 0, 37, 39, 40, 185,
];
const INNER_LIP_INDICES = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
  415, 310, 311, 312, 13, 82, 81, 80, 191,
];

// Forehead/cheek landmark indices for skin tone detection
const FOREHEAD_INDICES = [10, 67, 109, 151, 338, 297];
const CHEEK_INDICES = [50, 101, 116, 280, 330, 345];

type ViewMode = 'browse' | 'dupes' | 'semantic' | 'category';

// Example queries for Smart Search
const EXAMPLE_QUERIES = [
  '冷调豆沙', 'warm nude matte', 'berry for cool skin',
  '适合黄皮的珊瑚色', 'deep red satin', 'mauve velvet',
];

export default function LipstickFitPage() {
  // Image state
  const [userImage, setUserImage] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Selected lipstick
  const [selectedLipstick, setSelectedLipstick] = useState<LipstickItem | null>(null);

  // Expanded card
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // View mode (no longer includes 'recommend')
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  // Lipstick browser state
  const [lipsticks, setLipsticks] = useState<LipstickItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter options via react-query (cached across navigation).
  const { data: filters } = useQuery({
    queryKey: ['lipstick-filters'],
    queryFn: getFilters,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Browse: whether user has triggered a search/filter
  const [browseActive, setBrowseActive] = useState(false);

  // Color palette picker
  const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
  const [paletteColor, setPaletteColor] = useState<string | null>(null);

  // Dupe state
  const [dupeSource, setDupeSource] = useState<LipstickItem | null>(null);

  // Semantic search state
  const [semanticQuery, setSemanticQuery] = useState('');
  const [parsedQuery, setParsedQuery] = useState<Record<string, string> | null>(null);
  const [semanticSearched, setSemanticSearched] = useState(false);

  // Category search state
  const [categoryFilters, setCategoryFilters] = useState<{
    color_family: string;
    undertone: string;
    finish: string;
    brand: string;
    color_depth: string;
    seasonal_palette: string;
  }>({ color_family: '', undertone: '', finish: '', brand: '', color_depth: '', seasonal_palette: '' });
  const [categoryKeyword, setCategoryKeyword] = useState('');
  const [categorySearched, setCategorySearched] = useState(false);

  // For You state (independent from tabs)
  const [forYouExpanded, setForYouExpanded] = useState(false);
  const [forYouResults, setForYouResults] = useState<LipstickItem[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);

  // Skin recommendation state
  const [skinAnalysis, setSkinAnalysis] = useState<{ undertone: string; depth: string } | null>(null);
  const [analyzingSkin, setAnalyzingSkin] = useState(false);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Scroll container ref for preventing scroll jumps
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find Shade state
  const [findShadeImage, setFindShadeImage] = useState<string | null>(null);
  const [findShadeDetecting, setFindShadeDetecting] = useState(false);
  const [findShadeSearching, setFindShadeSearching] = useState(false);
  const [findShadeError, setFindShadeError] = useState<string | null>(null);
  const [extractedLipColor, setExtractedLipColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [findShadeMatches, setFindShadeMatches] = useState<LipstickItem[]>([]);
  const findShadeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw color palette canvas - load spectrum image
  useEffect(() => {
    const canvas = paletteCanvasRef.current;
    if (!canvas || viewMode !== 'browse') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = '/assets/color-spectrum.png';
  }, [viewMode]);

  // Fetch lipsticks (browse mode - by color only now)
  const fetchLipsticks = useCallback(async (pageNum: number) => {
    setLoading(true);
    setBrowseActive(true);
    try {
      const data = await listLipsticks({ page: pageNum, page_size: 40 });
      setLipsticks(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
      setPage(pageNum);
    } catch {
      setLipsticks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch lipsticks by color (from palette click)
  const fetchByColor = useCallback(async (hex: string) => {
    setLoading(true);
    setBrowseActive(true);
    setPaletteColor(hex);
    try {
      const data = await searchByColor(hex, 20);
      const items = data.items || data.results || [];
      setLipsticks(items);
      setTotalPages(1);
      setTotalCount(items.length);
      setPage(1);
    } catch {
      setLipsticks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUri = ev.target?.result as string;
      setUserImage(dataUri);
      setDetectError(null);
      setDetecting(true);
      setSelectedLipstick(null);
      setSkinAnalysis(null);
      setForYouExpanded(false);
      setForYouResults([]);

      try {
        const img = await loadImageFromBase64(dataUri);
        imgRef.current = img;
        const result = await detectFaceLandmarks(img);
        setLandmarks(result.landmarks);
      } catch (err) {
        setDetectError(err instanceof Error ? err.message : 'Face detection failed');
        setLandmarks(null);
      } finally {
        setDetecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Analyze skin tone from uploaded image
  const analyzeSkinTone = useCallback(async () => {
    if (!imgRef.current || !landmarks) return;

    setAnalyzingSkin(true);
    setForYouLoading(true);
    setForYouExpanded(true);
    try {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Sample skin pixels from forehead and cheeks
      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      const allIndices = [...FOREHEAD_INDICES, ...CHEEK_INDICES];

      for (const idx of allIndices) {
        const lm = landmarks[idx];
        const px = Math.round(lm.x * w);
        const py = Math.round(lm.y * h);

        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const sx = Math.min(Math.max(px + dx, 0), w - 1);
            const sy = Math.min(Math.max(py + dy, 0), h - 1);
            const pixel = ctx.getImageData(sx, sy, 1, 1).data;
            totalR += pixel[0];
            totalG += pixel[1];
            totalB += pixel[2];
            count++;
          }
        }
      }

      const avgR = totalR / count;
      const avgG = totalG / count;
      const avgB = totalB / count;

      // Determine undertone based on RGB ratios
      let undertone: string;
      const warmth = (avgR - avgB) / 255;
      if (warmth > 0.08) {
        undertone = 'warm';
      } else if (warmth < -0.02) {
        undertone = 'cool';
      } else {
        undertone = 'neutral';
      }

      // Determine depth based on luminance
      const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
      let depth: string;
      if (luminance > 0.65) {
        depth = 'light';
      } else if (luminance > 0.45) {
        depth = 'medium';
      } else {
        depth = 'deep';
      }

      setSkinAnalysis({ undertone, depth });

      // Fetch recommendations
      const data = await recommendBySkin(undertone, depth, 1, 40);

      // Filter: only 95%+ match, or top 5 if none reach 95%
      let items: LipstickItem[] = data.items || [];
      const highMatch = items.filter((item: LipstickItem) => (item.match_score ?? 0) >= 95);
      if (highMatch.length > 0) {
        items = highMatch;
      } else {
        items = items.slice(0, 5);
      }

      setForYouResults(items);
    } catch {
      setDetectError('Skin analysis failed');
    } finally {
      setAnalyzingSkin(false);
      setForYouLoading(false);
    }
  }, [landmarks]);

  // Find dupes for a lipstick
  const findDupes = useCallback(async (lipstick: LipstickItem) => {
    setLoading(true);
    setDupeSource(lipstick);
    setViewMode('dupes');
    try {
      const data = await getDupes(lipstick.id, 10);
      setLipsticks(data.dupes || []);
      setTotalPages(1);
      setTotalCount(data.dupes?.length || 0);
      setPage(1);
    } catch {
      setLipsticks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Semantic search (text-based AI search only, no filters)
  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setViewMode('semantic');
    setSemanticSearched(true);
    try {
      const data = await semanticSearch(query.trim(), 1, 10);
      const items = (data.items || []).slice(0, 10);
      setLipsticks(items);
      setParsedQuery(data.parsed_query || null);
      setTotalPages(1);
      setTotalCount(items.length);
      setPage(1);
    } catch {
      setLipsticks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Category search (filter-based + keyword)
  const handleCategorySearch = useCallback(async (pageNum: number = 1) => {
    const hasAny = Object.values(categoryFilters).some(Boolean) || categoryKeyword.trim();
    if (!hasAny) return;
    setLoading(true);
    setCategorySearched(true);
    try {
      const data = await listLipsticks({
        page: pageNum,
        page_size: 40,
        keyword: categoryKeyword.trim() || undefined,
        brand: categoryFilters.brand || undefined,
        color_family: categoryFilters.color_family || undefined,
        undertone: categoryFilters.undertone || undefined,
        finish: categoryFilters.finish || undefined,
        color_depth: categoryFilters.color_depth || undefined,
        seasonal_palette: categoryFilters.seasonal_palette || undefined,
      });
      setLipsticks(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
      setPage(pageNum);
    } catch {
      setLipsticks([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilters, categoryKeyword]);

  // Draw lip overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !landmarks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    if (!selectedLipstick) return;

    const { r, g, b } = selectedLipstick.color_rgb;
    const finish = selectedLipstick.finish;

    let opacity = 0.55;
    if (finish === 'matte') opacity = 0.65;
    else if (finish === 'glossy' || finish === 'watery') opacity = 0.4;
    else if (finish === 'velvet' || finish === 'satin') opacity = 0.55;
    else if (finish === 'sheer') opacity = 0.3;
    else if (finish === 'cream') opacity = 0.5;

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Outer lip fill
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    const outerPts = OUTER_LIP_INDICES.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
    ctx.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.restore();

    // Inner lip
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = opacity * 0.85;
    ctx.beginPath();
    const innerPts = INNER_LIP_INDICES.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
    ctx.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) ctx.lineTo(innerPts[i].x, innerPts[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.restore();

    // Overlay blend
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = opacity * 0.4;
    ctx.beginPath();
    ctx.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.restore();

    // Glossy highlight
    if (finish === 'glossy' || finish === 'watery') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.2;
      const centerX = outerPts.reduce((s, p) => s + p.x, 0) / outerPts.length;
      const minY = Math.min(...outerPts.map((p) => p.y));
      const maxY = Math.max(...outerPts.map((p) => p.y));
      const lipHeight = maxY - minY;
      const grad = ctx.createRadialGradient(centerX, minY + lipHeight * 0.3, 0, centerX, minY + lipHeight * 0.3, lipHeight * 0.6);
      grad.addColorStop(0, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
  }, [landmarks, selectedLipstick]);

  const handleBrowseSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleSemanticSearch(semanticQuery);
  };

  // Find Shade: extract lip color from image
  const extractLipColorFromImage = useCallback((
    img: HTMLImageElement,
    lms: NormalizedLandmark[]
  ): { r: number; g: number; b: number } => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    for (const idx of INNER_LIP_INDICES) {
      const lm = lms[idx];
      const px = Math.round(lm.x * w);
      const py = Math.round(lm.y * h);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = Math.min(Math.max(px + dx, 0), w - 1);
          const sy = Math.min(Math.max(py + dy, 0), h - 1);
          const pixel = ctx.getImageData(sx, sy, 1, 1).data;
          totalR += pixel[0];
          totalG += pixel[1];
          totalB += pixel[2];
          count++;
        }
      }
    }
    return {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count),
    };
  }, []);

  // Find Shade: handle image upload
  const handleFindShadeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUri = ev.target?.result as string;
      setFindShadeImage(dataUri);
      setFindShadeError(null);
      setFindShadeMatches([]);
      setExtractedLipColor(null);
      setFindShadeDetecting(true);

      try {
        const img = await loadImageFromBase64(dataUri);

        // Draw on display canvas
        const displayCanvas = findShadeCanvasRef.current;
        if (displayCanvas) {
          const ctx = displayCanvas.getContext('2d')!;
          displayCanvas.width = img.naturalWidth;
          displayCanvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
        }

        // Detect face landmarks
        const result = await detectFaceLandmarks(img);
        setFindShadeDetecting(false);

        // Extract lip color
        const lipColor = extractLipColorFromImage(img, result.landmarks);
        setExtractedLipColor(lipColor);

        // Search for matches
        setFindShadeSearching(true);
        const data = await findFromImage(lipColor, 10);
        setFindShadeMatches(data.matches || []);
      } catch (err) {
        setFindShadeError(err instanceof Error ? err.message : 'Processing failed');
      } finally {
        setFindShadeDetecting(false);
        setFindShadeSearching(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Find Shade: use existing selfie
  const useSelfieForFindShade = async () => {
    if (!userImage || !landmarks) return;
    setFindShadeImage(userImage);
    setFindShadeError(null);
    setFindShadeMatches([]);
    setExtractedLipColor(null);

    try {
      const img = await loadImageFromBase64(userImage);

      const displayCanvas = findShadeCanvasRef.current;
      if (displayCanvas) {
        const ctx = displayCanvas.getContext('2d')!;
        displayCanvas.width = img.naturalWidth;
        displayCanvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }

      const lipColor = extractLipColorFromImage(img, landmarks);
      setExtractedLipColor(lipColor);

      setFindShadeSearching(true);
      const data = await findFromImage(lipColor, 10);
      setFindShadeMatches(data.matches || []);
    } catch (err) {
      setFindShadeError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setFindShadeSearching(false);
    }
  };

  const clearSemanticSearch = () => {
    setSemanticQuery('');
    setSemanticSearched(false);
    setLipsticks([]);
    setTotalCount(0);
    setParsedQuery(null);
  };

  const clearCategoryFilters = () => {
    setCategoryFilters({ color_family: '', undertone: '', finish: '', brand: '', color_depth: '', seasonal_palette: '' });
    setCategoryKeyword('');
    setCategorySearched(false);
    setLipsticks([]);
    setTotalCount(0);
  };

  const backToBrowse = () => {
    setViewMode('browse');
    setDupeSource(null);
    setParsedQuery(null);
    setSemanticSearched(false);
    setCategorySearched(false);
    setBrowseActive(false);
    setLipsticks([]);
    setTotalCount(0);
    setPaletteColor(null);
  };

  const hasCategoryFilters = Object.values(categoryFilters).some(Boolean) || categoryKeyword.trim().length > 0;

  // Handle palette canvas click
  const handlePaletteClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
    fetchByColor(hex);
  };

  // Handle expand without scrolling
  const handleExpandCard = (lipId: string) => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollTop = container.scrollTop;
      setExpandedCardId(expandedCardId === lipId ? null : lipId);
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        container.scrollTop = scrollTop;
      });
    } else {
      setExpandedCardId(expandedCardId === lipId ? null : lipId);
    }
  };

  // Lipstick Card Component - Horizontal layout with full dimension expand
  const LipstickCard = ({ lip, showDupeButton, alwaysShowDupe }: { lip: LipstickItem; showDupeButton: boolean; alwaysShowDupe?: boolean }) => {
    const isExpanded = expandedCardId === lip.id;
    const isSelected = selectedLipstick?.id === lip.id;

    return (
      <div className={`group relative rounded-xl border transition-all ${isSelected ? 'border-[#8E9CC3] bg-[#F0F2F8] shadow-md' : 'border-[#E8DDD6] bg-white hover:shadow-md hover:border-[#D4C4B8]'}`}>
        {/* Horizontal card row */}
        <div className="flex items-center gap-3 p-3">
          {/* Color swatch - clickable to try on */}
          <button
            onClick={() => { if (landmarks) setSelectedLipstick(lip); }}
            disabled={!landmarks}
            className={`flex-shrink-0 ${!landmarks ? 'cursor-default' : 'cursor-pointer'}`}
            title={!landmarks ? 'Upload a photo to try on' : 'Try this shade'}
          >
            <div
              className="w-10 h-10 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: lip.color_hex }}
            />
          </button>

          {/* Name + Brand + Finish */}
          <button
            onClick={() => { if (landmarks) setSelectedLipstick(lip); }}
            disabled={!landmarks}
            className={`min-w-0 flex-1 text-left ${!landmarks ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <p className="text-sm font-semibold text-[#2D2226] truncate font-body">{lip.shade_name}</p>
            <p className="text-xs text-[#7A6B63] truncate font-body">{lip.brand} · {lip.finish || '—'}</p>
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Find Dupes button */}
            {showDupeButton && (
              <button
                onClick={(e) => { e.stopPropagation(); findDupes(lip); }}
                className={`px-2 py-1 rounded-md bg-[#B8706A]/10 hover:bg-[#B8706A]/20 text-[#B8706A] text-[10px] font-medium font-body flex items-center gap-1 transition-all ${alwaysShowDupe ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                title="Find Dupes"
              >
                <Copy className="w-3 h-3" /> Dupes
              </button>
            )}

            {/* Expand/collapse button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleExpandCard(lip.id); }}
              className="p-1 rounded-md hover:bg-[#F5EDE6] transition-colors"
              title={isExpanded ? 'Collapse' : 'View details'}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#9A8A80]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9A8A80]" />}
            </button>
          </div>
        </div>

        {/* Expanded details - all dimensions (English only) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="px-4 pb-4 pt-2 border-t border-[#F0EAE3]">
            {/* Section: Basic Info */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#9A8A80] uppercase tracking-wider mb-1.5 font-body">Basic Info</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Brand:</span>
                  <span className="text-[11px] text-[#2D2226] font-body truncate">{lip.brand || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Product Line:</span>
                  <span className="text-[11px] text-[#2D2226] font-body truncate">{lip.product_line || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Shade Name:</span>
                  <span className="text-[11px] text-[#2D2226] font-body truncate">{lip.shade_name || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Finish:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">{lip.finish || '—'}</span>
                </div>
              </div>
            </div>

            {/* Section: Color Properties */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#9A8A80] uppercase tracking-wider mb-1.5 font-body">Color Properties</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Hex:</span>
                  <span className="text-[11px] text-[#2D2226] font-mono">{lip.color_hex || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Color Family:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">{lip.color_family?.replace(/-/g, ' ') || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Undertone:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">{lip.undertone || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Color Depth:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">{lip.color_depth || '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Brightness:</span>
                  <span className="text-[11px] text-[#2D2226] font-mono">{lip.brightness != null ? lip.brightness.toFixed(1) : '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Saturation:</span>
                  <span className="text-[11px] text-[#2D2226] font-mono">{lip.saturation != null ? lip.saturation.toFixed(1) : '—'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Hue Degree:</span>
                  <span className="text-[11px] text-[#2D2226] font-mono">{lip.hue_degree != null ? lip.hue_degree.toFixed(1) + '°' : '—'}</span>
                </div>
              </div>
            </div>

            {/* Section: Recommendations */}
            <div>
              <p className="text-[10px] font-semibold text-[#9A8A80] uppercase tracking-wider mb-1.5 font-body">Recommendations</p>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Skin Undertone:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">
                    {lip.recommended_skin_undertone?.length ? lip.recommended_skin_undertone.join(', ') : '—'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Skin Depth:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">
                    {lip.recommended_skin_depth?.length ? lip.recommended_skin_depth.join(', ') : '—'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-[#9A8A80] font-body whitespace-nowrap">Seasonal Palette:</span>
                  <span className="text-[11px] text-[#2D2226] font-body capitalize">{lip.seasonal_palette || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF6EE] via-[#F7EFE5] to-[#F3EAD9]">
      <Navbar />
      <div className="pt-24 pb-12 px-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0E6F6] text-[#9B6FA8] text-xs font-semibold mb-3">
            <Palette className="w-3.5 h-3.5" />
            AI Lipstick Try-On
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#2D2226] mb-2">
            Lipstick Fit
          </h1>
          <p className="font-body text-sm text-[#7A6B63] max-w-lg mx-auto">
            Upload your photo and try on 5000+ lipstick shades instantly. Find dupes, get personalized recommendations, or search in natural language.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Photo + Canvas */}
          <div className="space-y-4">
            {!userImage ? (
              <label className="flex flex-col items-center justify-center w-full aspect-[3/4] max-h-[520px] rounded-2xl border-2 border-dashed border-[#D4C4B8] bg-white/60 cursor-pointer hover:border-[#B8706A] hover:bg-white/80 transition-all">
                <Upload className="w-10 h-10 text-[#B8706A] mb-3" />
                <span className="font-body text-sm font-medium text-[#5C4A42]">
                  Upload a front-facing selfie
                </span>
                <span className="font-body text-xs text-[#9A8A80] mt-1">
                  JPG, PNG • Clear lighting recommended
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            ) : (
              <div className="relative w-full rounded-2xl overflow-hidden bg-black/5 shadow-lg">
                {detecting && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-[#B8706A] animate-spin" />
                      <span className="text-sm font-body text-[#5C4A42]">Detecting face...</span>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="w-full h-auto max-h-[520px] object-contain" />
                <label className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-white/90 shadow-md text-xs font-medium text-[#5C4A42] cursor-pointer hover:bg-white transition-all">
                  Change Photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
                </label>
                {selectedLipstick && (
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm shadow-md">
                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: selectedLipstick.color_hex }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-semibold text-[#2D2226] truncate">{selectedLipstick.shade_name}</p>
                      <p className="font-body text-xs text-[#7A6B63] truncate">{selectedLipstick.brand} • {selectedLipstick.finish}</p>
                    </div>
                    <button onClick={() => setSelectedLipstick(null)} className="p-1 rounded-full hover:bg-[#F5EDE6] transition-colors">
                      <X className="w-4 h-4 text-[#7A6B63]" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {detectError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-body">{detectError}</div>
            )}

            {landmarks && !selectedLipstick && (
              <div className="p-3 rounded-xl bg-[#F0F2F8] border border-[#D8DCE8] text-sm text-[#5C4A42] font-body text-center">
                ✨ Face detected! Browse lipsticks and tap a shade to try it on.
              </div>
            )}

            {/* Skin tone recommendation button */}
            {landmarks && (
              <button
                onClick={analyzeSkinTone}
                disabled={analyzingSkin}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E] text-white text-sm font-semibold font-body shadow-md hover:shadow-lg hover:brightness-110 transition-all disabled:opacity-60"
              >
                {analyzingSkin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzingSkin ? 'Analyzing Skin Tone...' : 'Get Personalized Recommendations'}
              </button>
            )}

            {/* Skin analysis result */}
            {skinAnalysis && (
              <div className="p-4 rounded-xl bg-white/80 border border-[#E8DDD6] shadow-sm">
                <p className="font-body text-sm font-semibold text-[#2D2226] mb-2">Your Skin Analysis</p>
                <div className="flex gap-3">
                  <span className="px-3 py-1 rounded-full bg-[#FEF0E6] text-[#B8706A] text-xs font-medium capitalize">
                    {skinAnalysis.undertone} undertone
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#F0F2F8] text-[#6B7A99] text-xs font-medium capitalize">
                    {skinAnalysis.depth} depth
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Lipstick Browser */}
          <div className="flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DDD6] overflow-hidden lg:max-h-[calc(100vh-8rem)]">

            {/* For You section - expandable, above tabs */}
            {forYouExpanded && (
              <div className="border-b border-[#E8DDD6]">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#5A8A5C]" />
                      <span className="text-sm font-semibold font-body text-[#2D2226]">For You</span>
                      <span className="text-xs font-body text-[#9A8A80]">
                        ({forYouResults.length} picks)
                      </span>
                    </div>
                    <button
                      onClick={() => setForYouExpanded(false)}
                      className="p-1 rounded-md hover:bg-[#F5EDE6] transition-colors"
                      title="Collapse"
                    >
                      <X className="w-4 h-4 text-[#9A8A80]" />
                    </button>
                  </div>

                  {forYouLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-[#5A8A5C] animate-spin" />
                    </div>
                  ) : forYouResults.length === 0 ? (
                    <p className="text-xs text-[#9A8A80] font-body text-center py-4">No recommendations yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {forYouResults.map((lip) => (
                        <LipstickCard
                          key={lip.id}
                          lip={lip}
                          showDupeButton={true}
                          alwaysShowDupe={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode tabs */}
            <div className="flex border-b border-[#E8DDD6] overflow-x-auto">
              <button
                onClick={backToBrowse}
                className={`px-4 py-2.5 text-xs font-medium font-body whitespace-nowrap transition-colors ${viewMode === 'browse' ? 'text-[#8E9CC3] border-b-2 border-[#8E9CC3]' : 'text-[#9A8A80] hover:text-[#5C4A42]'}`}
              >
                Browse
              </button>
              <button
                onClick={() => { setViewMode('category'); setCategorySearched(false); setLipsticks([]); setTotalCount(0); }}
                className={`px-4 py-2.5 text-xs font-medium font-body whitespace-nowrap transition-colors ${viewMode === 'category' ? 'text-[#8E9CC3] border-b-2 border-[#8E9CC3]' : 'text-[#9A8A80] hover:text-[#5C4A42]'}`}
              >
                Category
              </button>
              <button
                onClick={() => { setViewMode('semantic'); setSemanticSearched(false); setLipsticks([]); setTotalCount(0); }}
                className={`px-4 py-2.5 text-xs font-medium font-body whitespace-nowrap transition-colors ${viewMode === 'semantic' ? 'text-[#8E9CC3] border-b-2 border-[#8E9CC3]' : 'text-[#9A8A80] hover:text-[#5C4A42]'}`}
              >
                Smart Search
              </button>
              {viewMode === 'dupes' && (
                <button className="px-4 py-2.5 text-xs font-medium font-body whitespace-nowrap text-[#B8706A] border-b-2 border-[#B8706A]">
                  Dupes
                </button>
              )}
            </div>

            {/* Search bar / controls */}
            <div className="p-4 border-b border-[#E8DDD6]">
              {viewMode === 'semantic' ? (
                <div className="space-y-3">
                  <form onSubmit={handleBrowseSearch} className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8A80]" />
                      <input
                        type="text"
                        value={semanticQuery}
                        onChange={(e) => setSemanticQuery(e.target.value)}
                        placeholder="Describe your ideal lip color..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F9F5F0] border border-[#E8DDD6] text-sm font-body text-[#2D2226] placeholder:text-[#B5A89E] focus:outline-none focus:border-[#8E9CC3] transition-colors"
                      />
                    </div>
                    {parsedQuery && Object.keys(parsedQuery).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(parsedQuery).map(([key, val]) => (
                          <span key={key} className="px-2 py-0.5 rounded-full bg-[#F0F2F8] text-[10px] font-body text-[#6B7A99]">
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </form>

                  {semanticSearched && (
                    <button onClick={clearSemanticSearch} className="text-xs text-[#B8706A] font-medium hover:underline font-body">Clear</button>
                  )}

                  {/* Example query chips */}
                  {!semanticSearched && (
                    <div className="space-y-2">
                      <p className="text-xs text-[#9A8A80] font-body">Try these examples:</p>
                      <div className="flex flex-wrap gap-2">
                        {EXAMPLE_QUERIES.map((q) => (
                          <button
                            key={q}
                            onClick={() => { setSemanticQuery(q); handleSemanticSearch(q); }}
                            className="px-3 py-1.5 rounded-full bg-[#F0F2F8] border border-[#D8DCE8] text-xs font-body text-[#6B7A99] hover:bg-[#E8ECF5] hover:border-[#8E9CC3] transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : viewMode === 'category' ? (
                <div className="space-y-3">
                  {/* Keyword search */}
                  <form onSubmit={(e) => { e.preventDefault(); handleCategorySearch(1); }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8A80]" />
                      <input
                        type="text"
                        value={categoryKeyword}
                        onChange={(e) => setCategoryKeyword(e.target.value)}
                        placeholder="Keyword search (e.g. dior 999, mac ruby)..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F9F5F0] border border-[#E8DDD6] text-sm font-body text-[#2D2226] placeholder:text-[#B5A89E] focus:outline-none focus:border-[#8E9CC3] transition-colors"
                      />
                    </div>
                  </form>
                  <p className="text-xs text-[#9A8A80] font-body">Or filter by category:</p>
                  {filters && (
                    <div className="grid grid-cols-2 gap-2">
                      <select value={categoryFilters.brand} onChange={(e) => setCategoryFilters((f) => ({ ...f, brand: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Brands</option>
                        {filters.brands.map((br) => (<option key={br} value={br}>{br}</option>))}
                      </select>
                      <select value={categoryFilters.color_family} onChange={(e) => setCategoryFilters((f) => ({ ...f, color_family: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Color Families</option>
                        {filters.color_families.map((cf) => (<option key={cf} value={cf}>{cf.replace(/-/g, ' ')}</option>))}
                      </select>
                      <select value={categoryFilters.undertone} onChange={(e) => setCategoryFilters((f) => ({ ...f, undertone: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Undertones</option>
                        {filters.undertones.map((ut) => (<option key={ut} value={ut}>{ut}</option>))}
                      </select>
                      <select value={categoryFilters.finish} onChange={(e) => setCategoryFilters((f) => ({ ...f, finish: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Finishes</option>
                        {filters.finishes.map((fin) => (<option key={fin} value={fin}>{fin}</option>))}
                      </select>
                      <select value={categoryFilters.color_depth} onChange={(e) => setCategoryFilters((f) => ({ ...f, color_depth: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Depths</option>
                        {filters.color_depths?.map((cd) => (<option key={cd} value={cd}>{cd}</option>))}
                      </select>
                      <select value={categoryFilters.seasonal_palette} onChange={(e) => setCategoryFilters((f) => ({ ...f, seasonal_palette: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#F9F5F0] border border-[#E8DDD6] text-xs font-body text-[#5C4A42] focus:outline-none focus:border-[#8E9CC3]">
                        <option value="">All Seasons</option>
                        {filters.seasonal_palettes?.map((sp) => (<option key={sp} value={sp}>{sp}</option>))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCategorySearch(1)}
                      disabled={!hasCategoryFilters}
                      className="px-4 py-2 rounded-lg bg-[#8E9CC3] text-white text-xs font-medium font-body hover:bg-[#7A8AB5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Search
                    </button>
                    {hasCategoryFilters && (
                      <button onClick={clearCategoryFilters} className="text-xs text-[#B8706A] font-medium hover:underline font-body">Clear all</button>
                    )}
                  </div>
                </div>
              ) : viewMode === 'dupes' && dupeSource ? (
                <div className="flex items-center gap-3">
                  <button onClick={backToBrowse} className="text-xs text-[#8E9CC3] font-medium hover:underline">← Back</button>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: dupeSource.color_hex }} />
                    <span className="text-xs font-body text-[#5C4A42] truncate">
                      Dupes for <strong>{dupeSource.shade_name}</strong> by {dupeSource.brand}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Browse mode: only color spectrum */}
                  <div>
                    <p className="text-xs text-[#9A8A80] font-body mb-2">Click on the color spectrum to find similar shades:</p>
                    <div className="relative rounded-xl overflow-hidden shadow-sm border border-[#E8DDD6]">
                      <canvas
                        ref={paletteCanvasRef}
                        width={618}
                        height={264}
                        className="w-full h-auto cursor-crosshair"
                        onClick={handlePaletteClick}
                      />
                      {paletteColor && (
                        <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 shadow-sm">
                          <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: paletteColor }} />
                          <span className="text-[10px] font-mono text-[#5C4A42]">{paletteColor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {browseActive && viewMode === 'browse' && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-body text-[#9A8A80]">
                    {totalCount.toLocaleString()} shades found
                  </span>
                </div>
              )}
              {viewMode === 'category' && categorySearched && (
                <div className="mt-2">
                  <span className="text-xs font-body text-[#9A8A80]">
                    {totalCount.toLocaleString()} results
                  </span>
                </div>
              )}
              {viewMode === 'dupes' && (
                <div className="mt-2">
                  <span className="text-xs font-body text-[#9A8A80]">
                    {totalCount.toLocaleString()} dupes found
                  </span>
                </div>
              )}
              {viewMode === 'semantic' && semanticSearched && (
                <div className="mt-2">
                  <span className="text-xs font-body text-[#9A8A80]">
                    {totalCount.toLocaleString()} results (top 10)
                  </span>
                </div>
              )}
            </div>

            {/* Lipstick grid */}
            <div className="flex-1 overflow-y-auto p-4" ref={scrollContainerRef}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#8E9CC3] animate-spin" />
                </div>
              ) : viewMode === 'browse' && !browseActive ? (
                <div className="text-center py-12 space-y-3">
                  <Palette className="w-8 h-8 text-[#D4C4B8] mx-auto" />
                  <p className="text-sm text-[#9A8A80] font-body">
                    Click on the color spectrum above to discover lipstick shades.
                  </p>
                </div>
              ) : viewMode === 'category' && !categorySearched ? (
                <div className="text-center py-12 space-y-3">
                  <Filter className="w-8 h-8 text-[#D4C4B8] mx-auto" />
                  <p className="text-sm text-[#9A8A80] font-body">
                    Select category filters above and click Search.
                  </p>
                </div>
              ) : viewMode === 'semantic' && !semanticSearched ? (
                <div className="text-center py-12 space-y-3">
                  <Search className="w-8 h-8 text-[#D4C4B8] mx-auto" />
                  <p className="text-sm text-[#9A8A80] font-body">
                    Describe your ideal lip color or click an example above.
                  </p>
                </div>
              ) : lipsticks.length === 0 ? (
                <div className="text-center py-12 text-sm text-[#9A8A80] font-body">
                  No lipsticks found. Try a different search or filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {lipsticks.map((lip) => (
                    <LipstickCard
                      key={lip.id}
                      lip={lip}
                      showDupeButton={viewMode === 'browse' || viewMode === 'semantic' || viewMode === 'category'}
                      alwaysShowDupe={false}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (viewMode === 'browse' && browseActive || viewMode === 'category' && categorySearched) && (
              <div className="flex items-center justify-center gap-3 p-3 border-t border-[#E8DDD6]">
                <button
                  onClick={() => viewMode === 'category' ? handleCategorySearch(page - 1) : fetchLipsticks(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg hover:bg-[#F5EDE6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[#5C4A42]" />
                </button>
                <span className="text-xs font-body text-[#7A6B63]">{page} / {totalPages}</span>
                <button
                  onClick={() => viewMode === 'category' ? handleCategorySearch(page + 1) : fetchLipsticks(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-[#F5EDE6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-[#5C4A42]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Find Shade Section ===== */}
      <div className="mt-8 max-w-[1200px] mx-auto px-4 pb-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8F0E6] text-[#5A8A5C] text-xs font-semibold mb-3">
            <Camera className="w-3.5 h-3.5" />
            Find Shade
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2D2226] mb-2">
            Find Lipstick from Photo
          </h2>
          <p className="font-body text-sm text-[#7A6B63] max-w-lg mx-auto">
            Upload any photo — selfie, influencer screenshot, or magazine image — and we'll identify the closest matching lipstick shades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-stretch">
          {/* Left: Upload + Preview */}
          <div className="flex flex-col gap-4">
            {!findShadeImage ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <label className="flex flex-col items-center justify-center w-full flex-1 min-h-[400px] rounded-2xl border-2 border-dashed border-[#D4C4B8] bg-white/60 cursor-pointer hover:border-[#B8706A] hover:bg-white/80 transition-all">
                  <Upload className="w-10 h-10 text-[#B8706A] mb-3" />
                  <span className="font-body text-sm font-medium text-[#5C4A42]">
                    Upload a photo with visible lips
                  </span>
                  <span className="font-body text-xs text-[#9A8A80] mt-1">
                    Selfie, influencer photo, screenshot
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFindShadeUpload}
                  />
                </label>
                {userImage && landmarks && (
                  <button
                    onClick={useSelfieForFindShade}
                    className="w-full py-2.5 rounded-xl bg-[#B8706A] text-white font-body text-sm font-medium hover:bg-[#A5605A] transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Use My Selfie Above
                  </button>
                )}
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black/5 shadow-lg">
                {(findShadeDetecting || findShadeSearching) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-[#B8706A] animate-spin" />
                      <span className="text-sm font-body text-[#5C4A42]">
                        {findShadeDetecting ? 'Detecting lips...' : 'Finding matches...'}
                      </span>
                    </div>
                  </div>
                )}
                <canvas ref={findShadeCanvasRef} className="w-full h-auto max-h-[400px] object-contain" />
                <label className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-white/90 shadow-md text-xs font-medium text-[#5C4A42] cursor-pointer hover:bg-white transition-all">
                  Change Photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFindShadeUpload}
                  />
                </label>
              </div>
            )}

            {/* Extracted color display */}
            {extractedLipColor && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/80 shadow-sm border border-[#E8DDD6]">
                <div
                  className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: `rgb(${extractedLipColor.r}, ${extractedLipColor.g}, ${extractedLipColor.b})` }}
                />
                <div>
                  <p className="font-body text-sm font-semibold text-[#2D2226]">Detected Lip Color</p>
                  <p className="font-body text-xs text-[#7A6B63]">
                    RGB({extractedLipColor.r}, {extractedLipColor.g}, {extractedLipColor.b})
                  </p>
                </div>
              </div>
            )}

            {findShadeError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-body">
                {findShadeError}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DDD6] p-5 overflow-y-auto">
            <h3 className="font-display text-lg font-bold text-[#2D2226] mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A96E]" />
              Closest Matches
            </h3>

            {findShadeMatches.length === 0 && !findShadeSearching && (
              <div className="text-center py-12 text-sm text-[#9A8A80] font-body">
                Upload a photo to find matching lipsticks
              </div>
            )}

            {findShadeMatches.length > 0 && (
              <div className="space-y-3">
                {findShadeMatches.map((match, idx) => (
                  <div
                    key={match.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#F9F5F0] hover:bg-[#F5EDE6] transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedLipstick(match);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span className="text-xs font-bold text-[#9A8A80] w-5">#{idx + 1}</span>
                    <div
                      className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: match.color_hex }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-[#2D2226] truncate">
                        {match.shade_name}
                      </p>
                      <p className="font-body text-xs text-[#7A6B63] truncate">
                        {match.brand} • {match.product_line}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] font-body text-[#9A8A80]">
                        ΔE {match.distance?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}