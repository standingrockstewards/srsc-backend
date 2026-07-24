import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import logoLight from "@assets/logo-light.png";

// ─── NAV LINK ────────────────────────────────────────────────────────────────
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link
      href={href}
      className="text-base font-medium transition-colors hover:text-[#A0432F]"
      style={{ color: isActive ? "#A0432F" : "rgba(245,240,234,0.85)", fontWeight: isActive ? "700" : "500" }}
    >
      {children}
    </Link>
  );
}

// ─── PUBLIC LAYOUT ───────────────────────────────────────────────────────────
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F0EA", fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* ─── NAV ─── */}
      <nav
        className="sticky top-0 z-50 transition-all duration-200"
        style={{
          background: scrolled ? "rgba(28,28,28,0.97)" : "#1C1C1C",
          borderBottom: scrolled ? "1px solid rgba(160,67,47,0.25)" : "1px solid rgba(255,255,255,0.06)",
          backdropFilter: scrolled ? "blur(8px)" : "none",
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" aria-label="Standing Rock Stewardship Co. home">
              <img
                src={logoLight}
                alt="Standing Rock Stewardship Co."
                style={{ height: "64px", width: "auto", display: "block" }}
              />
            </Link>

            {/* Desktop nav */}
            <ul className="hidden md:flex items-center gap-8" role="list">
              <li><NavLink href="/">Home</NavLink></li>
              <li><NavLink href="/services">Services</NavLink></li>
              <li><NavLink href="/how-it-works">How It Works</NavLink></li>
              <li><NavLink href="/contact">Contact</NavLink></li>
            </ul>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/contact"
                className="px-5 py-2.5 rounded text-sm font-semibold border transition-colors hover:border-[#A0432F] hover:text-[#A0432F]"
                style={{ color: "rgba(245,240,234,0.85)", borderColor: "rgba(245,240,234,0.3)", background: "transparent" }}
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded text-sm font-semibold transition-colors"
                style={{ background: "#A0432F", color: "#F5F0EA" }}
              >
                Client Login
              </Link>
            </div>

            {/* Hamburger */}
            <button
              className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8 ml-2"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="block h-0.5 w-full rounded transition-all" style={{ background: menuOpen ? "#A0432F" : "rgba(245,240,234,0.85)", transform: menuOpen ? "translateY(8px) rotate(45deg)" : "none" }} />
              <span className="block h-0.5 w-full rounded transition-all" style={{ background: menuOpen ? "#A0432F" : "rgba(245,240,234,0.85)", opacity: menuOpen ? 0 : 1 }} />
              <span className="block h-0.5 w-full rounded transition-all" style={{ background: menuOpen ? "#A0432F" : "rgba(245,240,234,0.85)", transform: menuOpen ? "translateY(-8px) rotate(-45deg)" : "none" }} />
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div
              className="md:hidden flex flex-col gap-2 pb-4 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
              aria-label="Mobile navigation"
            >
              {[
                { href: "/", label: "Home" },
                { href: "/services", label: "Services" },
                { href: "/how-it-works", label: "How It Works" },
                { href: "/contact", label: "Contact" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block py-3 px-1 text-base font-medium border-b transition-colors hover:text-[#A0432F]"
                  style={{ color: "rgba(245,240,234,0.85)", borderColor: "rgba(255,255,255,0.06)" }}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/contact"
                className="mt-2 py-3 px-4 rounded text-center font-semibold"
                style={{ background: "#A0432F", color: "#F5F0EA" }}
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="py-3 px-4 rounded text-center font-semibold border"
                style={{ color: "rgba(245,240,234,0.85)", borderColor: "rgba(245,240,234,0.3)" }}
              >
                Client Login
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* ─── PAGE CONTENT ─── */}
      <main className="flex-1">{children}</main>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: "#1C1C1C", color: "rgba(245,240,234,0.75)" }}>
        <div className="max-w-[1280px] mx-auto px-6 pt-16 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="inline-block mb-5">
                <img src={logoLight} alt="Standing Rock Stewardship Co." style={{ height: "48px", width: "auto" }} />
              </Link>
              <p className="text-sm leading-relaxed italic" style={{ color: "rgba(245,240,234,0.55)" }}>
                "We stand watch. Your investment stands firm."
              </p>
            </div>

            {/* Services */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#A0432F" }}>Services</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { href: "/services#signal-flare", label: "Signal Flare" },
                  { href: "/services#anchor-watch", label: "Anchor Watch" },
                  { href: "/services#shipshape", label: "Shipshape" },
                  { href: "/services#launch-crew", label: "Launch Crew" },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-[#A0432F] transition-colors" style={{ color: "rgba(245,240,234,0.65)" }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#7A8C6E" }}>Company</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { href: "/how-it-works", label: "How It Works" },
                  { href: "/contact", label: "Contact Us" },
                  { href: "/contact", label: "Get Started" },
                  { href: "/login", label: "Client Login" },
                ].map(({ href, label }) => (
                  <li key={label + href}>
                    <Link href={href} className="hover:text-[#A0432F] transition-colors" style={{ color: "rgba(245,240,234,0.65)" }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(245,240,234,0.55)" }}>Contact</p>
              <div className="space-y-3 text-sm">
                <p className="flex items-center gap-2.5" style={{ color: "rgba(245,240,234,0.75)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <a href="tel:9187072228" className="hover:text-[#A0432F] transition-colors">(918) 707-2228</a>
                </p>
                <p className="flex items-center gap-2.5" style={{ color: "rgba(245,240,234,0.75)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <a href="mailto:info@standingrockstewards.com" className="hover:text-[#A0432F] transition-colors">info@standingrockstewards.com</a>
                </p>
                <p className="flex items-center gap-2.5" style={{ color: "rgba(245,240,234,0.75)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Lake Eufaula, Oklahoma
                </p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,234,0.35)" }}
          >
            <p>&copy; 2026 Standing Rock Stewardship Co. All rights reserved.</p>
            <p>standingrockstewards.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
