import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import anchorWatchImg from "@assets/anchor-watch.png";
import stormWatchImg from "@assets/storm-watch.png";

const steps = [
  {
    num: 1,
    title: "Call or text us",
    text: "Tell us about your property — size, location on the lake, how often you visit, and what keeps you up at night when you're not there. We'll ask the right questions and listen carefully. No sales pressure, no upsell script. Just a conversation with someone who knows Lake Eufaula.",
    detail: "Takes about 15–20 minutes. Most people have the right plan picked by the end of the call.",
  },
  {
    num: 2,
    title: "We recommend the right tier",
    text: "Based on your property, visit frequency, and what matters most to you — remote monitoring, in-person oversight, or full-service stewardship — we'll suggest the combination that fits. We'll explain the pricing clearly, no fine print surprises.",
    detail: "Many owners combine Signal Flare with an Anchor Watch plan for layered coverage. We'll tell you honestly if that makes sense for your situation.",
  },
  {
    num: 3,
    title: "We walk the property",
    text: "Before your coverage starts, a Standing Rock steward walks your property with you (or on your behalf if you can't make it down). We document the current state — exterior, interior, dock, outbuildings — and take a full set of baseline photos. This is our reference point for every report going forward.",
    detail: "For Signal Flare, this is also when we determine optimal camera and sensor placement.",
  },
  {
    num: 4,
    title: "Installation or plan activation",
    text: null,
    detail: null,
    twoCol: [
      {
        heading: "Signal Flare:",
        text: "We schedule the installation visit, typically within 5–7 business days. We handle everything — mounting cameras, placing sensors, configuring the cellular backup unit, connecting the thermostat. We test it all before we leave and walk you through the owner dashboard.",
      },
      {
        heading: "Anchor Watch / Shipshape:",
        text: "We set your check schedule, confirm emergency contacts, and establish your photo report preferences. Your first report arrives on schedule.",
      },
    ],
  },
  {
    num: 5,
    title: "You stop worrying",
    text: "Regular reports hit your inbox. Alerts are filtered and explained before reaching you. Storm rolls through? We check your property before you know to ask. Something comes up? We call you with context and options — not a raw alert and a wish-you-luck.",
    detail: "You're three hours away. We're five minutes away. That's the whole arrangement.",
  },
];

const ongoingCards = [
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    title: "Photo Reports",
    text: "Every walk-through generates a same-day photo report — exterior, interior, dock, outbuildings. Delivered to your phone. All photos timestamped and stored.",
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    title: "Filtered Alerts",
    text: "If something trips on Signal Flare, we look at it first. You hear from us with context — \"the sensor fired because a guest arrived early\" or \"this looks like a real leak, we're heading out.\"",
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    title: "Storm Response",
    text: "After any significant weather event — tornado warning, severe thunderstorm, hard freeze — we check your property and report back. You don't have to ask. It's already in the plan.",
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: "Vendor Coordination",
    text: "Need a plumber? Dock repair? Landscaper? Shipshape clients don't have to find or manage anyone. We coordinate vetted local vendors and pass invoices at cost.",
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    title: "Pre-Arrival Prep",
    text: "Shipshape clients get a pre-arrival visit before every trip — house opened, aired out, essentials stocked. You pull up and it's waiting for you.",
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    title: "One Point of Contact",
    text: "You call us. We handle whatever needs handling. No chasing multiple vendors, no figuring out who to call about what. One number. We figure the rest out.",
  },
];

const faqs = [
  {
    q: "Do I have to be present for the initial walkthrough?",
    a: "No. We can do the initial walkthrough on your behalf if you provide access — a key, code, or neighbor contact. We'll send you the full photo set when we're done so you can review.",
  },
  {
    q: "How long does Signal Flare installation take?",
    a: "Most installations take 2–4 hours depending on property size and kit tier. We typically schedule within 5–7 business days of plan activation. You don't need to be there — we handle it start to finish.",
  },
  {
    q: "Can I combine Signal Flare with an Anchor Watch plan?",
    a: "Yes — and many owners do. Cameras and sensors cover the gaps between walk-throughs. Anchor Watch covers what a camera can't — smell, structural details, minor issues that only show up in person. Together they're comprehensive.",
  },
  {
    q: "What happens if I need to cancel?",
    a: "Anchor Watch, Anchor Watch Plus, and Shipshape are month-to-month — cancel anytime with 30 days notice. Signal Flare starts with a 12-month agreement (due to hardware install), then goes month-to-month.",
  },
  {
    q: "Is Signal Flare an alarm system?",
    a: "No. Signal Flare is a monitoring system, not an alarm. It does not dispatch police or emergency services. When sensors are triggered, alerts route to Standing Rock first — we assess and contact you with context. No false police calls, no alarm company fees.",
  },
  {
    q: "What if something needs to be fixed?",
    a: "We document it, photograph it, and contact you with options. For Shipshape clients, we can coordinate the repair directly through our local vendor network, passing invoices at cost with no markup. For other tiers, we can recommend trusted local contractors.",
  },
  {
    q: "Do you work with rental properties?",
    a: "We primarily serve owner-occupied lake properties. If you occasionally rent your place, we can discuss how our plans work alongside that — reach out and we'll work through your specific situation.",
  },
  {
    q: "How do I get started?",
    a: "Call or text us, or fill out the contact form. We'll set up a quick call, talk through your property, and have a recommendation within the day. No commitment until you're ready.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicLayout>
      {/* ─── PAGE HERO ─── */}
      <section className="py-28 px-6 text-center relative overflow-hidden" style={{ background: "#1C1C1C" }}>
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at 40% 0%, #7A8C6E 0%, transparent 60%)" }} />
        <div className="relative z-10 max-w-[680px] mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Simple to Start</span>
          <h1 className="font-bold mt-3 mb-5 leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#F5F0EA" }}>
            Up and running in days,{" "}
            <em>not weeks</em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,240,234,0.72)" }}>
            One call, a property walkthrough, and you're covered. Here's exactly how it works — from first contact to the first report in your inbox.
          </p>
        </div>
      </section>

      {/* ─── INTRO + IMAGE ─── */}
      <section className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
            <div className="rounded-xl overflow-hidden">
              <img src={anchorWatchImg} alt="Standing Rock steward conducting a property walk-through" className="w-full object-cover rounded-xl" style={{ height: "460px" }} loading="lazy" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>The Standing Rock Approach</span>
              <h2 className="font-bold mt-3 mb-5" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "#1C1C1C" }}>
                We're not a product you set up. We're people you trust.
              </h2>
              <p className="text-lg font-semibold leading-relaxed mb-4" style={{ color: "#1C1C1C" }}>
                Most property services hand you an app and call it a day. We start with a conversation and end with a standing relationship.
              </p>
              <p className="text-base leading-relaxed mb-4" style={{ color: "#4a4a4a" }}>
                We walk your property before your plan starts. We learn the quirks — where water collects after rain, which door sticks, what the dock looks like after a big blow. That context is what separates a useful report from a generic one.
              </p>
              <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>
                Once you're set up, it runs quietly in the background. Reports hit your inbox. Alerts go through us first. You hear about real problems, not sensor noise.
              </p>
            </div>
          </div>

          {/* Numbered steps */}
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>The Process</span>
            <h2 className="font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}>
              How we go from first call to full coverage
            </h2>
          </div>

          <div className="max-w-[900px] mx-auto">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="grid gap-8 py-10"
                style={{
                  gridTemplateColumns: "80px 1fr",
                  borderBottom: i < steps.length - 1 ? "1px solid rgba(28,28,28,0.1)" : "none",
                }}
              >
                <div
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                  style={{
                    background: step.num % 2 !== 0 ? "#A0432F" : "#7A8C6E",
                    color: "#F5F0EA",
                    fontFamily: "'Playfair Display', Georgia, serif",
                  }}
                >
                  {step.num}
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-xl mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>
                    {step.title}
                  </h3>
                  {step.text && (
                    <p className="text-base leading-relaxed mb-3" style={{ color: "#4a4a4a" }}>{step.text}</p>
                  )}
                  {step.twoCol && step.twoCol.map((col) => (
                    <p key={col.heading} className="text-base leading-relaxed mb-3" style={{ color: "#4a4a4a" }}>
                      <strong style={{ color: "#1C1C1C" }}>{col.heading}</strong> {col.text}
                    </p>
                  ))}
                  {step.detail && (
                    <p className="text-sm italic" style={{ color: "#7A8C6E" }}>{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHAT ONGOING LOOKS LIKE ─── */}
      <section className="py-24 px-6" style={{ background: "#EDE7DF" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Once You're Set Up</span>
            <h2 className="font-bold mt-3 mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}>
              What ongoing stewardship looks like
            </h2>
            <p className="text-lg" style={{ color: "#4a4a4a" }}>Here's what you actually experience once your plan is running.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ongoingCards.map((card) => (
              <div key={card.title} className="rounded-xl p-6" style={{ background: "#F5F0EA", border: "1px solid rgba(28,28,28,0.1)" }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: "#1C1C1C", color: "#F5F0EA" }}>
                  {card.icon}
                </div>
                <h3 className="font-bold text-lg mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>{card.title}</h3>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STORM CALLOUT ─── */}
      <section className="relative min-h-[360px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${stormWatchImg})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(28,28,28,0.88) 0%, rgba(28,28,28,0.7) 100%)" }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-20">
          <div className="max-w-[620px]">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Storm Season</span>
            <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "#F5F0EA" }}>
              When the weather hits, you'll already have an answer.
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(245,240,234,0.8)" }}>
              Oklahoma lake season means weather. Severe thunderstorms, tornado warnings, hard spring freezes. Every Standing Rock plan includes storm response — we check your property after significant events and report before you even think to ask.
            </p>
            <Link href="/contact" className="inline-flex items-center px-7 py-3.5 rounded font-semibold text-base transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>
              Get Covered
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Common Questions</span>
            <h2 className="font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#1C1C1C" }}>
              What people usually ask us
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl p-6" style={{ background: "#EDE7DF", border: "1px solid rgba(28,28,28,0.1)" }}>
                <h3 className="font-bold text-lg mb-3 leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>{faq.q}</h3>
                <p className="text-base leading-relaxed" style={{ color: "#4a4a4a" }}
                   dangerouslySetInnerHTML={{ __html: faq.a.replace(/<strong>(.*?)<\/strong>/g, '<strong>$1</strong>') }}
                />
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/contact" className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg transition-all hover:opacity-90" style={{ background: "#A0432F", color: "#F5F0EA" }}>
              Start the Conversation
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CTA BAND ─── */}
      <section className="py-20 px-6 text-center" style={{ background: "#A0432F" }}>
        <div className="max-w-[760px] mx-auto">
          <h2 className="font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", color: "#F5F0EA" }}>
            Ready to have someone standing watch?
          </h2>
          <p className="text-lg italic font-bold mb-8" style={{ color: "rgba(245,240,234,0.85)" }}>"We stand watch. Your investment stands firm."</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center px-8 py-4 rounded font-bold text-lg transition-all hover:bg-white/90" style={{ background: "#F5F0EA", color: "#A0432F" }}>
              Get Started
            </Link>
            <Link href="/services" className="inline-flex items-center px-8 py-4 rounded font-semibold text-lg border-2 transition-all hover:bg-white/10" style={{ color: "#F5F0EA", borderColor: "rgba(245,240,234,0.5)" }}>
              See All Services
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
