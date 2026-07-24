/**
 * Client — Referral Program Page
 * Shows referral code/link + stats.
 */
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { useState } from "react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

export default function ReferralPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-referral"],
    queryFn: () => apiRequest("GET", "/api/me/referral").then(r => r.json()),
    staleTime: 0,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(data?.referralLink ?? "");
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <AppLayout title="Refer a Friend" subtitle="Earn rewards for referrals">
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg" style={{ background: `${TERRACOTTA}22` }}>
            <Gift size={20} style={{ color: TERRACOTTA }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Refer a Friend</h1>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>Share your code — we'll handle the rest</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16">
            <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        {data && (
          <>
            {/* Code card */}
            <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: CARD_BG, border: `1px solid ${TERRACOTTA}33` }}>
              <p className="text-sm font-medium mb-2" style={{ color: MUTED, fontFamily: SANS }}>Your Referral Code</p>
              <p className="text-4xl font-bold tracking-widest mb-4" style={{ color: TERRACOTTA, fontFamily: SERIF }}>{data.referralCode}</p>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base transition-all"
                style={{ background: copied ? `${SAGE}22` : TERRACOTTA, color: copied ? SAGE : CREAM, fontFamily: SANS }}
              >
                {copied ? <><CheckCircle2 size={16} /> Copied!</> : <><Copy size={16} /> Copy Referral Link</>}
              </button>
              <p className="text-xs mt-3 break-all" style={{ color: MUTED, fontFamily: SANS }}>{data.referralLink}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Referred", value: data.stats?.total ?? 0, color: CREAM },
                { label: "Pending", value: data.stats?.pending ?? 0, color: "#d4b800" },
                { label: "Converted", value: data.stats?.converted ?? 0, color: SAGE },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                  <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: SERIF }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: SANS }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Referral history */}
            {(data.referrals ?? []).length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                  <Users size={15} style={{ color: MUTED }} />
                  <span className="text-sm font-semibold" style={{ color: CREAM, fontFamily: SANS }}>Referred Accounts</span>
                </div>
                {data.referrals.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: CARD_BORDER }}>
                    <div>
                      <p className="text-sm" style={{ color: CREAM, fontFamily: SANS }}>{r.referred_email ?? "Pending sign-up"}</p>
                      <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                      style={{
                        background: r.status === "converted" ? `${SAGE}22` : r.status === "signed_up" ? "#2a2a00" : "#222",
                        color: r.status === "converted" ? SAGE : r.status === "signed_up" ? "#d4b800" : MUTED,
                      }}>
                      {r.status === "signed_up" ? "Pending" : r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl p-4 mt-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <p className="text-sm font-semibold mb-1" style={{ color: CREAM, fontFamily: SERIF }}>How it works</p>
              <ul className="text-sm space-y-1" style={{ color: MUTED, fontFamily: SANS }}>
                <li>• Share your code with lake property owners you know</li>
                <li>• They sign up and are activated by our team</li>
                <li>• We'll reach out to discuss your referral reward</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
