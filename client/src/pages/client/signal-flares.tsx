/**
 * Client Signal Flares page
 * Shows their flares + raise button
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import { RaiseFlareButton, ClientFlareList } from "@/components/client-signal-flare";
import { Flame, Shield } from "lucide-react";

const TERRACOTTA = "#C05A43";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

export default function ClientSignalFlaresPage() {
  const { user } = useAuth();

  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user?.id}`);
      return r.json();
    },
    enabled: !!user?.id,
  });

  const property = properties[0];

  return (
    <AppLayout title="Signal Flares" subtitle="Urgent property escalations">
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <div className="flex justify-center mb-3">
            <div className="rounded-full p-3" style={{ background: "#3A1010", border: "1px solid #C0392B" }}>
              <Flame size={28} style={{ color: "#C0392B" }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            Signal Flares
          </h1>
          <p className="text-sm" style={{ color: "#888" }}>
            For urgent situations that need immediate attention from the Standing Rock team.
          </p>
        </div>

        {/* What is a Signal Flare? */}
        <div className="rounded-xl px-4 py-3" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#aaa" }}>When to use a Signal Flare</div>
          <ul className="text-sm space-y-1.5" style={{ color: "#aaa" }}>
            {["Storm or flood damage to your property","Structural concerns (roof, foundation, siding)","Utility failure (power, propane, water)","Security breach or unauthorized access","Any situation needing our immediate response"].map(s => (
              <li key={s} className="flex items-start gap-2">
                <span style={{ color: "#C0392B", flexShrink: 0 }}>🔸</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 text-xs" style={{ borderTop: `1px solid ${CARD_BORDER}`, color: "#666" }}>
            For non-urgent needs, use <a href="#/service-requests" style={{ color: TERRACOTTA }}>Request Service</a> instead.
          </div>
        </div>

        {/* Raise button */}
        {property ? (
          <RaiseFlareButton propertyId={property.id} propertyName={property.nickname ?? property.address} />
        ) : (
          <div className="text-sm text-center" style={{ color: "#666" }}>No property linked to your account.</div>
        )}

        {/* Existing flares */}
        <ClientFlareList />
      </div>
    </AppLayout>
  );
}
