/**
 * src/hooks/useBadges.ts  (Brick 10b)
 *
 * Fetches badge counts once after auth resolves. No polling in 10b.
 * A failed fetch degrades to count=0 + console.warn — the nav always renders.
 *
 * Badge sources (all verified in STEP 0):
 *
 * Properties & People — low-retainer-balance count
 *   LIVE: GET /api/v2/retainer/low-balance → LowBalanceProperty[]
 *   Auth: admin/supervisor only (returns 403 for client/field_tech → badge hidden)
 *
 * Field Operations — open/pending job count
 *   LIVE: GET /api/v2/jobs?status=pending&limit=200 ... (see OPEN_STATUSES below)
 *   GET /api/v2/jobs supports ?status= filter; "open" = pending|scheduled|dispatched|in_progress.
 *   We make four parallel requests and sum results.
 *   Auth: requireNotVendor — admin, supervisor, field_tech all see this route.
 *   Note: field_tech sees only their own assigned jobs. The badge count reflects that scope.
 *
 * Admin/Staff — pending referrals
 *   LIVE: GET /api/v2/referrals?status=pending → Referral[]
 *   Auth: requireAdminOrSupervisor (returns 403 for other roles → badge hidden)
 *
 * All IDs are text. No integer parsing on any resource ID or FK.
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { LowBalanceProperty, StewardshipJob, Referral } from "@/types";

export interface BadgeCounts {
  lowBalanceProperties: number;   // Properties & People badge
  openJobs: number;               // Field Operations badge
  pendingReferrals: number;       // Admin/Staff badge
}

const ZERO: BadgeCounts = { lowBalanceProperties: 0, openJobs: 0, pendingReferrals: 0 };

// Open job statuses — verified against JOB_STATUSES in schema-v2.ts
const OPEN_STATUSES = ["pending", "scheduled", "dispatched", "in_progress"] as const;

export function useBadges(): BadgeCounts {
  const { isAuthenticated, role } = useAuth();
  const [counts, setCounts] = useState<BadgeCounts>(ZERO);

  useEffect(() => {
    if (!isAuthenticated || !role) return;

    const fetchBadges = async () => {
      const next: BadgeCounts = { ...ZERO };

      // ── Properties & People: low-balance count ─────────────────────────────
      // Only admin/supervisor have access; skip for other roles to avoid a 403.
      if (role === "admin" || role === "supervisor") {
        try {
          const rows = await api.get<LowBalanceProperty[]>("/retainer/low-balance");
          next.lowBalanceProperties = rows.length;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 403)) {
            console.warn("[useBadges] low-balance fetch failed:", err);
          }
        }
      }

      // ── Field Operations: open/pending job count ───────────────────────────
      // Fetch all four open statuses in parallel; sum lengths.
      // field_tech: scoped to their own assigned jobs by the backend.
      // vendor: 403 (requireNotVendor) → skip.
      if (role !== "vendor") {
        try {
          const results = await Promise.all(
            OPEN_STATUSES.map((status) =>
              api.get<StewardshipJob[]>(`/jobs?status=${status}&limit=200`).catch((err) => {
                if (!(err instanceof ApiError && err.status === 403)) {
                  console.warn(`[useBadges] jobs?status=${status} failed:`, err);
                }
                return [] as StewardshipJob[];
              }),
            ),
          );
          next.openJobs = results.reduce((sum, rows) => sum + rows.length, 0);
        } catch (err) {
          console.warn("[useBadges] open jobs fetch failed:", err);
        }
      }

      // ── Admin/Staff: pending referrals ─────────────────────────────────────
      if (role === "admin" || role === "supervisor") {
        try {
          const rows = await api.get<Referral[]>("/referrals?status=pending");
          next.pendingReferrals = rows.length;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 403)) {
            console.warn("[useBadges] pending referrals fetch failed:", err);
          }
        }
      }

      setCounts(next);
    };

    fetchBadges();
    // Intentionally no polling in 10b — re-run only when auth changes.
  }, [isAuthenticated, role]);

  return counts;
}
