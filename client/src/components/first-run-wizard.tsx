/**
 * First-Run Wizard — shown to newly activated clients.
 * Steps: Welcome → Review Property → Accept ToS → Retainer Top-Up (optional)
 * Dismissed when onboarding_step !== 'first_run' | 'tos' | 'retainer'
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Anchor, Shield, Wallet, CheckCircle2, ArrowRight, RefreshCw, Home } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CHARCOAL = "#141414";
const CARD_BG = "#1a1a1a";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.55)";

const FIRST_RUN_STEPS = ["first_run", "tos", "retainer"];

interface FirstRunWizardProps { children: React.ReactNode; }

export function FirstRunWizard({ children }: FirstRunWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0); // 0=welcome, 1=property, 2=tos, 3=retainer

  const isFirstRun = user?.role === "client" && FIRST_RUN_STEPS.includes((user as any).onboarding_step ?? "");

  const { data: tosData } = useQuery({
    queryKey: ["tos-current", user?.id],
    queryFn: () => apiRequest("GET", "/api/tos/current").then(r => r.json()),
    enabled: !!isFirstRun,
    staleTime: 0,
  });

  const { data: propData } = useQuery({
    queryKey: ["my-properties"],
    queryFn: () => apiRequest("GET", "/api/properties/my").then(r => r.json()),
    enabled: !!isFirstRun,
    staleTime: 0,
  });

  const acceptTosMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", "/api/tos/accept", { tosVersionId: id }),
    onSuccess: () => {
      toast({ title: "Terms accepted" });
      qc.invalidateQueries({ queryKey: ["tos-current"] });
      setStep(3);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/users/${user?.id}`, { onboarding_step: "complete" }),
    onSuccess: () => {
      toast({ title: "Welcome to Standing Rock!", description: "Your portal is ready." });
      qc.invalidateQueries({ queryKey: ["auth-me"] });
      window.location.reload(); // refresh user state
    },
  });

  if (!isFirstRun) return <>{children}</>;

  const property = propData?.[0] ?? null;
  const version = tosData?.version ?? null;

  const steps = [
    { icon: Anchor, label: "Welcome" },
    { icon: Home, label: "Your Property" },
    { icon: Shield, label: "Terms of Service" },
    { icon: Wallet, label: "Retainer" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.90)", backdropFilter: "blur(6px)" }}>
        <div className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: CHARCOAL, border: `1px solid rgba(192,90,67,0.25)` }}>

          {/* Step indicator */}
          <div className="px-6 pt-5 pb-4 flex items-center gap-2" style={{ background: CARD_BG }}>
            {steps.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: done ? SAGE : active ? `${TERRACOTTA}33` : "#222", border: `1.5px solid ${done ? SAGE : active ? TERRACOTTA : "#333"}` }}>
                      {done ? <CheckCircle2 size={14} style={{ color: SAGE }} /> : <Icon size={13} style={{ color: active ? TERRACOTTA : MUTED }} />}
                    </div>
                    <span className="text-xs font-medium hidden sm:block" style={{ color: active ? CREAM : MUTED, fontFamily: SANS }}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <div className="flex-1 h-px mx-1" style={{ background: i < step ? SAGE : "#2a2a2a" }} />}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="px-6 py-6">
            {step === 0 && (
              <div className="text-center">
                <Anchor size={48} style={{ color: TERRACOTTA, margin: "0 auto 16px" }} />
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: SERIF, color: CREAM }}>Welcome to Standing Rock</h2>
                <p className="text-base mb-6 leading-relaxed" style={{ color: MUTED, fontFamily: SANS }}>
                  Your property is in good hands. We'll walk you through a quick setup so you know exactly what to expect.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                  {[
                    { icon: Home, text: "Review your property details" },
                    { icon: Shield, text: "Accept our Terms of Service" },
                    { icon: Wallet, text: "Optional: top up your retainer" },
                    { icon: CheckCircle2, text: "Your portal is ready to go" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "#1a1a1a" }}>
                      <Icon size={15} style={{ color: SAGE, flexShrink: 0 }} />
                      <span className="text-sm" style={{ color: CREAM, fontFamily: SANS }}>{text}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(1)} className="w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                  style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                  Get Started <ArrowRight size={16} />
                </button>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Home size={22} style={{ color: TERRACOTTA }} />
                  <h2 className="text-xl font-bold" style={{ fontFamily: SERIF, color: CREAM }}>Your Property</h2>
                </div>
                {property ? (
                  <div className="rounded-xl p-4 mb-5" style={{ background: CARD_BG, border: "1px solid #222" }}>
                    <p className="text-lg font-bold mb-1" style={{ color: CREAM, fontFamily: SERIF }}>{property.nickname}</p>
                    <p className="text-sm mb-3" style={{ color: MUTED, fontFamily: SANS }}>{property.address}, {property.city}, {property.state}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize" style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA }}>{property.service_tier?.replace("_", " ")}</span>
                      {property.has_dock && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#222", color: MUTED }}>Dock</span>}
                      {property.has_boat && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#222", color: MUTED }}>Boat</span>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 mb-5 text-center" style={{ background: CARD_BG, border: "1px solid #222" }}>
                    <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>No property linked yet. Your property steward will link your property shortly.</p>
                  </div>
                )}
                <p className="text-sm mb-5" style={{ color: MUTED, fontFamily: SANS }}>
                  If any details look incorrect, contact us at <strong style={{ color: CREAM }}>(918) 707-2228</strong>.
                </p>
                <button onClick={() => setStep(2)} className="w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                  style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Shield size={22} style={{ color: TERRACOTTA }} />
                  <h2 className="text-xl font-bold" style={{ fontFamily: SERIF, color: CREAM }}>Terms of Service</h2>
                </div>
                {version ? (
                  <>
                    <div className="rounded-xl p-4 mb-4 overflow-y-auto text-sm leading-relaxed" style={{ background: CARD_BG, border: "1px solid #222", maxHeight: 200, color: "rgba(245,240,234,0.75)", fontFamily: SANS }}>
                      {version.body?.split("\n").slice(0, 20).map((line: string, i: number) => (
                        <p key={i} className="mb-1">{line}</p>
                      ))}
                      <p className="mt-2 text-xs" style={{ color: MUTED }}>… Scroll up for full terms or visit standingrockstewards.com/terms</p>
                    </div>
                    <p className="text-sm mb-4" style={{ color: MUTED, fontFamily: SANS }}>
                      Version: <strong style={{ color: CREAM }}>{version.version_label}</strong> · Effective {version.effective_date?.split("T")[0]}
                    </p>
                    <button
                      onClick={() => acceptTosMutation.mutate(version.id)}
                      disabled={acceptTosMutation.isPending}
                      className="w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                      style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                      {acceptTosMutation.isPending ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={15} /> I Accept the Terms</>}
                    </button>
                    {tosData?.accepted && (
                      <button onClick={() => setStep(3)} className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: "#1a1a1a", color: SAGE, fontFamily: SANS }}>
                        Already accepted · Continue
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-3" style={{ color: MUTED }} />
                    <p style={{ color: MUTED, fontFamily: SANS }}>Loading terms…</p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="text-center">
                <Wallet size={48} style={{ color: SAGE, margin: "0 auto 16px" }} />
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: SERIF, color: CREAM }}>Retainer Balance</h2>
                <p className="text-base mb-6 leading-relaxed" style={{ color: MUTED, fontFamily: SANS }}>
                  A retainer keeps your account ready for task billing. You can top up anytime from your portal.
                  This step is optional — you can skip it now.
                </p>
                <div className="rounded-xl p-4 mb-6 text-left" style={{ background: CARD_BG, border: "1px solid #222" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: CREAM, fontFamily: SERIF }}>How the retainer works:</p>
                  <ul className="space-y-1.5 text-sm" style={{ color: MUTED, fontFamily: SANS }}>
                    <li>• SRSC draws from your retainer for completed tasks</li>
                    <li>• You'll be notified of any draw above your threshold</li>
                    <li>• Top up anytime via check, ACH, or card</li>
                    <li>• Balance is refunded at termination after final settlement</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => dismissMutation.mutate()} className="flex-1 py-3.5 rounded-xl font-semibold text-base"
                    style={{ background: "#1a1a1a", color: MUTED, fontFamily: SANS, border: "1px solid #222" }}>
                    Skip for now
                  </button>
                  <button onClick={() => dismissMutation.mutate()} className="flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                    style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                    <CheckCircle2 size={15} /> Enter Portal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
