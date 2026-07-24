/**
 * Audit Log — GET /api/audit
 *
 * Immutable, read-only view over existing event/trail data.
 * Requires view_audit permission (Admin default; Supervisor grantable).
 *
 * Sources (read-only, no writes here):
 *   - quote_requests (status changes, decisions)
 *   - tos_acceptances (ToS signed records)
 *   - retainer_ledger (deposit/draw/adjustment)
 *   - client_billing_accounts (status changes — halted, collections, etc.)
 *   - user_permissions (overrides granted/revoked)
 *   - signal_flare_events (timeline per flare)
 *   - vendor_documents (verified/rejected actions)
 *   - users (deactivated_at → offboarding)
 *   - in_app_notifications (dunning/billing events)
 *
 * GET /api/audit?entity=&from=&to=&actor=&page=&limit=
 */

import { Router } from "express";
import { requirePermission } from "./permissions";
import { sqlite } from "./storage";

export const auditRouter = Router();

// ─── GET /api/audit ───────────────────────────────────���───────────────────────
auditRouter.get(
  "/audit",
  requirePermission("view_audit"),
  (req, res) => {
    try {
      const {
        entity,
        from,
        to,
        actor,
        page    = "1",
        limit   = "50",
      } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, Number(page));
      const limitNum = Math.min(Math.max(1, Number(limit)), 200);
      const offset   = (pageNum - 1) * limitNum;

      const rows: any[] = [];

      // ── Quote lifecycle events ──────────────────────────────────────────────
      if (!entity || entity === "quotes") {
        const quoteRows = sqlite
          .prepare(`
            SELECT
              qr.id as source_id,
              'quote' as entity,
              qr.title as summary,
              qr.status as action,
              qr.created_at as occurred_at,
              u_created.name as actor,
              u_reviewed.name as reviewer,
              p.nickname as property_name,
              qr.total,
              qr.client_decision,
              qr.client_decision_at
            FROM quote_requests qr
            LEFT JOIN users u_created  ON u_created.id  = qr.created_by
            LEFT JOIN users u_reviewed ON u_reviewed.id = qr.reviewed_by
            LEFT JOIN properties p ON p.id = qr.property_id
            ORDER BY qr.created_at DESC
          `)
          .all() as any[];

        // Emit one row per status transition we care about
        for (const q of quoteRows) {
          const events = [
            { action: "submitted",     at: q.occurred_at,         actor: q.actor },
            q.reviewer ? { action: "reviewed",  at: q.occurred_at, actor: q.reviewer } : null,
            q.client_decision ? {
              action: `client_${q.client_decision}`,
              at: q.client_decision_at ?? q.occurred_at,
              actor: "client",
            } : null,
          ].filter(Boolean) as { action: string; at: string; actor: string }[];

          for (const ev of events) {
            rows.push({
              id: `quote-${q.source_id}-${ev.action}`,
              entity: "quote",
              entity_id: q.source_id,
              summary: `Quote "${q.title}" — ${ev.action}`,
              action: ev.action,
              actor: ev.actor,
              property: q.property_name,
              amount: q.total,
              occurred_at: ev.at,
              link: `#/quotes/${q.source_id}`,
            });
          }
        }
      }

      // ── ToS acceptances ────────────────────────────────────────────────────
      if (!entity || entity === "tos") {
        const tosRows = sqlite
          .prepare(`
            SELECT ta.id, ta.accepted_at, ta.ip_address,
                   u.name as user_name, u.role as user_role,
                   tv.version_label
            FROM tos_acceptances ta
            LEFT JOIN users u ON u.id = ta.user_id
            LEFT JOIN tos_versions tv ON tv.id = ta.tos_version_id
            ORDER BY ta.accepted_at DESC
          `)
          .all() as any[];

        for (const t of tosRows) {
          rows.push({
            id: `tos-${t.id}`,
            entity: "tos",
            entity_id: t.id,
            summary: `ToS accepted — ${t.version_label} by ${t.user_name}`,
            action: "accepted",
            actor: t.user_name,
            actor_role: t.user_role,
            detail: `IP: ${t.ip_address ?? "unknown"}`,
            occurred_at: t.accepted_at,
            link: `#/tos-manager`,
          });
        }
      }

      // ── Retainer ledger ──────────────────────────────────────────���─────────
      if (!entity || entity === "billing") {
        const ledgerRows = sqlite
          .prepare(`
            SELECT rl.id, rl.entry_type, rl.amount, rl.balance_after, rl.note,
                   rl.created_at, u.name as created_by_name,
                   p.nickname as property_name, c.name as client_name
            FROM retainer_ledger rl
            LEFT JOIN users u ON u.id = rl.created_by
            LEFT JOIN properties p ON p.id = rl.property_id
            LEFT JOIN users c ON c.id = rl.client_id
            ORDER BY rl.created_at DESC
          `)
          .all() as any[];

        for (const l of ledgerRows) {
          rows.push({
            id: `ledger-${l.id}`,
            entity: "billing",
            entity_id: l.id,
            summary: `Retainer ${l.entry_type} — $${l.amount.toFixed(2)} for ${l.client_name ?? "client"} (${l.property_name ?? "property"})`,
            action: l.entry_type,
            actor: l.created_by_name,
            amount: l.amount,
            detail: l.note,
            occurred_at: l.created_at,
            link: `#/billing`,
          });
        }

        // Invoice status changes
        const invoiceRows = sqlite
          .prepare(`
            SELECT i.id, i.status, i.total, i.issued_at, i.due_at, i.paid_at,
                   u.name as client_name
            FROM invoices i LEFT JOIN users u ON u.id = i.client_id
            ORDER BY i.created_at DESC
          `)
          .all() as any[];

        for (const inv of invoiceRows) {
          if (inv.issued_at) {
            rows.push({
              id: `invoice-${inv.id}-issued`,
              entity: "billing",
              entity_id: inv.id,
              summary: `Invoice #${inv.id} issued — $${inv.total.toFixed(2)} — ${inv.client_name ?? "client"}`,
              action: "issued",
              actor: "system",
              amount: inv.total,
              occurred_at: inv.issued_at,
              link: `#/billing`,
            });
          }
          if (inv.paid_at) {
            rows.push({
              id: `invoice-${inv.id}-paid`,
              entity: "billing",
              entity_id: inv.id,
              summary: `Invoice #${inv.id} paid — $${inv.total.toFixed(2)} — ${inv.client_name ?? "client"}`,
              action: "paid",
              actor: "client",
              amount: inv.total,
              occurred_at: inv.paid_at,
              link: `#/billing`,
            });
          }
        }
      }

      // ── Permission changes ─────────────────────────────────────────────────
      if (!entity || entity === "permissions") {
        const permRows = sqlite
          .prepare(`
            SELECT up.id, up.permission_key, up.granted, up.updated_at,
                   u.name as user_name, u.role as user_role
            FROM user_permissions up LEFT JOIN users u ON u.id = up.user_id
            ORDER BY up.updated_at DESC
          `)
          .all() as any[];

        for (const p of permRows) {
          rows.push({
            id: `perm-${p.id}`,
            entity: "permissions",
            entity_id: p.id,
            summary: `Permission '${p.permission_key}' ${p.granted ? "granted" : "revoked"} for ${p.user_name} (${p.user_role})`,
            action: p.granted ? "granted" : "revoked",
            actor: "admin",
            detail: `${p.user_role}: ${p.permission_key}`,
            occurred_at: p.updated_at,
            link: `#/users`,
          });
        }
      }

      // ── Signal Flare timeline ──────────────────────────────────────────────
      if (!entity || entity === "signal_flares") {
        const flareRows = sqlite
          .prepare(`
            SELECT sfe.id, sfe.event_type, sfe.note, sfe.created_at,
                   u.name as actor_name,
                   sf.description as flare_desc, sf.severity,
                   p.nickname as property_name, sf.id as flare_id
            FROM signal_flare_events sfe
            LEFT JOIN signal_flares sf ON sf.id = sfe.flare_id
            LEFT JOIN users u ON u.id = sfe.actor_id
            LEFT JOIN properties p ON p.id = sf.property_id
            ORDER BY sfe.created_at DESC
          `)
          .all() as any[];

        for (const fe of flareRows) {
          rows.push({
            id: `flare-event-${fe.id}`,
            entity: "signal_flares",
            entity_id: fe.flare_id,
            summary: `Signal Flare — ${fe.event_type} — ${fe.property_name ?? "property"}`,
            action: fe.event_type,
            actor: fe.actor_name ?? "system",
            detail: fe.note,
            occurred_at: fe.created_at,
            link: `#/signal-flares/${fe.flare_id}`,
          });
        }
      }

      // ── Vendor doc verifications ───────────────────────────────────────────
      if (!entity || entity === "vendors") {
        const vendorDocRows = sqlite
          .prepare(`
            SELECT vd.id, vd.title, vd.status, vd.verified_at, vd.review_notes,
                   u_v.name as vendor_name, u_a.name as verified_by_name
            FROM vendor_documents vd
            LEFT JOIN users u_v ON u_v.id = vd.vendor_id
            LEFT JOIN users u_a ON u_a.id = vd.verified_by
            WHERE vd.status IN ('approved','rejected')
            ORDER BY vd.verified_at DESC
          `)
          .all() as any[];

        for (const vd of vendorDocRows) {
          rows.push({
            id: `vendor-doc-${vd.id}`,
            entity: "vendors",
            entity_id: vd.id,
            summary: `Vendor doc "${vd.title}" ${vd.status} — ${vd.vendor_name ?? "vendor"}`,
            action: vd.status,
            actor: vd.verified_by_name ?? "admin",
            detail: vd.review_notes,
            occurred_at: vd.verified_at ?? new Date().toISOString(),
            link: `#/vendor-compliance`,
          });
        }

        // Deactivations
        const deactRows = sqlite
          .prepare(`
            SELECT id, name, role, deactivated_at FROM users
            WHERE deactivated_at IS NOT NULL ORDER BY deactivated_at DESC
          `)
          .all() as any[];

        for (const d of deactRows) {
          rows.push({
            id: `deactivation-${d.id}`,
            entity: "users",
            entity_id: d.id,
            summary: `User deactivated — ${d.name} (${d.role})`,
            action: "deactivated",
            actor: "admin",
            occurred_at: d.deactivated_at,
            link: `#/users`,
          });
        }
      }

      // ── Apply filters ──────────────────────────────────────────────────────
      let filtered = rows;

      if (from) {
        filtered = filtered.filter(r => r.occurred_at && r.occurred_at >= from);
      }
      if (to) {
        filtered = filtered.filter(r => r.occurred_at && r.occurred_at <= to + "T23:59:59Z");
      }
      if (actor) {
        const al = actor.toLowerCase();
        filtered = filtered.filter(r => r.actor?.toLowerCase().includes(al));
      }

      // Sort by occurred_at desc
      filtered.sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""));

      const total = filtered.length;
      const page_data = filtered.slice(offset, offset + limitNum);

      res.json({
        audit: page_data,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      });
    } catch (err: any) {
      console.error("[audit]", err);
      res.status(500).json({ error: err.message });
    }
  }
);
