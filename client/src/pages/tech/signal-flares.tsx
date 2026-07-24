/**
 * Field Tech — My Assigned Signal Flares
 * Shows flares assigned to the logged-in tech; can add notes
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import { Flame, MessageSquare, Shield, Check, Loader2 } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

const SEV_COLOR: Record<string, string> = {
  Critical: "#C0392B", High: "#E67E22", Medium: "#D9902B", Low: "#7A8C6E",
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TechSignalFlaresPage() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<number | null>(null);

  const { data: flares = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/signal-flares"],
    queryFn: async () => (await apiRequest("GET", "/api/signal-flares")).json(),
    refetchInterval: 30000,
  });

  const addNote = async (flareId: number) => {
    const note = notes[flareId]?.trim();
    if (!note) return;
    setLoading(flareId);
    try {
      await apiRequest("PATCH", `/api/signal-flares/${flareId}`, { action: "note", note });
      setNotes(n => ({ ...n, [flareId]: "" }));
      refetch();
    } finally { setLoading(null); }
  };

  const markInProgress = async (flareId: number) => {
    setLoading(flareId);
    try {
      await apiRequest("PATCH", `/api/signal-flares/${flareId}`, { action: "in_progress" });
      refetch();
      qc.invalidateQueries({ queryKey: ["/api/signal-flares/count/open"] });
    } finally { setLoading(null); }
  };

  return (
    <AppLayout title="My Flares" subtitle="Signal Flares assigned to you">
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: CARD_BG }} />)}
          </div>
        ) : flares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield size={40} style={{ color: "#333" }} />
            <p style={{ color: "#555" }}>No flares assigned to you</p>
          </div>
        ) : (
          flares.map((f: any) => {
            const sevColor = SEV_COLOR[f.severity] ?? TERRACOTTA;
            const isActive = !["Resolved","Closed"].includes(f.status);
            return (
              <div key={f.id} className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isActive ? sevColor + "44" : CARD_BORDER}`, background: CARD_BG }}>
                {/* Header */}
                <div className="px-4 py-3" style={{ borderLeft: `4px solid ${sevColor}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2" style={{ color: CREAM }}>
                        <Flame size={14} style={{ color: sevColor }} />
                        {f.category}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#777" }}>
                        {f.property_name} · {timeAgo(f.created_at)}
                      </div>
                    </div>
                    <span className="text-xs font-bold rounded-full px-2.5 py-0.5 flex-shrink-0"
                      style={{ background: `${sevColor}18`, color: sevColor, border: `1px solid ${sevColor}33` }}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-sm mt-2" style={{ color: "#bbb" }}>{f.description}</p>
                </div>

                {/* Actions */}
                {isActive && (
                  <div className="px-4 py-3 flex gap-2" style={{ borderTop: `1px solid #1a1a1a` }}>
                    {f.status !== "In Progress" && (
                      <button onClick={() => markInProgress(f.id)}
                        disabled={loading === f.id}
                        className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
                        style={{ background: "#252525", border: "1px solid #333", color: "#aaa" }}>
                        {loading === f.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Mark In Progress
                      </button>
                    )}
                    <div className="flex gap-2 flex-1">
                      <input value={notes[f.id] ?? ""}
                        onChange={e => setNotes(n => ({ ...n, [f.id]: e.target.value }))}
                        placeholder="Add a note…"
                        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
                        onKeyDown={e => { if (e.key === "Enter") addNote(f.id); }} />
                      <button onClick={() => addNote(f.id)}
                        disabled={!notes[f.id]?.trim() || loading === f.id}
                        className="rounded-lg p-1.5"
                        style={{ background: TERRACOTTA, color: "#fff", opacity: !notes[f.id]?.trim() ? 0.5 : 1 }}>
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
