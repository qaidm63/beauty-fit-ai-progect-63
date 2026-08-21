import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Palette, Sparkles, Heart, Copy, Check } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getColorUniverse, type LipstickItem } from '@/api/lipsticks';

const COLOR_FAMILIES = [
  { id: 'nude', label: 'Nude', emoji: '🤎', color: '#C4A882', gradient: 'from-amber-100 to-orange-50', description: 'Effortless everyday elegance' },
  { id: 'mauve', label: 'Mauve', emoji: '💜', color: '#9B6B8A', gradient: 'from-purple-100 to-pink-50', description: 'Sophisticated dusty romance' },
  { id: 'milk-tea', label: 'Milk Tea', emoji: '🧋', color: '#B89A7E', gradient: 'from-amber-50 to-yellow-50', description: 'Soft warmth, cozy vibes' },
  { id: 'rose', label: 'Rose', emoji: '🌹', color: '#C76B7E', gradient: 'from-rose-100 to-pink-50', description: 'Classic feminine beauty' },
  { id: 'berry', label: 'Berry', emoji: '🫐', color: '#8B3A62', gradient: 'from-fuchsia-100 to-purple-50', description: 'Bold & dramatic depth' },
  { id: 'terracotta', label: 'Terracotta', emoji: '🧱', color: '#B85C3A', gradient: 'from-orange-100 to-amber-50', description: 'Earthy warmth & character' },
  { id: 'chili', label: 'Chili', emoji: '🌶️', color: '#C23B22', gradient: 'from-red-100 to-orange-50', description: 'Fiery confidence & power' },
  { id: 'coral', label: 'Coral', emoji: '🪸', color: '#E8735A', gradient: 'from-orange-100 to-rose-50', description: 'Fresh tropical energy' },
  { id: 'wine', label: 'Wine', emoji: '🍷', color: '#722F37', gradient: 'from-red-200 to-purple-100', description: 'Deep luxurious allure' },
  { id: 'plum', label: 'Plum', emoji: '🍇', color: '#6B3A5E', gradient: 'from-purple-200 to-fuchsia-100', description: 'Mysterious & enchanting' },
  { id: 'red', label: 'Red', emoji: '❤️', color: '#C41E3A', gradient: 'from-red-100 to-rose-50', description: 'Timeless statement color' },
  { id: 'pink', label: 'Pink', emoji: '🩷', color: '#E75480', gradient: 'from-pink-100 to-rose-50', description: 'Playful & youthful charm' },
  { id: 'dusty-rose', label: 'Dusty Rose', emoji: '🌸', color: '#B5727E', gradient: 'from-rose-100 to-stone-50', description: 'Muted romantic softness' },
  { id: 'mlbb', label: 'MLBB', emoji: '👄', color: '#A8626D', gradient: 'from-rose-50 to-amber-50', description: 'Your lips but better' },
  { id: 'brown', label: 'Brown', emoji: '🤎', color: '#7B4B3A', gradient: 'from-amber-200 to-orange-100', description: '90s nostalgia & edge' },
  { id: 'orange', label: 'Orange', emoji: '🍊', color: '#E8762A', gradient: 'from-orange-100 to-yellow-50', description: 'Vibrant sunny warmth' },
];

export default function ColorUniversePage() {
  const [activeFamily, setActiveFamily] = useState('nude');
  const [lipsticks, setLipsticks] = useState<LipstickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchFamily = useCallback(async (family: string, pageNum: number) => {
    setLoading(true);
    try {
      const data = await getColorUniverse(family, pageNum, 60);
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

  useEffect(() => {
    fetchFamily(activeFamily, 1);
  }, [activeFamily, fetchFamily]);

  const activeMeta = COLOR_FAMILIES.find((f) => f.id === activeFamily);

  const copyHex = (hex: string, id: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF6EE] via-[#F7EFE5] to-[#F3EAD9]">
      <Navbar />
      <div className="pt-24 pb-16 px-4 max-w-[1400px] mx-auto">
        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FEF0E6] text-[#B8706A] text-xs font-semibold mb-4">
            <Palette className="w-3.5 h-3.5" />
            Color Universe
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#2D2226] mb-3">
            Explore the World of Color
          </h1>
          <p className="font-body text-base text-[#7A6B63] max-w-2xl mx-auto">
            Dive into curated color families. From soft nudes to bold chilis — find shades that speak to your style.
          </p>
        </div>

        {/* Color Family Cards - Horizontal Scroll */}
        <div className="mb-10">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-1">
            {COLOR_FAMILIES.map((fam) => (
              <button
                key={fam.id}
                onClick={() => setActiveFamily(fam.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-2xl min-w-[120px] transition-all duration-300 ${
                  activeFamily === fam.id
                    ? 'bg-white shadow-lg scale-105 ring-2'
                    : 'bg-white/60 hover:bg-white/90 hover:shadow-md hover:scale-[1.02]'
                }`}
                style={activeFamily === fam.id ? { borderColor: fam.color, boxShadow: `0 8px 25px ${fam.color}20` } : undefined}
              >
                <div
                  className="w-10 h-10 rounded-full shadow-inner flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${fam.color}20`, border: `2px solid ${fam.color}40` }}
                >
                  {fam.emoji}
                </div>
                <span className="text-xs font-semibold font-body text-[#2D2226] whitespace-nowrap">{fam.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Family Hero Banner */}
        {activeMeta && (
          <div
            className={`relative overflow-hidden rounded-3xl p-8 md:p-10 mb-10 bg-gradient-to-r ${activeMeta.gradient}`}
            style={{ borderLeft: `4px solid ${activeMeta.color}` }}
          >
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{activeMeta.emoji}</span>
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2D2226]">
                    {activeMeta.label}
                  </h2>
                </div>
                <p className="font-body text-sm text-[#5C4A42] max-w-md">
                  {activeMeta.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl shadow-lg"
                  style={{ backgroundColor: activeMeta.color }}
                />
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#2D2226]">{totalCount}</p>
                  <p className="text-xs font-body text-[#7A6B63]">shades</p>
                </div>
              </div>
            </div>
            {/* Decorative circles */}
            <div
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10"
              style={{ backgroundColor: activeMeta.color }}
            />
            <div
              className="absolute -right-5 -bottom-5 w-24 h-24 rounded-full opacity-5"
              style={{ backgroundColor: activeMeta.color }}
            />
          </div>
        )}

        {/* Color Gradient Bar */}
        {!loading && lipsticks.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#B8706A]" />
              <span className="text-xs font-semibold font-body text-[#5C4A42] uppercase tracking-wider">
                Shade Spectrum (light → dark)
              </span>
            </div>
            <div className="flex h-8 rounded-full overflow-hidden shadow-inner border border-white/50">
              {lipsticks.slice(0, 60).map((lip, i) => (
                <div
                  key={lip.id}
                  className="flex-1 min-w-0 cursor-pointer hover:scale-y-125 transition-transform"
                  style={{ backgroundColor: lip.color_hex }}
                  title={`${lip.shade_name} - ${lip.brand}`}
                  onClick={() => {
                    const el = document.getElementById(`lip-${lip.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setHoveredId(lip.id);
                    setTimeout(() => setHoveredId(null), 2000);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lipstick Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 text-[#8E9CC3] animate-spin" />
            <p className="text-sm font-body text-[#9A8A80]">Loading shades...</p>
          </div>
        ) : lipsticks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Palette className="w-12 h-12 text-[#D4C5B9]" />
            <p className="text-sm font-body text-[#9A8A80]">No shades found in this family.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {lipsticks.map((lip) => (
              <div
                key={lip.id}
                id={`lip-${lip.id}`}
                className={`group relative flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 hover:bg-white hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300 cursor-default ${
                  hoveredId === lip.id ? 'ring-2 ring-[#B8706A] shadow-xl -translate-y-1' : ''
                }`}
              >
                {/* Color swatch */}
                <div className="relative">
                  <div
                    className="w-14 h-14 rounded-full shadow-md group-hover:scale-110 transition-transform duration-300"
                    style={{
                      backgroundColor: lip.color_hex,
                      boxShadow: `0 4px 12px ${lip.color_hex}40`,
                    }}
                  />
                  {/* Copy hex button */}
                  <button
                    onClick={() => copyHex(lip.color_hex, lip.id)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                    title="Copy hex code"
                  >
                    {copiedId === lip.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#7A6B63]" />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="text-center w-full space-y-1">
                  <p className="text-xs font-body font-bold text-[#2D2226] truncate leading-tight">
                    {lip.shade_name}
                  </p>
                  <p className="text-[10px] font-body text-[#7A6B63] truncate">
                    {lip.brand}
                  </p>
                  <p className="text-[9px] font-body text-[#9A8A80] truncate italic">
                    {lip.product_line}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex gap-1 flex-wrap justify-center">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F5EDE6] text-[#7A6B63] font-medium">
                    {lip.finish}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F0F2F8] text-[#6B7A99] font-medium">
                    {lip.undertone}
                  </span>
                </div>

                {/* Hex code on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/5 text-[#5C4A42]">
                    {lip.color_hex}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            <button
              onClick={() => fetchFamily(activeFamily, page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/80 hover:bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-body text-[#5C4A42]"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchFamily(activeFamily, pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-body font-medium transition-all ${
                      page === pageNum
                        ? 'bg-[#B8706A] text-white shadow-md'
                        : 'bg-white/60 text-[#7A6B63] hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => fetchFamily(activeFamily, page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/80 hover:bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-body text-[#5C4A42]"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/60 backdrop-blur-sm">
            <Heart className="w-5 h-5 text-[#B8706A]" />
            <p className="text-sm font-body text-[#5C4A42] max-w-sm">
              Can't find your perfect shade? Try our <a href="/lipstick-fit" className="text-[#B8706A] font-semibold hover:underline">Lipstick Fit</a> tool to match colors from your selfie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}