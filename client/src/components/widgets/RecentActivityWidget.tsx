/**
 * src/components/widgets/RecentActivityWidget.tsx  (Brick 10c)
 *
 * STUB — no activity feed endpoint exists in v2 yet.
 *
 * // SEAM: needs GET /api/v2/events feed (follow-on brick).
 * //   Expected contract: GET /api/v2/events?limit=20&since=ISO
 * //   Response: Array<{ id, propertyId, visitType, severity, note, visitAt, createdAt }>
 * //   Auth: requireNotVendor — admin/supervisor see all; client scoped to own properties.
 * //   Do NOT fabricate data or call GET /properties/:pid/events in a loop —
 * //   that is N calls and no unified feed. Wait for the dedicated feed endpoint.
 *
 * Renders empty-state card only. No API calls are made.
 */

export function RecentActivityWidget() {
  return (
    <div className="widget widget--stub">
      <div className="widget-header">
        <span className="widget-title">Recent Activity</span>
        <span className="widget-badge widget-badge--muted">Coming soon</span>
      </div>
      <div className="widget-empty widget-empty--stub">
        <span className="widget-empty-icon">🔔</span>
        <span>Activity feed coming soon</span>
        <span className="widget-empty-hint">
          Events will appear here once the activity feed endpoint is available.
        </span>
      </div>
    </div>
  );
}
