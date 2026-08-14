import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "glass-card-strong shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 animate-glow"
            style={{ background: "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)" }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold text-[#2D2226] tracking-tight leading-none">
              BeautyFit
            </span>
            <span className="font-body text-[9px] font-medium tracking-[0.2em] text-[#8E9CC3] uppercase leading-none mt-0.5">
              AI Beauty Coach
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              isActive("/")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            Home
            {isActive("/") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>
          <Link
            to="/analyze"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              isActive("/analyze")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            Face Fit
            {isActive("/analyze") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>
          <Link
            to="/lipstick-fit"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              isActive("/lipstick-fit")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            Lipstick Fit
            {isActive("/lipstick-fit") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>
          <Link
            to="/spin-wheel"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              isActive("/spin-wheel")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            Spin Wheel
            {isActive("/spin-wheel") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>
          <Link
            to="/history"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              isActive("/history")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            History
            {isActive("/history") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>

          <Link
            to="/blog"
            className={`relative font-body text-sm font-medium transition-colors duration-300 ${
              location.pathname.startsWith("/blog")
                ? "text-[#8E9CC3]"
                : "text-[#5C4A42] hover:text-[#8E9CC3]"
            }`}
          >
            Blog
            {location.pathname.startsWith("/blog") && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#B8706A] via-[#8E9CC3] to-[#C9A96E]" />
            )}
          </Link>
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="hidden md:block relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[#5C4A42] text-sm font-semibold font-body border transition-all duration-300 hover:text-[#8E9CC3]"
                style={{ borderColor: 'rgba(184,112,106,0.35)' }}
              >
                <User className="w-3.5 h-3.5" />
                {user.name || user.email.split('@')[0]}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl glass-card-strong shadow-lg p-2 z-50"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 text-[11px] text-[#8B7E78] font-body truncate" title={user.email}>
                    {user.email}
                  </div>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      navigate('/', { replace: true });
                    }}
                    className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-body text-[#5C4A42] hover:bg-[#F5EDE6] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[#5C4A42] text-sm font-semibold font-body border transition-all duration-300 hover:text-[#8E9CC3]"
              style={{ borderColor: 'rgba(184,112,106,0.35)' }}
            >
              Sign in
            </Link>
          )}
          <Link
            to="/analyze"
            className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold font-body shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze My Face
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-[#F5EDE6] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-[#2D2226]" />
            ) : (
              <Menu className="w-5 h-5 text-[#2D2226]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden glass-card-strong mt-2 mx-4 rounded-2xl p-5 animate-scale-in shadow-lg">
          <div className="flex flex-col gap-3">
            <Link
              to="/"
              className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                isActive("/")
                  ? "bg-[#F0F2F8] text-[#8E9CC3]"
                  : "text-[#5C4A42] hover:bg-[#F5EDE6]"
              }`}
            >
              Home
            </Link>
            <Link
              to="/analyze"
              className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                isActive("/analyze")
                  ? "bg-[#F0F2F8] text-[#8E9CC3]"
                  : "text-[#5C4A42] hover:bg-[#F5EDE6]"
              }`}
            >
              Face Fit
            </Link>
              <Link
                to="/lipstick-fit"
                className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                  isActive("/lipstick-fit")
                    ? "bg-[#F0F2F8] text-[#8E9CC3]"
                    : "text-[#5C4A42] hover:bg-[#F5EDE6]"
                }`}
              >
                Lipstick Fit
              </Link>
              <Link
                to="/spin-wheel"
                className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                  isActive("/spin-wheel")
                    ? "bg-[#F0F2F8] text-[#8E9CC3]"
                    : "text-[#5C4A42] hover:bg-[#F5EDE6]"
                }`}
              >
                Spin Wheel
              </Link>

              <Link
                to="/history"
                className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                  isActive("/history")
                    ? "bg-[#F0F2F8] text-[#8E9CC3]"
                    : "text-[#5C4A42] hover:bg-[#F5EDE6]"
                }`}
              >
                History
              </Link>
            <Link
              to="/blog"
              className={`px-4 py-3 rounded-xl text-sm font-medium font-body transition-colors ${
                location.pathname.startsWith("/blog")
                  ? "bg-[#F0F2F8] text-[#8E9CC3]"
                  : "text-[#5C4A42] hover:bg-[#F5EDE6]"
              }`}
            >
              Blog
            </Link>
            <div className="pt-2 border-t border-[#E8DDD6] flex flex-col gap-2">
              {user ? (
                <>
                  <div className="px-4 py-2 text-[11px] text-[#8B7E78] font-body truncate" title={user.email}>
                    {user.email}
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      navigate('/', { replace: true });
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold font-body border transition-colors"
                    style={{ borderColor: 'rgba(184,112,106,0.35)', color: '#5C4A42' }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold font-body border transition-colors"
                  style={{ borderColor: 'rgba(184,112,106,0.35)', color: '#5C4A42' }}
                >
                  Sign in
                </Link>
              )}
              <Link
                to="/analyze"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-white text-sm font-semibold font-body shadow-md"
                style={{ background: "linear-gradient(135deg, #B8706A 0%, #8E9CC3 50%, #C9A96E 100%)" }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analyze My Face
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}