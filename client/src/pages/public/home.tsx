import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import heroBg from "@assets/hero.png";
import anchorWatchImg from "@assets/anchor-watch.png";
import signalFlareImg from "@assets/signal-flare.png";
import stormWatchImg from "@assets/storm-watch.png";
import launchCrewImg from "@assets/launch-crew.png";

// ─── TRUST ITEMS ─────────────────────────────────────────────────────────────
const trustItems = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    label: "Lake Eufaula Local",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    label: "Same-Day Photo Reports",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    label: "No Retainer for On-Demand",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    label: "Storm Response 24/7",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    label: "Smart Remote Monitoring",
  },
];

// ─── SERVICE CARDS ────────────────────────────────────────────────────────────
const services = [
  {
    image: signalFlareImg,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    title: "Signal Flare",
    desc: "We install and own the hardware — cameras, leak sensors, smart thermostat, cellular backup. You lease it monthly and we watch the signals so you don't have to.",
    price: "From $325 install + $69/mo",
    linkHref: "/services#signal-flare",
    linkLabel: "See kits",
  },
  {
    image: anchorWatchImg,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    title: "Anchor Watch",
    desc: "Scheduled walk-throughs, storm checks, and same-day photo reports. Someone walking your property on a schedule — sending you photos, not excuses.",
    price: "$99/mo — $179/mo",
    linkHref: "/services#anchor-watch",
    linkLabel: "Learn more",
  },
  {
    image: heroBg,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    title: "Shipshape",
    desc: "Your lake place ready when you arrive — running itself when you're not. Pre-arrival prep, vendor coordination, priority storm response, invoices passed at cost.",
    price: "$399/mo",
    linkHref: "/services#shipshape",
    linkLabel: "Learn more",
  },
  {
    image: launchCrewImg,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    title: "Launch Crew",
    desc: "On-demand concierge services — boots on the ground for the jobs that actually need someone there. Pre-purchase inspections, contractor oversight, delivery reception, and more.",
    price: "$85/hr + mileage · $550/day",
    linkHref: "/services#launch-crew",
    linkLabel: "One-time jobs",
  },
];

// ─── HOW IT WORKS STEPS ───────────────────────────────────────────────────────
const steps = [
  { num: "1", title: "Call or Text", desc: "Tell us about your property. We'll ask the right questions and recommend the right tier — no sales pressure." },
  { num: "2", title: "We Recommend a Plan", desc: "Based on your property, visit frequency, and comfort level, we'll suggest the right combination of monitoring and oversight." },
  { num: "3", title: "We Schedule the First Visit", desc: "For Signal Flare, we schedule installation. For Anchor Watch, we walk the property and set your check schedule." },
  { num: "4", title: "You Stop Worrying", desc: "Regular reports hit your inbox. Alerts come through us, filtered and explained. Your lake place is covered." },
];

// ─── PRICING CARDS ────────────────────────────────────────────────────────────
const pricing = [
  {
    name: "Signal Flare",
    price: "$69",
    unit: "/mo",
    desc: "Smart kit install from $325. Cellular backup included.",
    features: ["Remote monitoring", "Cameras + sensors", "Cellular backup unit", "SR alert monitoring"],
    href: "/services#signal-flare",
    cta: "See Kits",
    featured: false,
  },
  {
    name: "Anchor Watch",
    price: "$99",
    unit: "/mo",
    desc: "Scheduled in-person walk-throughs with photo reports.",
    features: ["1 walk-through/month", "Storm event checks", "Same-day photo report", "Ext. & interior check"],
    href: "/contact",
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Anchor Watch Plus",
    price: "$179",
    unit: "/mo",
    desc: "Everything in Anchor Watch — twice per month.",
    features: ["2 walk-throughs/month", "Storm event checks", "Same-day photo reports", "Priority response"],
    href: "/contact",
    cta: "Get Started",
    featured: true,
    badge: "Most Complete",
  },
  {
    name: "Shipshape",
    price: "$399",
    unit: "/mo",
    desc: "Full operations — pre-arrival prep, vendor coordination, priority everything.",
    features: ["Everything in AW Plus", "Pre-arrival prep visits", "Vendor coordination", "Invoices passed at cost"],
    href: "/contact",
    cta: "Get Started",
    featured: false,
  },
];

// ─── CHECK ICON ──────────────────────────────────────────────────────────────
function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <PublicLayout>
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "#1C1C1C" }}>
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${heroBg})`, opacity: 0.35 }}
          role="img"
          aria-label="Aerial view of Lake Eufaula at sunset"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(28,28,28,0.75) 0%, rgba(28,28,28,0.5) 100%)" }} />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-32">
          <p className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: "#7A8C6E" }}>Lake Eufaula, Oklahoma</p>
          <h1
            className="font-bold leading-tight mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
              color: "#F5F0EA",
              maxWidth: "820px",
            }}
          >
            We stand watch.<br />
            <em style={{ color: "#A0432F" }}>Your investment</em><br />
            stands firm.
          </h1>
          <p className="text-xl font-medium mb-4" style={{ color: "rgba(245,240,234,0.8)" }}>
            Local eyes. Real accountability. Total peace of mind.
          </p>
          <p className="text-lg leading-relaxed mb-10" style={{ color: "rgba(245,240,234,0.7)", maxWidth: "620px" }}>
            You love your lake place. You just can't always be there. Standing Rock Stewardship Co. provides hands-on oversight, smart monitoring, and on-demand help for absentee property owners — from OKC, Tulsa, Dallas, and beyond.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#A0432F", color: "#F5F0EA" }}
              data-testid="link-hero-get-started"
            >
              Get Started
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg transition-all hover:border-white/60"
              style={{ color: "rgba(245,240,234,0.9)", border: "2px solid rgba(245,240,234,0.35)", background: "rgba(255,255,255,0.08)" }}
            >
              See Our Services
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,234,0.45)" strokeWidth="1.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* ═══ TRUST BAR ═══ */}
      <div style={{ background: "#EDE7DF", borderBottom: "1px solid rgba(28,28,28,0.08)" }}>
        <div className="max-w-[1280px] mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#1C1C1C" }}>
                <span style={{ color: "#A0432F" }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ INTRO ═══ */}
      <section className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Who We Are</span>
              <h2
                className="font-bold mt-3 mb-6 leading-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#1C1C1C" }}
              >
                Not a property manager. Not a security company.
              </h2>
              <p className="text-lg leading-relaxed mb-4" style={{ color: "#3a3a3a" }}>
                We're your local set of eyes, hands, and good judgment — the people you call when you need someone who actually knows your place and Lake Eufaula.
              </p>
              <p className="text-lg leading-relaxed mb-4" style={{ color: "#3a3a3a" }}>
                Standing Rock Stewardship Co. was built for absentee owners who want more than a camera app and a prayer. We show up, assess, report, and act — so you don't have to wonder what's going on three hours away.
              </p>
              <p className="text-lg leading-relaxed mb-8" style={{ color: "#3a3a3a" }}>
                We're not a call center. We're not out of state. We're right here.
              </p>
              <Link
                href="/how-it-works"
                className="inline-flex items-center px-6 py-3 rounded font-semibold text-base border-2 transition-colors hover:bg-[#1C1C1C] hover:text-[#F5F0EA]"
                style={{ color: "#1C1C1C", borderColor: "#1C1C1C" }}
              >
                How It Works
              </Link>
            </div>
            <div className="relative">
              <img
                src={anchorWatchImg}
                alt="Standing Rock steward inspecting a Lake Eufaula lakefront property"
                className="w-full rounded-lg object-cover"
                style={{ height: "480px" }}
                loading="lazy"
              />
              <div
                className="absolute bottom-4 left-4 px-4 py-2 rounded text-sm font-semibold"
                style={{ background: "rgba(28,28,28,0.85)", color: "#F5F0EA" }}
              >
                Lake Eufaula, Oklahoma
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES OVERVIEW ═══ */}
      <section className="py-24 px-6" style={{ background: "#EDE7DF" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>What We Offer</span>
            <h2
              className="font-bold mt-3 mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}
            >
              Built for owners who live somewhere else
            </h2>
            <p className="text-lg mx-auto" style={{ color: "#4a4a4a", maxWidth: "560px" }}>
              From smart remote monitoring to full hands-on oversight — choose the level of coverage that fits your property and peace of mind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((svc) => (
              <article
                key={svc.title}
                className="rounded-xl overflow-hidden flex flex-col transition-transform hover:-translate-y-1 hover:shadow-lg"
                style={{ background: "#F5F0EA", border: "1px solid rgba(28,28,28,0.1)" }}
              >
                <div className="relative overflow-hidden" style={{ height: "180px" }}>
                  <img src={svc.image} alt={svc.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: "#1C1C1C", color: "#F5F0EA" }}
                  >
                    {svc.icon}
                  </div>
                  <h3 className="font-bold text-xl mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>{svc.title}</h3>
                  <p className="text-base leading-relaxed mb-4 flex-1" style={{ color: "#4a4a4a" }}>{svc.desc}</p>
                  <div className="text-base font-bold mb-4" style={{ color: "#A0432F" }}>{svc.price}</div>
                  <Link
                    href={svc.linkHref}
                    className="inline-flex items-center gap-1 text-sm font-semibold transition-colors hover:text-[#A0432F]"
                    style={{ color: "#1C1C1C" }}
                  >
                    {svc.linkLabel}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SIGNAL FLARE FEATURE ═══ */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: "#1C1C1C" }}>
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at 60% 0%, #A0432F 0%, transparent 60%)" }} />
        <div className="max-w-[1280px] mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Signal Flare Monitoring</span>
              <h2
                className="font-bold mt-3 mb-6 leading-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}
              >
                Know what's happening at your place without driving down to check.
              </h2>
              <p className="text-lg leading-relaxed mb-4" style={{ color: "rgba(245,240,234,0.75)" }}>
                Signal Flare is Standing Rock's smart monitoring layer — cameras, sensors, and a smart thermostat keeping a constant eye on your property between visits.
              </p>
              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(245,240,234,0.75)" }}>
                When something trips — a leak sensor, an unexpected door open, a temperature drop below 50° — we see it first. We assess it. Then we contact you with context, not a raw alert.
              </p>

              <div className="flex gap-2 mb-8 flex-wrap">
                {["Small Kit", "Standard Kit", "Heavy Kit"].map((kit, i) => (
                  <span
                    key={kit}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      background: i === 1 ? "#A0432F" : "rgba(245,240,234,0.1)",
                      color: i === 1 ? "#F5F0EA" : "rgba(245,240,234,0.7)",
                      border: i === 1 ? "none" : "1px solid rgba(245,240,234,0.2)",
                    }}
                  >
                    {kit}
                  </span>
                ))}
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  "We own the hardware — you lease it monthly, no large upfront cost",
                  "Cellular backup unit built in — lake WiFi down? Monitoring stays up",
                  "Not an alarm system — no false calls, no police dispatch, no alarm fees",
                  "One dashboard, one call — everything routes through us",
                  "Local eyes behind the screen — not an out-of-state call center",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-base" style={{ color: "rgba(245,240,234,0.8)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A8C6E" strokeWidth="2" className="mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/services#signal-flare"
                className="inline-flex items-center px-7 py-3.5 rounded font-semibold text-base transition-all hover:opacity-90"
                style={{ background: "#A0432F", color: "#F5F0EA" }}
              >
                See Signal Flare Kits
              </Link>
            </div>

            <div className="rounded-xl overflow-hidden">
              <img
                src={signalFlareImg}
                alt="Smart monitoring devices for lake property"
                className="w-full object-cover rounded-xl"
                style={{ height: "520px" }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STORM SECTION ═══ */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${stormWatchImg})` }} role="img" aria-label="Dramatic storm approaching Lake Eufaula" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(28,28,28,0.9) 0%, rgba(28,28,28,0.7) 100%)" }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-20">
          <div className="max-w-[640px]">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Storm Response</span>
            <h2
              className="font-bold mt-3 mb-5 leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}
            >
              When the weather hits, we're already on it.
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(245,240,234,0.8)" }}>
              Severe storm rolling through? We check your property, document any damage, and contact you with a full report — before you even know to worry. Tornado warnings, high winds, hard freezes — we respond to them all.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg transition-all hover:opacity-90"
              style={{ background: "#A0432F", color: "#F5F0EA" }}
            >
              Talk to Us
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS PREVIEW ═══ */}
      <section className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Simple to Start</span>
            <h2
              className="font-bold mt-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}
            >
              Up and running in days, not weeks
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold"
                  style={{
                    background: i % 2 === 0 ? "#A0432F" : "#7A8C6E",
                    color: "#F5F0EA",
                    fontFamily: "'Playfair Display', Georgia, serif",
                  }}
                >
                  {step.num}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>{step.title}</h3>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center px-6 py-3 rounded font-semibold text-base border-2 transition-colors hover:bg-[#1C1C1C] hover:text-[#F5F0EA]"
              style={{ color: "#1C1C1C", borderColor: "#1C1C1C" }}
            >
              Full Process Details
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-24 px-6" style={{ background: "#EDE7DF" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Straightforward Pricing</span>
            <h2
              className="font-bold mt-3 mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}
            >
              No hidden fees. No surprises.
            </h2>
            <p className="text-lg" style={{ color: "#4a4a4a" }}>
              Month-to-month on all oversight plans. Signal Flare starts with a 12-month agreement, then month-to-month.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className="rounded-xl p-6 flex flex-col relative"
                style={{
                  background: plan.featured ? "#1C1C1C" : "#F5F0EA",
                  border: plan.featured ? "2px solid #A0432F" : "1px solid rgba(28,28,28,0.12)",
                  color: plan.featured ? "#F5F0EA" : "#1C1C1C",
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#A0432F", color: "#F5F0EA" }}
                  >
                    {plan.badge}
                  </div>
                )}
                <div className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: plan.featured ? "#A0432F" : "#7A8C6E" }}>{plan.name}</div>
                <div className="mb-2">
                  <span className="text-4xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{plan.price}</span>
                  <span className="text-base" style={{ color: plan.featured ? "rgba(245,240,234,0.6)" : "rgba(28,28,28,0.5)" }}>{plan.unit}</span>
                </div>
                <p className="text-sm mb-5" style={{ color: plan.featured ? "rgba(245,240,234,0.65)" : "rgba(28,28,28,0.6)" }}>{plan.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: plan.featured ? "rgba(245,240,234,0.85)" : "#1C1C1C" }}>
                      <span style={{ color: "#7A8C6E" }}><Check /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className="block py-3 px-4 rounded text-center font-semibold text-sm transition-all hover:opacity-90"
                  style={{
                    background: plan.featured ? "#A0432F" : "transparent",
                    color: plan.featured ? "#F5F0EA" : "#1C1C1C",
                    border: plan.featured ? "none" : "2px solid rgba(28,28,28,0.25)",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-base" style={{ color: "#4a4a4a" }}>
            Launch Crew on-demand services: <strong>$85/hr + mileage</strong> or <strong>$550/day</strong>. No retainer required.{" "}
            <Link href="/services" className="font-semibold hover:underline" style={{ color: "#A0432F" }}>Full pricing details →</Link>
          </p>
        </div>
      </section>

      {/* ═══ CTA BAND ═══ */}
      <section className="py-20 px-6 text-center" style={{ background: "#A0432F" }}>
        <div className="max-w-[760px] mx-auto">
          <h2
            className="font-bold mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}
          >
            Ready to stop wondering how your place is doing?
          </h2>
          <p className="text-lg italic mb-8" style={{ color: "rgba(245,240,234,0.85)" }}>"We stand watch. Your investment stands firm."</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 rounded font-bold text-lg transition-all hover:bg-white/90"
              style={{ background: "#F5F0EA", color: "#A0432F" }}
            >
              Get Started Today
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg border-2 transition-all hover:bg-white/10"
              style={{ color: "#F5F0EA", borderColor: "rgba(245,240,234,0.5)" }}
            >
              View All Services
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
