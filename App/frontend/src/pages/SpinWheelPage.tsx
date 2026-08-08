import { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Sparkles, RotateCcw, Gift, Trophy, Heart, Star } from 'lucide-react';

interface Prize {
  label: string;
  emoji: string;
  color: string;
  description: string;
}

const PRIZES: Prize[] = [
  { label: 'Glow Up', emoji: '✨', color: '#B8706A', description: 'Try a bold new lipstick shade today!' },
  { label: 'Spa Day', emoji: '🧖‍♀️', color: '#8E9CC3', description: 'Treat yourself to a relaxing skincare session.' },
  { label: 'Self-Care', emoji: '💆‍♀️', color: '#C9A96E', description: 'Take 10 minutes for a face massage and deep breathing.' },
  { label: 'New Look', emoji: '💄', color: '#A88B9D', description: 'Experiment with a new makeup style you have never tried.' },
  { label: 'Hydration', emoji: '💧', color: '#7BA3A8', description: 'Drink a full glass of water and refresh your glow.' },
  { label: 'Confidence', emoji: '💖', color: '#C4917B', description: 'Wear the outfit that makes you feel unstoppable.' },
  { label: 'Beauty Nap', emoji: '😴', color: '#9B8AA0', description: 'Get 8 hours of sleep for that natural beauty rest.' },
  { label: 'Radiance', emoji: '🌟', color: '#B8A88A', description: 'Apply a brightening serum and let your skin shine.' },
];

export default function SpinWheelPage() {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spins, setSpins] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const segmentAngle = 360 / PRIZES.length;

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setShowResult(false);
    setResult(null);

    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle = extraSpins * 360 + (360 - prizeIndex * segmentAngle) - segmentAngle / 2;
    const startRotation = rotation;
    const totalRotation = startRotation + targetAngle;
    const duration = 5000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentAngle = startRotation + targetAngle * easedProgress;
      setRotation(currentAngle);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setRotation(totalRotation);
        setResult(PRIZES[prizeIndex]);
        setShowResult(true);
        setSpins((s) => s + 1);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [spinning, rotation, segmentAngle]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const resetWheel = () => {
    setRotation(0);
    setResult(null);
    setShowResult(false);
    setSpinning(false);
  };

  const buildSegmentPath = (index: number) => {
    const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);
    const largeArc = segmentAngle > 180 ? 1 : 0;
    const radius = 140;
    const x1 = 150 + radius * Math.cos(startAngle);
    const y1 = 150 + radius * Math.sin(startAngle);
    const x2 = 150 + radius * Math.cos(endAngle);
    const y2 = 150 + radius * Math.sin(endAngle);
    return `M 150 150 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF6EE] via-[#F7EFE5] to-[#F3EAD9]">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0E6F6] text-[#9B6FA8] text-xs font-semibold mb-3">
              <Gift className="w-3.5 h-3.5" />
              Beauty Fortune
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-[#2D2226] mb-3">
              Spin the Wheel
            </h1>
            <p className="font-body text-sm md:text-base text-[#7A6B63] max-w-lg mx-auto">
              Spin for your daily beauty surprise. Each spin brings a new tip, challenge, or treat to elevate your glow.
            </p>
          </div>

          {/* Wheel Container */}
          <div className="relative flex flex-col items-center mb-8">
            {/* Glow behind wheel */}
            <div className="absolute -inset-6 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(142,156,195,0.3) 0%, transparent 70%)' }}
            />

            {/* Outer ring */}
            <div className="relative p-3 rounded-full shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)' }}
            >
              <div className="relative bg-white rounded-full p-2">
                <div
                  ref={wheelRef}
                  className="relative w-[300px] h-[300px] md:w-[320px] md:h-[320px] rounded-full overflow-hidden"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? 'none' : 'transform 0.5s ease-out',
                  }}
                >
                  <svg viewBox="0 0 300 300" className="w-full h-full">
                    {PRIZES.map((prize, i) => (
                      <g key={i}>
                        <path d={buildSegmentPath(i)} fill={prize.color} stroke="white" strokeWidth="1.5" />
                        <text
                          x={150 + 90 * Math.cos(((i * segmentAngle + segmentAngle / 2) - 90) * Math.PI / 180)}
                          y={150 + 90 * Math.sin(((i * segmentAngle + segmentAngle / 2) - 90) * Math.PI / 180)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-white font-body font-bold"
                          style={{ fontSize: '13px', fontWeight: 700 }}
                        >
                          {prize.emoji} {prize.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            {/* Pointer */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}
            >
              <svg width="40" height="50" viewBox="0 0 40 50">
                <polygon points="20,50 0,0 40,0" fill="#B8706A" stroke="white" strokeWidth="2" />
              </svg>
            </div>

            {/* Center button */}
            <button
              onClick={spin}
              disabled={spinning}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)' }}
            >
              <div className="flex flex-col items-center">
                {spinning ? (
                  <RotateCcw className="w-6 h-6 md:w-7 md:h-7 text-white animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white mb-0.5" />
                    <span className="text-white text-[10px] md:text-xs font-bold font-body tracking-wide">SPIN</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-[#E8DDD6] shadow-sm">
              <Trophy className="w-4 h-4 text-[#C9A96E]" />
              <span className="text-xs font-body text-[#5C4A42]">Spins: <strong>{spins}</strong></span>
            </div>
          </div>

          {/* Result Modal */}
          {showResult && result && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in">
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border border-[#E8DDD6]">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl"
                  style={{ background: `${result.color}15` }}
                >
                  {result.emoji}
                </div>
                <h2 className="font-display text-2xl font-bold text-[#2D2226] mb-2">{result.label}</h2>
                <p className="font-body text-sm text-[#7A6B63] mb-6">{result.description}</p>
                <button
                  onClick={resetWheel}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold font-body shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-300"
                  style={{ background: 'linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Spin Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
