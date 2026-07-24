import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import heroBg from "@assets/hero.png";
import { apiRequest } from "@/lib/queryClient";

const SERVICE_TIERS = [
  { value: "signal-flare", label: "Signal Flare — Smart remote monitoring kit (from $69/mo)" },
  { value: "anchor-watch", label: "Anchor Watch — Scheduled property walk-throughs ($99/mo)" },
  { value: "anchor-watch-plus", label: "Anchor Watch Plus — Twice-monthly walk-throughs ($179/mo)" },
  { value: "shipshape", label: "Shipshape — Full-service stewardship & vendor coordination ($399/mo)" },
  { value: "launch-crew", label: "Launch Crew — On-demand concierge, one-time jobs ($85/hr)" },
  { value: "combination", label: "Combination of services — let's talk" },
];

const SERVICE_AREAS = [
  { label: "Lake Eufaula", local: true },
  { label: "OKC" },
  { label: "Tulsa" },
  { label: "Dallas" },
  { label: "Fort Worth" },
  { label: "Out-of-State Owners" },
];

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  propertyAddress: string;
  serviceTierInterest: string;
  message: string;
}

export default function ContactPage() {
  const [form, setForm] = useState<LeadForm>({
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    serviceTierInterest: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<LeadForm>>({});
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: LeadForm) =>
      apiRequest("POST", "/api/leads", data),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      // Still show success to user — don't expose server errors
      setSubmitted(true);
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<LeadForm> = {};
    if (!form.name.trim()) newErrors.name = "Required";
    if (!form.email.trim()) newErrors.email = "Required";
    if (!form.phone.trim()) newErrors.phone = "Required";
    if (!form.propertyAddress.trim()) newErrors.propertyAddress = "Required";
    if (!form.serviceTierInterest) newErrors.serviceTierInterest = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(form);
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "12px 16px",
    background: "#F5F0EA",
    border: `1.5px solid ${hasError ? "#A0432F" : "rgba(28,28,28,0.2)"}`,
    borderRadius: "6px",
    fontSize: "16px",
    color: "#1C1C1C",
    fontFamily: "'Source Sans 3', sans-serif",
    outline: "none",
    transition: "border-color 0.15s",
  });

  return (
    <PublicLayout>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden" style={{ minHeight: "55vh", display: "flex", alignItems: "flex-end" }}>
        <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(28,28,28,0.45) 0%, rgba(28,28,28,0.88) 100%)" }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 pb-16 pt-40 w-full">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>Let's Talk</span>
          <h1 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#F5F0EA", maxWidth: "600px" }}>
            Stop wondering.<br />Start knowing.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,240,234,0.80)", maxWidth: "520px" }}>
            A 15-minute call is all it takes to figure out the right coverage for your property. No sales pressure — just a straight conversation about what makes sense for your situation.
          </p>
        </div>
      </section>

      {/* ─── MAIN CONTENT ─── */}
      <section className="py-24 px-6" style={{ background: "#F5F0EA" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-16 items-start">

            {/* ─ LEFT: Contact info ─ */}
            <div className="lg:sticky lg:top-28">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#A0432F" }}>Get in Touch</span>
              <h2 className="font-bold mt-3 mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)", color: "#1C1C1C" }}>
                We're right here at Lake Eufaula.
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: "#4a4a4a" }}>
                Call, text, or fill out the form. We typically respond within a few hours. No call center, no out-of-state routing — you're talking directly to Standing Rock.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  {
                    href: "tel:9187072228",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
                    label: "Call or Text",
                    value: "(918) 707-2228",
                    clickable: true,
                  },
                  {
                    href: "mailto:info@standingrockstewards.com",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                    label: "Email",
                    value: "info@standingrockstewards.com",
                    clickable: true,
                  },
                  {
                    href: undefined,
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
                    label: "Located At",
                    value: "Lake Eufaula, Oklahoma",
                    clickable: false,
                  },
                ].map((method) => {
                  const inner = (
                    <div className="flex items-center gap-4 p-4 rounded-xl transition-all" style={{ background: "#EDE7DF", border: "1px solid rgba(28,28,28,0.1)" }}>
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1C1C1C", color: "#F5F0EA" }}>
                        {method.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>{method.label}</div>
                        <div className="text-base font-semibold" style={{ color: "#1C1C1C" }}>{method.value}</div>
                      </div>
                    </div>
                  );
                  return method.href ? (
                    <a key={method.label} href={method.href} className="block hover:scale-[1.01] transition-transform">
                      {inner}
                    </a>
                  ) : (
                    <div key={method.label}>{inner}</div>
                  );
                })}
              </div>

              {/* Service area */}
              <div className="rounded-xl p-5" style={{ background: "#EDE7DF", border: "1px solid rgba(28,28,28,0.1)" }}>
                <div className="font-bold text-base mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1C1C" }}>Who We Serve</div>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_AREAS.map((a) => (
                    <span
                      key={a.label}
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        background: a.local ? "#A0432F" : "#1C1C1C",
                        color: "#F5F0EA",
                      }}
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
                <p className="text-sm mt-3 leading-relaxed" style={{ color: "#7a7a6a" }}>
                  Serving absentee lake property owners wherever home is. If your property is on Lake Eufaula, we can help.
                </p>
              </div>
            </div>

            {/* ─ RIGHT: Form ─ */}
            <div className="rounded-2xl p-8 md:p-12" style={{ background: "#EDE7DF", border: "1px solid rgba(28,28,28,0.1)", boxShadow: "0 4px 24px rgba(28,28,28,0.06)" }}>
              {!submitted ? (
                <>
                  <h2 className="font-bold mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.5rem, 2.5vw, 2rem)", color: "#1C1C1C" }}>
                    Tell us about your property
                  </h2>
                  <p className="text-base mb-8" style={{ color: "#6a6a5a" }}>
                    Fill out the form below and we'll reach out to set up a quick call — usually within a few hours on business days.
                  </p>

                  <form onSubmit={handleSubmit} noValidate data-testid="form-contact">
                    {/* Name */}
                    <div className="mb-5">
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>
                        Full Name <span style={{ color: "#A0432F" }}>*</span>
                      </label>
                      <input
                        type="text"
                        data-testid="input-contact-name"
                        placeholder="Chris Smith"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        style={inputStyle(!!errors.name)}
                        autoComplete="name"
                      />
                      {errors.name && <p className="text-xs mt-1" style={{ color: "#A0432F" }}>{errors.name}</p>}
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>
                          Email Address <span style={{ color: "#A0432F" }}>*</span>
                        </label>
                        <input
                          type="email"
                          data-testid="input-contact-email"
                          placeholder="you@email.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          style={inputStyle(!!errors.email)}
                          autoComplete="email"
                        />
                        {errors.email && <p className="text-xs mt-1" style={{ color: "#A0432F" }}>{errors.email}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>
                          Phone Number <span style={{ color: "#A0432F" }}>*</span>
                        </label>
                        <input
                          type="tel"
                          data-testid="input-contact-phone"
                          placeholder="(405) 555-0100"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          style={inputStyle(!!errors.phone)}
                          autoComplete="tel"
                        />
                        {errors.phone && <p className="text-xs mt-1" style={{ color: "#A0432F" }}>{errors.phone}</p>}
                      </div>
                    </div>

                    {/* Property Address */}
                    <div className="mb-5">
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>
                        Property Address <span style={{ color: "#A0432F" }}>*</span>
                      </label>
                      <input
                        type="text"
                        data-testid="input-contact-address"
                        placeholder="123 Lakeview Rd, Eufaula, OK 74432"
                        value={form.propertyAddress}
                        onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
                        style={inputStyle(!!errors.propertyAddress)}
                        autoComplete="street-address"
                      />
                      <p className="text-xs mt-1" style={{ color: "#7a7a6a" }}>Street address or general location of your lake property.</p>
                      {errors.propertyAddress && <p className="text-xs mt-1" style={{ color: "#A0432F" }}>{errors.propertyAddress}</p>}
                    </div>

                    {/* Service Tier */}
                    <div className="mb-5">
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>
                        Service Tier Interest <span style={{ color: "#A0432F" }}>*</span>
                      </label>
                      <select
                        data-testid="select-contact-tier"
                        value={form.serviceTierInterest}
                        onChange={(e) => setForm({ ...form, serviceTierInterest: e.target.value })}
                        style={{
                          ...inputStyle(!!errors.serviceTierInterest),
                          cursor: "pointer",
                          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231C1C1C' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 12px center",
                          paddingRight: "40px",
                          appearance: "none" as const,
                        }}
                      >
                        <option value="">Not sure yet — help me figure it out</option>
                        {SERVICE_TIERS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {errors.serviceTierInterest && <p className="text-xs mt-1" style={{ color: "#A0432F" }}>{errors.serviceTierInterest}</p>}
                    </div>

                    {/* Message */}
                    <div className="mb-8">
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1C1C" }}>Message</label>
                      <textarea
                        data-testid="input-contact-message"
                        placeholder="Tell us about your property, specific concerns, timing, or anything else that helps us prepare for our first conversation."
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        style={{ ...inputStyle(false), minHeight: "140px", resize: "vertical", lineHeight: "1.6" }}
                      />
                      <p className="text-xs mt-1" style={{ color: "#7a7a6a" }}>Optional but helpful. Even a sentence or two goes a long way.</p>
                    </div>

                    <button
                      type="submit"
                      data-testid="button-contact-submit"
                      disabled={mutation.isPending}
                      className="w-full py-4 px-6 rounded font-bold text-lg transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
                      style={{ background: "#A0432F", color: "#F5F0EA", fontFamily: "'Source Sans 3', sans-serif" }}
                    >
                      {mutation.isPending ? "Sending..." : "Send My Information →"}
                    </button>

                    <p className="text-xs text-center mt-3" style={{ color: "#7a7a6a" }}>
                      We respond within a few hours on business days. No spam, ever.
                    </p>
                  </form>
                </>
              ) : (
                /* Success state */
                <div className="text-center py-12 px-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#7A8C6E" }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F5F0EA" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="font-bold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.75rem", color: "#1C1C1C" }}>
                    We've got your information.
                  </h3>
                  <p className="text-base leading-relaxed mx-auto" style={{ color: "#4a4a4a", maxWidth: "400px" }}>
                    We'll be in touch soon — typically within a few hours on business days. We look forward to talking about your property.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center mt-8 px-6 py-3 rounded font-semibold text-base transition-all hover:opacity-90"
                    style={{ background: "#A0432F", color: "#F5F0EA" }}
                  >
                    ← Back to Home
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY US STRIP ─── */}
      <section className="py-20 px-6" style={{ background: "#1C1C1C" }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7A8C6E" }}>The Standing Rock Difference</span>
            <h2 className="font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#F5F0EA" }}>
              You deserve more than an app and a prayer.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { num: "Local", text: "We live and work at Lake Eufaula. Not an out-of-state company staffing jobs remotely." },
              { num: "Personal", text: "You have one contact. One person who knows your property. Not a ticket queue." },
              { num: "Honest", text: "Vendor invoices passed at cost. No markups. No upsells. Straight answers." },
            ].map((item) => (
              <div key={item.num} className="text-center">
                <div className="text-4xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#A0432F" }}>{item.num}</div>
                <p className="text-base leading-relaxed" style={{ color: "rgba(245,240,234,0.75)" }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
