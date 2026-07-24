/**
 * ToS Gate — wraps the app to enforce ToS acceptance before billing/quote approval.
 * Shows modal if current user has not accepted the current ToS version.
 * Also handles re-acceptance when a new version is published.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle2, FileText, RefreshCw } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CHARCOAL = "#141414";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.55)";

// Only require ToS for clients (not staff/vendor)
const REQUIRES_TOS_ROLES = ["client"];

interface TosGateProps {
  children: React.ReactNode;
}

export function TosGate({ children }: TosGateProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const needsTosCheck = user && REQUIRES_TOS_ROLES.includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ["tos-current", user?.id],
    queryFn: () => apiRequest("GET", "/api/tos/current").then(r => r.json()),
    enabled: !!needsTosCheck,
    staleTime: 0,
  });

  const acceptMutation = useMutation({
    mutationFn: (tosVersionId: number) => apiRequest("POST", "/api/tos/accept", { tosVersionId }),
    onSuccess: () => {
      toast({ title: "Terms accepted", description: "Welcome to your Standing Rock portal." });
      qc.invalidateQueries({ queryKey: ["tos-current"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const showModal = needsTosCheck && !isLoading && data && !data.accepted;

  if (!needsTosCheck || isLoading || !showModal) {
    return <>{children}</>;
  }

  const version = data?.version;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: CHARCOAL, border: `1px solid rgba(192,90,67,0.3)` }}>
          {/* Header */}
          <div className="px-6 py-5 flex items-center gap-4" style={{ background: "#1a1a1a", borderBottom: "1px solid #222" }}>
            <div className="p-2.5 rounded-xl" style={{ background: `${TERRACOTTA}22` }}>
              <Shield size={22} style={{ color: TERRACOTTA }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Terms of Service</h2>
              <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>
                {version?.version_label ?? "Current Version"} · Review and accept to continue
              </p>
            </div>
            <div className="ml-auto">
              <FileText size={18} style={{ color: MUTED }} />
            </div>
          </div>

          {/* ToS Body */}
          <div
            className="overflow-y-auto px-6 py-4 prose prose-invert max-w-none"
            style={{ maxHeight: "45vh", fontSize: 15, lineHeight: 1.7, color: "rgba(245,240,234,0.8)", fontFamily: SANS }}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
            }}
          >
            {/* Render body as plain text with basic markdown-like formatting */}
            {(version?.body ?? "").split("\n").map((line: string, i: number) => {
              if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-4 mb-1" style={{ color: CREAM, fontFamily: SERIF }}>{line.replace("## ", "")}</h3>;
              if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-2 mb-2" style={{ color: CREAM, fontFamily: SERIF }}>{line.replace("# ", "")}</h2>;
              if (line.startsWith("> ")) return <div key={i} className="border-l-4 pl-4 py-2 my-2 text-sm rounded-r" style={{ borderColor: TERRACOTTA, background: `${TERRACOTTA}11`, color: "rgba(245,240,234,0.7)" }}>{line.replace("> ", "")}</div>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold" style={{ color: CREAM }}>{line.replace(/\*\*/g, "")}</p>;
              if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
              return <p key={i} className="mb-1">{line}</p>;
            })}
          </div>

          {!scrolled && (
            <div className="px-6 py-2 flex items-center gap-2" style={{ background: "#111", borderTop: "1px solid #1a1a1a" }}>
              <RefreshCw size={13} style={{ color: MUTED }} />
              <span className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>Scroll to read the full terms before accepting</span>
            </div>
          )}

          {/* Acceptance */}
          <div className="px-6 py-5" style={{ borderTop: "1px solid #222", background: "#1a1a1a" }}>
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                disabled={!scrolled}
                className="mt-0.5 w-4 h-4 accent-orange-600 flex-shrink-0"
              />
              <span className="text-sm leading-relaxed" style={{ color: scrolled ? CREAM : MUTED, fontFamily: SANS }}>
                I have read and agree to the Standing Rock Stewardship Co. Terms of Service ({version?.version_label}).
                I understand these terms govern the services provided for my property.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => acceptMutation.mutate(version?.id)}
                disabled={!agreed || !scrolled || acceptMutation.isPending}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all"
                style={{
                  background: agreed && scrolled ? TERRACOTTA : "#2a2a2a",
                  color: agreed && scrolled ? CREAM : MUTED,
                  fontFamily: SANS,
                  cursor: agreed && scrolled ? "pointer" : "not-allowed",
                }}
              >
                {acceptMutation.isPending
                  ? <><RefreshCw size={15} className="animate-spin" /> Saving…</>
                  : <><CheckCircle2 size={15} /> I Accept These Terms</>
                }
              </button>
            </div>

            <p className="text-xs text-center mt-3" style={{ color: MUTED, fontFamily: SANS }}>
              Your acceptance is logged with a timestamp for your records.
              Contact <a href="mailto:info@standingrockstewards.com" style={{ color: TERRACOTTA }}>info@standingrockstewards.com</a> with questions.
            </p>
          </div>
        </div>
      </div>
      {/* Children visible but blocked behind modal */}
      {children}
    </>
  );
}
