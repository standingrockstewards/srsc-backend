import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const map: Record<string, { label: string; className: string }> = {
    all_clear:      { label: "All Clear", className: "status-clear" },
    items_flagged:  { label: "Items Flagged", className: "status-flagged" },
    action_required:{ label: "Action Required", className: "status-action" },
    submitted:      { label: "Submitted", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    in_progress:    { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    approved:       { label: "Approved", className: "status-clear" },
  };
  const cfg = map[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  const map: Record<string, { label: string; className: string; icon?: ReactNode }> = {
    anchor_watch:  { label: "Anchor Watch", className: "tier-anchor" },
    shipshape:     { label: "Shipshape", className: "tier-shipshape" },
    launch_crew:   { label: "Launch Crew", className: "tier-launch" },
    signal_flare:  {
      label: "Signal Flare",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      icon: <span style={{ fontSize: "0.65rem", marginRight: "3px" }}>⚡</span>,
    },
  };
  const cfg = map[tier] ?? { label: tier, className: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.icon ?? null}{cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const map: Record<string, string> = {
    Low:    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    Medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    High:   "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    Urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  const cls = map[priority ?? "Medium"] ?? "";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {priority ?? "Medium"}
    </span>
  );
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const map: Record<string, { label: string; className: string }> = {
    admin:      { label: "Admin", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    field_tech: { label: "Field Tech", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    client:     { label: "Client", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  };
  const cfg = map[role ?? ""] ?? { label: role ?? "", className: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
