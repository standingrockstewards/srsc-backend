/**
 * Data Export Panel
 * Admin: export any property's data (CSV)
 * Client: export own account data
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, FileText, User } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function downloadCSV(rows: any[], filename: string) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Client self-export ──────────────────────────────────────────────────────
export function ClientDataExport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const doExport = async (format: "json" | "csv") => {
    setLoading(true);
    try {
      const data = await apiRequest("GET", "/api/me/export");
      if (format === "csv") {
        // Flatten top-level keys to CSV
        const rows = [{ ...data.account, ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== "account" && typeof data[k] !== "object")) }];
        downloadCSV(rows, "my-account-export.csv");
      } else {
        downloadJSON(data, "my-account-export.json");
      }
      toast({ title: "Export ready", description: "File download started." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center gap-2 mb-3">
        <User size={16} style={{ color: TERRACOTTA }} />
        <p className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>Export My Data</p>
      </div>
      <p className="text-sm mb-4" style={{ color: MUTED, fontFamily: SANS }}>Download your account, property, and billing data.</p>
      <div className="flex gap-3">
        <button onClick={() => doExport("csv")} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, fontFamily: SANS }}>
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} CSV
        </button>
        <button onClick={() => doExport("json")} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#222", color: MUTED, fontFamily: SANS }}>
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />} JSON
        </button>
      </div>
    </div>
  );
}

// ─── Admin property export ───────────────────────────────────────────────────
export function AdminPropertyExport({ propertyId, propertyName }: { propertyId: number; propertyName: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<"json" | "csv">("csv");

  const doExport = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("GET", `/api/properties/${propertyId}/export?format=${format}`);
      if (format === "csv") {
        // Data may come as array or {rows:[]}
        const rows = Array.isArray(data) ? data : (data.rows ?? [data]);
        downloadCSV(rows, `property-${propertyId}-export.csv`);
      } else {
        downloadJSON(data, `property-${propertyId}-export.json`);
      }
      toast({ title: "Export ready", description: `${propertyName} — download started.` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} style={{ color: SAGE }} />
        <p className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>Export Property Data</p>
      </div>
      <p className="text-sm mb-4" style={{ color: MUTED, fontFamily: SANS }}>{propertyName} — visits, documents, billing, service requests.</p>
      <div className="flex items-center gap-3">
        <select value={format} onChange={e => setFormat(e.target.value as "json" | "csv")}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <button onClick={doExport} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: SAGE, color: "#111", fontFamily: SANS }}>
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} Export
        </button>
      </div>
    </div>
  );
}
