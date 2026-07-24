/**
 * Client Portal — Complete Property View
 * Sections: Dashboard (property overview, assets, visits, activity)
 *           Accessible via hash anchors + sidebar nav
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  Building2, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  Clock, FileText, Home, MapPin, Package, Shield,
  Wrench, Zap, Anchor, AlertTriangle, Activity, Star,
  Thermometer, Wind, Wifi, WifiOff, Wallet,
} from "lucide-react";
import { ClientDashboardFinancials } from "@/components/client-dashboard-financials";

// ─── Brand palette ─────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub }: { icon: React.ComponentType<any>; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-lg p-2" style={{ background: `${TERRACOTTA}18`, border: `1px solid ${TERRACOTTA}33` }}>
        <Icon size={16} style={{ color: TERRACOTTA }} />
      </div>
      <div>
        <h2 className="text-lg font-bold leading-none" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>{title}</h2>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#888" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    anchor_watch: { label: "Anchor Watch", color: SAGE },
    shipshape: { label: "Shipshape", color: "#5A7A8C" },
    signal_flare: { label: "Signal Flare", color: TERRACOTTA },
    launch_crew: { label: "Launch Crew", color: "#8B7355" },
  };
  const { label, color } = labels[tier] ?? { label: tier, color: "#888" };
  return (
    <span className="text-xs font-bold rounded-full px-2.5 py-0.5"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

// ─── Property Switcher ───────────────────────────────────────────────────────
function PropertySwitcher({
  properties, activeId, onSelect,
}: { properties: any[]; activeId: number; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const active = properties.find(p => p.id === activeId);
  if (properties.length <= 1) return null;
  return (
    <div className="relative inline-block mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CREAM }}
      >
        <Building2 size={14} style={{ color: TERRACOTTA }} />
        {active?.nickname ?? "Select property"}
        <ChevronDown size={14} style={{ color: "#666", marginLeft: 4 }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: "#1e1e1e", border: `1px solid ${CARD_BORDER}`, minWidth: 220 }}>
          {properties.map(p => (
            <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
              style={{ color: p.id === activeId ? TERRACOTTA : CREAM }}>
              <Home size={13} style={{ color: p.id === activeId ? TERRACOTTA : "#666" }} />
              <div>
                <div className="font-semibold">{p.nickname}</div>
                <div className="text-xs" style={{ color: "#666" }}>{p.address}, {p.city}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Property Overview Card ──────────────────────────────────────────────────
function PropertyOverview({ prop }: { prop: any }) {
  const featureIcons = [
    prop.hasDock && { icon: Anchor, label: "Dock" },
    prop.hasBoat && { icon: Anchor, label: "Boat" },
    prop.hasGenerator && { icon: Zap, label: "Generator" },
    prop.hasIrrigation && { icon: Wind, label: "Irrigation" },
    prop.hasAlarm && { icon: Shield, label: "Alarm" },
    prop.hasPropane && { icon: Thermometer, label: "Propane" },
  ].filter(Boolean) as { icon: React.ComponentType<any>; label: string }[];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      {/* Header stripe */}
      <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid ${CARD_BORDER}`, background: "#141414" }}>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: TERRACOTTA }}>
            Your Property
          </div>
          <h1 className="text-2xl font-bold leading-none" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            {prop.nickname}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <MapPin size={12} style={{ color: "#666" }} />
            <span className="text-sm" style={{ color: "#999" }}>{prop.address}, {prop.city}, {prop.state} {prop.zip}</span>
          </div>
        </div>
        <TierBadge tier={prop.serviceTier} />
      </div>

      {/* Features */}
      {featureIcons.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          {featureIcons.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${SAGE}18`, color: SAGE, border: `1px solid ${SAGE}33` }}>
              <Icon size={11} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Emergency contact + boat details */}
      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        {prop.emergencyContactName && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Emergency Contact</div>
            <div className="text-sm font-semibold" style={{ color: CREAM }}>{prop.emergencyContactName}</div>
            <div className="text-xs" style={{ color: "#888" }}>{prop.emergencyContactPhone}</div>
          </div>
        )}
        {prop.boatDetails && (() => {
          try {
            const b = JSON.parse(prop.boatDetails);
            return (
              <div>
                <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Boat</div>
                <div className="text-sm font-semibold" style={{ color: CREAM }}>{b.name ?? ""}</div>
                <div className="text-xs" style={{ color: "#888" }}>{b.make} {b.type}</div>
              </div>
            );
          } catch { return null; }
        })()}
      </div>
    </div>
  );
}

// ─── Assets / Appliances ─────────────────────────────────────────────────────
function AppliancesSection({ propertyId }: { propertyId: number }) {
  const { data: appliances = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/properties", propertyId, "appliances"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/${propertyId}/appliances`);
      return r.json();
    },
  });

  if (isLoading) return <div className="h-20 rounded-xl animate-pulse" style={{ background: CARD_BG }} />;
  if (!appliances.length) return (
    <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <Package size={28} style={{ color: "#333", margin: "0 auto 8px" }} />
      <p className="text-sm" style={{ color: "#555" }}>No appliances or assets on file yet.</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
            {["Item", "Make / Model", "Serial #", "Location"].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide"
                style={{ color: "#666" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {appliances.map((a, i) => (
            <tr key={a.id} style={{ background: i % 2 === 0 ? CARD_BG : "#1e1e1e", borderBottom: `1px solid #1a1a1a` }}>
              <td className="px-4 py-3 font-semibold" style={{ color: CREAM }}>{a.name}</td>
              <td className="px-4 py-3" style={{ color: "#aaa" }}>{[a.make, a.model].filter(Boolean).join(" ") || "—"}</td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: "#777" }}>{a.serial || "—"}</td>
              <td className="px-4 py-3" style={{ color: "#888" }}>{a.location || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Upcoming Visits ─────────────────────────────────────────────────────────
function UpcomingVisits({ propertyId }: { propertyId: number }) {
  const { data: calendar = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/calendar"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/calendar");
      return r.json();
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const upcoming = useMemo(() =>
    calendar
      .filter(ev => ev.propertyId === propertyId && ev.date >= today && !ev.completed)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
    [calendar, propertyId, today]
  );

  if (isLoading) return <div className="h-20 rounded-xl animate-pulse" style={{ background: CARD_BG }} />;
  if (!upcoming.length) return (
    <div className="rounded-xl p-5 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <Calendar size={24} style={{ color: "#333", margin: "0 auto 8px" }} />
      <p className="text-sm" style={{ color: "#555" }}>No upcoming visits scheduled.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {upcoming.map(ev => {
        const isStorm = ev.type === "storm_response";
        const color = isStorm ? "#7B3FA0" : TERRACOTTA;
        return (
          <div key={ev.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: CARD_BG, border: `1px solid ${isStorm ? "#3a2060" : CARD_BORDER}` }}>
            <div className="rounded-lg p-2" style={{ background: `${color}18` }}>
              {isStorm ? <Zap size={14} style={{ color }} /> : <Calendar size={14} style={{ color }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: CREAM }}>{ev.title}</div>
              {ev.notes && <div className="text-xs truncate" style={{ color: "#777" }}>{ev.notes}</div>}
            </div>
            <div className="text-xs font-bold" style={{ color }}>
              {fmtDate(ev.date)}{ev.time ? ` · ${ev.time}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Visit History ────────────────────────────────────────────────────────────
function VisitHistory({ propertyId }: { propertyId: number }) {
  const { data: visits = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/properties", propertyId, "visits"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/${propertyId}/visits`);
      return r.json();
    },
  });

  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <div className="h-20 rounded-xl animate-pulse" style={{ background: CARD_BG }} />;
  if (!visits.length) return (
    <div className="rounded-xl p-5 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <FileText size={24} style={{ color: "#333", margin: "0 auto 8px" }} />
      <p className="text-sm" style={{ color: "#555" }}>No completed visits yet.</p>
    </div>
  );

  const STATUS_COLORS: Record<string, string> = {
    completed: "#4a9a6a", all_clear: "#4a9a6a",
    items_flagged: "#D9902B", in_progress: "#7A8C6E",
  };

  return (
    <div className="space-y-2">
      {visits.slice(0, 10).map((v: any) => {
        const statusColor = STATUS_COLORS[v.overallStatus ?? v.status] ?? "#888";
        const isOpen = expanded === v.id;
        return (
          <div key={v.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              onClick={() => setExpanded(isOpen ? null : v.id)}>
              <div className="rounded-lg p-1.5" style={{ background: `${statusColor}18` }}>
                <CheckCircle2 size={14} style={{ color: statusColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: CREAM }}>
                    {(v.visitType ?? "routine").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} Visit
                  </span>
                  <span className="text-xs rounded-full px-2 py-0.5 font-semibold capitalize"
                    style={{ background: `${statusColor}22`, color: statusColor }}>
                    {(v.overallStatus ?? v.status ?? "").replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#666" }}>{fmtDate(v.visitDate)}</div>
              </div>
              {isOpen ? <ChevronDown size={14} style={{ color: "#555" }} /> : <ChevronRight size={14} style={{ color: "#555" }} />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                {v.generalNotes && (
                  <div className="pt-3">
                    <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Summary</div>
                    <p className="text-sm" style={{ color: "#ccc" }}>{v.generalNotes}</p>
                  </div>
                )}
                {v.actionsTaken && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Actions Taken</div>
                    <p className="text-sm" style={{ color: "#ccc" }}>{v.actionsTaken}</p>
                  </div>
                )}
                {v.nextScheduledVisit && (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7A8C6E" }}>
                    <Calendar size={11} />
                    <span>Next visit: {fmtDate(v.nextScheduledVisit)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
function ActivityFeed({ propertyId, clientId }: { propertyId: number; clientId: number }) {
  const { data: visits = [] } = useQuery<any[]>({
    queryKey: ["/api/properties", propertyId, "visits"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/${propertyId}/visits`);
      return r.json();
    },
  });
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["/api/service-requests", clientId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/service-requests?clientId=${clientId}&propertyId=${propertyId}`);
      return r.json();
    },
  });
  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/property-messages", propertyId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/property-messages?propertyId=${propertyId}`);
      return r.json();
    },
  });

  type ActivityItem = { date: string; icon: React.ComponentType<any>; color: string; text: string };

  const activity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const v of visits.slice(0, 5)) {
      items.push({ date: v.visitDate, icon: CheckCircle2, color: "#4a9a6a", text: `Completed ${(v.visitType ?? "routine").replace(/_/g, " ")} visit` });
    }
    for (const r of requests.slice(0, 5)) {
      items.push({ date: r.created_at, icon: Wrench, color: TERRACOTTA, text: `Service request submitted: ${r.category}` });
    }
    for (const m of messages.slice(-5)) {
      const isStaff = m.sender_role !== "client";
      items.push({ date: m.sent_at, icon: Activity, color: isStaff ? SAGE : "#888", text: isStaff ? `Message from Standing Rock` : `You sent a message` });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [visits, requests, messages]);

  if (!activity.length) return (
    <div className="rounded-xl p-5 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <Activity size={24} style={{ color: "#333", margin: "0 auto 8px" }} />
      <p className="text-sm" style={{ color: "#555" }}>No recent activity.</p>
    </div>
  );

  return (
    <div className="space-y-0">
      {activity.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: i < activity.length - 1 ? `1px solid #1e1e1e` : "none" }}>
            <div className="rounded-full p-1.5 mt-0.5 flex-shrink-0" style={{ background: `${item.color}18` }}>
              <Icon size={12} style={{ color: item.color }} />
            </div>
            <div className="flex-1">
              <div className="text-sm" style={{ color: "#d0cec9" }}>{item.text}</div>
              <div className="text-xs mt-0.5" style={{ color: "#555" }}>{fmtDateTime(item.date)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Client Portal Page ──────────────────────────►���──────────────────────
export default function ClientPortal() {
  const { user } = useAuth();

  const { data: properties = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user.id}`);
      return r.json();
    },
    enabled: !!user?.id,
  });

  const [activePropId, setActivePropId] = useState<number | null>(null);
  const property = useMemo(() => {
    if (!properties.length) return null;
    return properties.find(p => p.id === activePropId) ?? properties[0];
  }, [properties, activePropId]);

  if (isLoading) {
    return (
      <AppLayout title="My Property">
        <div className="p-6 space-y-4 max-w-3xl mx-auto">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}
        </div>
      </AppLayout>
    );
  }

  if (!property) {
    return (
      <AppLayout title="My Property">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Building2 size={40} style={{ color: "#333", margin: "0 auto 12px" }} />
            <p style={{ color: "#666" }}>No properties linked to your account.</p>
            <p className="text-sm mt-1" style={{ color: "#444" }}>Contact Standing Rock at (918) 707-2228.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Property" subtitle={property.nickname}>
    <div className="p-4 md:p-6 space-y-8 max-w-3xl mx-auto">
      {/* Property switcher (only if multiple) */}
        <PropertySwitcher
        properties={properties}
        activeId={property.id}
        onSelect={setActivePropId}
      />

      {/* Property overview */}
      <PropertyOverview prop={property} />

      {/* Financial Overview — retainer + upcoming costs */}
      <section>
        <ClientDashboardFinancials clientId={user!.id} />
      </section>

      {/* Upcoming Visits */}
      <section>
        <SectionHeader icon={Calendar} title="Upcoming Visits" sub="Scheduled and storm-response visits for your property" />
        <UpcomingVisits propertyId={property.id} />
      </section>

      {/* Assets / Appliances */}
      <section>
        <SectionHeader icon={Package} title="Property Assets" sub="High-value appliances and equipment tracked by Standing Rock" />
        <AppliancesSection propertyId={property.id} />
      </section>

      {/* Visit History */}
      <section>
        <SectionHeader icon={FileText} title="Visit History" sub="Completed inspections and after-action reports" />
        <VisitHistory propertyId={property.id} />
      </section>

      {/* Activity Feed */}
      <section>
        <SectionHeader icon={Activity} title="Recent Activity" sub="Visits, requests, and messages for this property" />
        <div className="rounded-xl px-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <ActivityFeed propertyId={property.id} clientId={user!.id} />
        </div>
      </section>
    </div>
    </AppLayout>
  );
}
