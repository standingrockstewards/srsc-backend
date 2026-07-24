import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import PublicLayout from "@/components/public-layout";
import signalFlareImg from "@assets/signal-flare.png";
import anchorWatchImg from "@assets/anchor-watch.png";
import heroBg from "@assets/hero.png";
import stormWatchImg from "@assets/storm-watch.png";
import launchCrewImg from "@assets/launch-crew.png";

function Check({ color = "#7A8C6E" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function Dash() {
  return <span style={{ color: "rgba(28,28,28,0.25)", fontSize: "1.2em" }}>—</span>;
}

const addOns = [
  { label: "Outdoor camera", price: "+$15/mo" },
  { label: "Indoor camera", price: "+$10/mo" },
  { label: "Leak sensor", price: "+$8/mo" },
  { label: "Smart lock", price: "+$18/mo" },
  { label: "Noise monitor", price: "+$12/mo" },
];

export default function ServicesPage() {
  const [location] = useLocation();

  // Scroll to hash section after render
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash.replace("#", ""));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location]);

  return (
    <PublicLayout>
      {/* ─── PAGE HERO ─── */}
      <section
        className="py-28 px-6 text-center relative overflow-hidden"
        style={{ background: "#1C1C1C" }}
      >
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at 60% 0%, #A0432F 0%, transparent 60%)" }} />
        <div className="relative z-10 max-w-[680px] mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>What We Offer</span>
          <h1
            className="font-bold mt-3 mb-5 leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#F5F0EA" }}
          >
            Property oversight built for owners{" "}
            <em>who live somewhere else</em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,240,234,0.72)" }}>
            From smart remote monitoring to full hands-on stewardship — every tier is designed for absentee owners at Lake Eufaula.
          </p>
        </div>
      </section>

      {/* ─── SIGNAL FLARE ─── */}
      <section id="signal-flare" className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          {/* Intro grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
            <div className="rounded-xl overflow-hidden order-last lg:order-first">
              <img src={signalFlareImg} alt="Smart monitoring devices installed in a lake cabin" className="w-full h-full object-cover rounded-xl" style={{ height: "440px" }} loading="lazy" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Signal Flare</span>
              <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#1C1C1C" }}>
                Smart monitoring that knows your place.
              </h2>
              <p className="text-lg font-semibold mb-4" style={{ color: "#1C1C1C" }}>
                We install it. We own it. We watch it.<br />You get peace of mind — monthly.
              </p>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#4a4a4a" }}>
                Signal Flare is Standing Rock's smart monitoring layer — cameras, sensors, and a cellular backup unit keeping constant watch between visits. When something trips, we assess it and contact you with context, not a raw alert at 2am.
              </p>
              <ul className="space-y-3">
                {[
                  "Hardware installed and owned by Standing Rock — you lease it monthly",
                  "Cellular backup unit included — lake WiFi drops? Monitoring stays on",
                  "Not an alarm system — no false calls, no police dispatch, no alarm fees",
                  "All alerts routed through Standing Rock — we filter the noise",
                  "Smart sensor with noise, motion, temp, humidity, and occupancy detection",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-base" style={{ color: "#3a3a3a" }}>
                    <Check />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Kit comparison table */}
          <div className="mb-14">
            <div className="text-center mb-10">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Choose Your Kit</span>
              <h3 className="font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "#1C1C1C" }}>
                The right coverage for your property size.
              </h3>
            </div>

            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(28,28,28,0.1)" }}>
              <table className="w-full text-base" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1C1C1C" }}>
                    <th className="text-left p-4 font-semibold" style={{ color: "rgba(245,240,234,0.7)", minWidth: "200px" }}>Feature</th>
                    <th className="p-4 text-center font-bold" style={{ color: "rgba(245,240,234,0.7)", minWidth: "140px" }}>SMALL</th>
                    <th className="p-4 text-center font-bold" style={{ color: "#A0432F", minWidth: "150px", borderLeft: "2px solid #A0432F", borderRight: "2px solid #A0432F" }}>STANDARD</th>
                    <th className="p-4 text-center font-bold" style={{ color: "rgba(245,240,234,0.7)", minWidth: "140px" }}>HEAVY</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Price row */}
                  <tr style={{ background: "#EDE7DF", borderBottom: "1px solid rgba(28,28,28,0.1)" }}>
                    <td className="p-4 font-semibold" style={{ color: "#1C1C1C" }}>Install / Monthly</td>
                    {[
                      { install: "$325", mo: "install + $69/mo" },
                      { install: "$475", mo: "install + $99/mo" },
                      { install: "$649", mo: "install + $159/mo" },
                    ].map((p, i) => (
                      <td key={i} className="p-4 text-center" style={{ borderLeft: i === 1 ? "2px solid #A0432F" : undefined, borderRight: i === 1 ? "2px solid #A0432F" : undefined }}>
                        <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#A0432F" }}>{p.install}</div>
                        <div className="text-sm" style={{ color: "#4a4a4a" }}>{p.mo}</div>
                      </td>
                    ))}
                  </tr>

                  {/* Section header */}
                  <tr style={{ background: "rgba(28,28,28,0.04)" }}>
                    <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Hardware Included</td>
                  </tr>

                  {/* Hardware rows */}
                  {[
                    { label: "Outdoor cameras", vals: ["1", "2", "4"] },
                    { label: "Indoor cameras", vals: [null, "1", "2"] },
                    { label: "Smart sensor (noise/motion/temp/humidity)", vals: ["1", "1", "2"] },
                    { label: "Leak sensor", vals: [null, "1", "2"] },
                    { label: "Smart thermostat", vals: [null, true, true] },
                    { label: "Cellular backup unit", vals: [true, true, true] },
                  ].map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: "1px solid rgba(28,28,28,0.07)", background: ri % 2 === 0 ? "#F5F0EA" : "#FDFAF6" }}>
                      <td className="p-4" style={{ color: "#1C1C1C" }}>{row.label}</td>
                      {row.vals.map((v, vi) => (
                        <td key={vi} className="p-4 text-center" style={{ borderLeft: vi === 1 ? "2px solid rgba(160,67,47,0.25)" : undefined, borderRight: vi === 1 ? "2px solid rgba(160,67,47,0.25)" : undefined }}>
                          {v === null ? <Dash /> : v === true ? <div className="flex justify-center"><Check /></div> : <span className="font-semibold" style={{ color: "#1C1C1C" }}>{v}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Monitoring section */}
                  <tr style={{ background: "rgba(28,28,28,0.04)" }}>
                    <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Monitoring & Service</td>
                  </tr>
                  {[
                    { label: "SR alert monitoring", vals: [true, true, true] },
                    { label: "Filtered alerts to owner", vals: [true, true, true] },
                    { label: "Escalated storm check", vals: [true, true, true] },
                    { label: "Monthly monitoring report", vals: [null, true, true] },
                    { label: "Priority response", vals: [null, null, true] },
                  ].map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: "1px solid rgba(28,28,28,0.07)", background: ri % 2 === 0 ? "#F5F0EA" : "#FDFAF6" }}>
                      <td className="p-4" style={{ color: "#1C1C1C" }}>{row.label}</td>
                      {row.vals.map((v, vi) => (
                        <td key={vi} className="p-4 text-center" style={{ borderLeft: vi === 1 ? "2px solid rgba(160,67,47,0.25)" : undefined, borderRight: vi === 1 ? "2px solid rgba(160,67,47,0.25)" : undefined }}>
                          {v === null ? <Dash /> : v === true ? <div className="flex justify-center"><Check /></div> : v}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* CTA row */}
                  <tr style={{ background: "#EDE7DF" }}>
                    <td className="p-4" />
                    {[
                      { label: "Get Started", href: "/contact" },
                      { label: "Get Started", href: "/contact" },
                      { label: "Get Started", href: "/contact" },
                    ].map((b, i) => (
                      <td key={i} className="p-4 text-center" style={{ borderLeft: i === 1 ? "2px solid #A0432F" : undefined, borderRight: i === 1 ? "2px solid #A0432F" : undefined, borderBottom: i === 1 ? "2px solid #A0432F" : undefined }}>
                        <Link href={b.href} className="inline-block px-5 py-2.5 rounded font-semibold text-sm transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>{b.label}</Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Add-ons */}
          <div className="rounded-xl p-8" style={{ background: "#1C1C1C" }}>
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Optional Add-Ons</span>
              <h3 className="font-bold mt-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.5rem", color: "#F5F0EA" }}>
                Customize your coverage.
              </h3>
              <p className="text-base mt-2" style={{ color: "rgba(245,240,234,0.65)" }}>Add individual devices to any Signal Flare kit at low monthly rates.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {addOns.map((ao) => (
                <div key={ao.label} className="rounded-lg p-4 text-center" style={{ background: "rgba(245,240,234,0.06)", border: "1px solid rgba(245,240,234,0.1)" }}>
                  <div className="text-lg font-bold mb-1" style={{ color: "#A0432F" }}>{ao.price}</div>
                  <div className="text-sm" style={{ color: "rgba(245,240,234,0.75)" }}>{ao.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── ANCHOR WATCH ─── */}
      <section id="anchor-watch" className="py-24 px-6" style={{ background: "#EDE7DF" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Anchor Watch</span>
              <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#1C1C1C" }}>
                Someone walking your property, sending you photos — not excuses.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#4a4a4a" }}>
                Scheduled in-person walk-throughs, storm checks, and same-day photo reports. A Standing Rock steward knows your place — where water collects, what the dock looks like after a big blow, which issues are minor and which need your attention.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                {[
                  {
                    name: "Anchor Watch",
                    price: "$99/mo",
                    features: ["1 walk-through per month", "Storm event checks", "Same-day photo report", "Ext. & interior check", "Recommendation log"],
                  },
                  {
                    name: "Anchor Watch Plus",
                    price: "$179/mo",
                    badge: "Most Popular",
                    features: ["2 walk-throughs/month", "Storm event checks", "Same-day photo reports", "Priority response", "Recommendation log"],
                  },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className="rounded-xl p-6"
                    style={{ background: "#F5F0EA", border: plan.badge ? "2px solid #A0432F" : "1px solid rgba(28,28,28,0.12)" }}
                  >
                    {plan.badge && (
                      <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-3" style={{ background: "#A0432F", color: "#F5F0EA" }}>{plan.badge}</div>
                    )}
                    <div className="font-bold text-base mb-1" style={{ color: "#1C1C1C" }}>{plan.name}</div>
                    <div className="text-2xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#A0432F" }}>{plan.price}</div>
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#1C1C1C" }}>
                          <Check />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/contact" className="block mt-5 py-2.5 px-4 rounded text-center font-semibold text-sm transition-all hover:opacity-90" style={{ background: "#1C1C1C", color: "#F5F0EA" }}>
                      Get Started
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden">
              <img src={anchorWatchImg} alt="Standing Rock steward conducting a property walk-through" className="w-full object-cover rounded-xl" style={{ height: "520px" }} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SHIPSHAPE ─── */}
      <section id="shipshape" className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="rounded-xl overflow-hidden order-last lg:order-first">
              <img src={heroBg} alt="Beautiful lakefront property at Lake Eufaula" className="w-full object-cover rounded-xl" style={{ height: "520px" }} loading="lazy" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Shipshape</span>
              <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#1C1C1C" }}>
                Your lake place ready when you arrive — running itself when you're not.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#4a4a4a" }}>
                Shipshape is our full-service tier — everything in Anchor Watch Plus, plus pre-arrival prep visits, priority storm response, and vendor coordination with invoices passed at cost. You pull up and your place is waiting for you.
              </p>

              <div className="rounded-xl p-6 mb-8" style={{ background: "#EDE7DF", border: "1px solid rgba(28,28,28,0.1)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-lg" style={{ color: "#1C1C1C" }}>Shipshape</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#A0432F" }}>$399/mo</div>
                </div>
                <ul className="space-y-2.5">
                  {[
                    "Everything in Anchor Watch Plus",
                    "Pre-arrival prep visits before every trip",
                    "Vendor coordination with vetted local contractors",
                    "Priority storm response and damage assessment",
                    "Invoices passed at cost — no markup",
                    "Seasonal opening and closing coordination",
                    "Single point of contact for everything",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-base" style={{ color: "#1C1C1C" }}>
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/contact" className="inline-flex items-center px-7 py-3.5 rounded font-semibold text-base transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>
                Get Started with Shipshape
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STORM SECTION ─── */}
      <section className="relative min-h-[360px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${stormWatchImg})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(28,28,28,0.88) 0%, rgba(28,28,28,0.7) 100%)" }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-20">
          <div className="max-w-[620px]">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Storm Season</span>
            <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "#F5F0EA" }}>
              Storm response is included in every plan.
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(245,240,234,0.8)" }}>
              Tornado warnings, high winds, hard freezes — when significant weather hits Lake Eufaula, we check your property and report before you even think to ask.
            </p>
            <Link href="/contact" className="inline-flex items-center px-7 py-3.5 rounded font-semibold text-base transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>
              Get Covered
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LAUNCH CREW ─── */}
      <section id="launch-crew" className="py-24 px-6" style={{ background: "#1C1C1C" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Launch Crew</span>
              <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}>
                On-demand boots on the ground — no retainer required.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "rgba(245,240,234,0.75)" }}>
                One-time jobs that need someone physically there. Pre-purchase walk-through so you know what you're buying. Contractor oversight so you don't get taken advantage of from three hours away. Delivery reception, package pickup, utility coordination — the list goes on.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  { price: "$85/hr + mileage", label: "Hourly Rate" },
                  { price: "$550/day", label: "Day Rate (flat)" },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl p-5 text-center" style={{ background: "rgba(245,240,234,0.06)", border: "1px solid rgba(245,240,234,0.12)" }}>
                    <div className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#A0432F" }}>{r.price}</div>
                    <div className="text-sm font-semibold" style={{ color: "rgba(245,240,234,0.6)" }}>{r.label}</div>
                  </div>
                ))}
              </div>

              <div className="mb-8">
                <div className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(245,240,234,0.4)" }}>Common Jobs</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Pre-purchase inspection walk-through",
                    "Contractor oversight & quality check",
                    "Delivery reception & placement",
                    "Package pickup & forwarding",
                    "Utility coordination",
                    "Seasonal opening/closing",
                    "Key handoff for guests",
                    "Post-storm damage walkthrough",
                  ].map((job) => (
                    <span key={job} className="px-3 py-1.5 rounded-full text-sm" style={{ background: "rgba(245,240,234,0.08)", color: "rgba(245,240,234,0.75)", border: "1px solid rgba(245,240,234,0.12)" }}>
                      {job}
                    </span>
                  ))}
                </div>
              </div>

              <Link href="/contact" className="inline-flex items-center px-7 py-3.5 rounded font-semibold text-base transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>
                Request Launch Crew
              </Link>
            </div>

            <div className="rounded-xl overflow-hidden">
              <img src={launchCrewImg} alt="On-demand property stewardship at Lake Eufaula" className="w-full object-cover rounded-xl" style={{ height: "520px" }} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA BAND ─── */}
      <section className="py-20 px-6 text-center" style={{ background: "#A0432F" }}>
        <div className="max-w-[760px] mx-auto">
          <h2 className="font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}>
            Not sure which plan is right?
          </h2>
          <p className="text-lg mb-8" style={{ color: "rgba(245,240,234,0.85)" }}>
            We'll recommend the right combination based on your property, budget, and how you use your lake place. No pressure — just a straight conversation.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center px-8 py-4 rounded font-bold text-lg transition-all hover:bg-white/90" style={{ background: "#F5F0EA", color: "#A0432F" }}>
              Start the Conversation
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg border-2 transition-all hover:bg-white/10" style={{ color: "#F5F0EA", borderColor: "rgba(245,240,234,0.5)" }}>
              See How It Works
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
