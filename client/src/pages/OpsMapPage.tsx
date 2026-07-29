/**
 * src/pages/OpsMapPage.tsx  (Brick 10e)
 *
 * Confidential Operations Map — admin / supervisor / field_tech only.
 * Vendors and clients are blocked at the route level (RequireRole) and at
 * the API level (requireNotVendor on /markers + /properties).
 *
 * FEATURES:
 *  - One property pin per property with valid lat/lng coordinates.
 *  - Popup shows nickname, address, and nearest shoreline marker.
 *  - Nearest-marker lookup: calls GET /api/v2/markers/nearest?lat=&lng= per property.
 *    On empty markers table (404) → falls back to property.nearestShorelineMarker text.
 *    On network error → falls back silently. Never errors or spins on missing data.
 *  - Shoreline marker overlay: circle markers rendered only if /api/v2/markers returns rows.
 *  - field_tech: /properties returns only assigned properties (scoped in the API layer).
 *  - Dark theme: matches existing app CSS variables.
 *  - VITE_MAP_PROVIDER_KEY seam: if set, used as tile URL token; else falls back to
 *    keyless OpenStreetMap tiles so the map renders in dev/staging with no key.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Property, ShorelineMarker, NearestMarkerResult } from "@/types";
import { PageSpinner } from "@/components/ui";

// ── Tile layer selection ──────────────────────────────────────────────────────
// VITE_MAP_PROVIDER_KEY seam: if set, could be swapped for a premium tile provider.
// Currently OSM tiles are keyless; the env var is reserved for future switching.
// const MAP_KEY = import.meta.env.VITE_MAP_PROVIDER_KEY;
const TILE_URL   = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// ── Leaflet icons ─────────────────────────────────────────────────────────────

/** Property pin — teal, matches MapView.tsx color */
const PROPERTY_ICON = L.divIcon({
  className: "",
  html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 20 12 20S24 20.25 24 12C24 5.373 18.627 0 12 0z" fill="#2b9e8e"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  iconSize:    [24, 32],
  iconAnchor:  [12, 32],
  popupAnchor: [0, -34],
});

/** Shoreline marker pin — amber accent */
const MARKER_ICON = L.divIcon({
  className: "",
  html: `<svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 0C4.477 0 0 4.477 0 10c0 7.25 10 18 10 18S20 17.25 20 10C20 4.477 15.523 0 10 0z" fill="#e8a838"/>
    <circle cx="10" cy="10" r="4" fill="white"/>
  </svg>`,
  iconSize:    [20, 28],
  iconAnchor:  [10, 28],
  popupAnchor: [0, -30],
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface PinnedProperty {
  property:      Property;
  lat:           number;
  lng:           number;
  nearestMarker: NearestMarkerResult | null;  // null = no data yet or unavailable
  markerLabel:   string | null;               // resolved label (API result or free-text fallback)
  markerLoading: boolean;
}

// ── Map auto-fit helper ───────────────────────────────────────────────────────

function FitBounds({ pins }: { pins: PinnedProperty[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    fitted.current = true;
  }, [map, pins]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function OpsMapPage() {
  const { role } = useAuth();

  const [properties,    setProperties]    = useState<Property[]>([]);
  const [propLoading,   setPropLoading]   = useState(true);
  const [propError,     setPropError]     = useState<string | null>(null);

  const [shoreMarkers,  setShoreMarkers]  = useState<ShorelineMarker[]>([]);
  const [markersFetched, setMarkersFetched] = useState(false);

  // Per-property nearest-marker state, keyed by property.id
  const [nearestMap, setNearestMap] = useState<
    Record<string, { result: NearestMarkerResult | null; loading: boolean }>
  >({});

  // ── Fetch properties ────────────────────────────────────────────────────────
  useEffect(() => {
    setPropLoading(true);
    apiFetch("/properties")
      .then((data) => {
        setProperties(data as Property[]);
        setPropLoading(false);
      })
      .catch((err) => {
        setPropError(err?.message ?? "Failed to load properties");
        setPropLoading(false);
      });
  }, []);

  // ── Fetch shoreline markers (overlay — empty table is fine) ─────────────────
  useEffect(() => {
    apiFetch("/markers")
      .then((data) => {
        setShoreMarkers(data as ShorelineMarker[]);
        setMarkersFetched(true);
      })
      .catch(() => {
        // Network error or vendor 403 — just skip the overlay, no error shown
        setMarkersFetched(true);
      });
  }, []);

  // ── Compute pinned properties ───────────────────────────────────────────────
  const { pinned, unpinned } = useMemo(() => {
    const pinned:   Array<{ property: Property; lat: number; lng: number }> = [];
    const unpinned: Property[] = [];

    for (const p of properties) {
      const lat = p.latitude  != null ? parseFloat(p.latitude)  : NaN;
      const lng = p.longitude != null ? parseFloat(p.longitude) : NaN;
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        pinned.push({ property: p, lat, lng });
      } else {
        unpinned.push(p);
      }
    }
    return { pinned, unpinned };
  }, [properties]);

  // ── Fetch nearest marker per property (after properties loaded) ─────────────
  // Runs once per pinned property. On 404 (empty table) or any error, leaves
  // nearestMap entry as { result: null } so the fallback label kicks in.
  useEffect(() => {
    if (pinned.length === 0) return;

    // Initialise all to loading
    setNearestMap((prev) => {
      const next = { ...prev };
      for (const { property } of pinned) {
        if (!next[property.id]) {
          next[property.id] = { result: null, loading: true };
        }
      }
      return next;
    });

    for (const { property, lat, lng } of pinned) {
      apiFetch(`/markers/nearest?lat=${lat}&lng=${lng}`)
        .then((data) => {
          setNearestMap((prev) => ({
            ...prev,
            [property.id]: { result: data as NearestMarkerResult, loading: false },
          }));
        })
        .catch(() => {
          // 404 (empty table) or network error → null result, fallback kicks in
          setNearestMap((prev) => ({
            ...prev,
            [property.id]: { result: null, loading: false },
          }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.length]);  // only re-run if pinned count changes

  // ── Build enriched pin list ─────────────────────────────────────────────────
  const enrichedPins: PinnedProperty[] = useMemo(() => {
    return pinned.map(({ property, lat, lng }) => {
      const nearestEntry = nearestMap[property.id];
      const loading = nearestEntry?.loading ?? true;
      const result  = nearestEntry?.result  ?? null;

      // Resolved label: API result → free-text column → null
      let markerLabel: string | null = null;
      if (result) {
        markerLabel = `Marker ${result.marker.markerNumber}${result.marker.description ? ` — ${result.marker.description}` : ""} (${result.distanceMiles} mi)`;
      } else if (property.nearestShorelineMarker) {
        markerLabel = property.nearestShorelineMarker;   // free-text fallback
      }

      return { property, lat, lng, nearestMarker: result, markerLabel, markerLoading: loading };
    });
  }, [pinned, nearestMap]);

  // ── Shoreline marker pins (overlay — only if table has rows) ────────────────
  const shorelinePins: Array<{ marker: ShorelineMarker; lat: number; lng: number }> =
    useMemo(() => {
      return shoreMarkers
        .map((m) => ({
          marker: m,
          lat: parseFloat(m.latitude),
          lng: parseFloat(m.longitude),
        }))
        .filter(({ lat, lng }) => !isNaN(lat) && !isNaN(lng));
    }, [shoreMarkers]);

  const defaultCenter: [number, number] = [35.29, -95.58]; // Lake Eufaula fallback

  // ── Role label for the confidential banner ──────────────────────────────────
  const roleLabel: Record<string, string> = {
    admin:      "Admin",
    supervisor: "Supervisor",
    field_tech: "Field Tech",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (propLoading) {
    return (
      <div className="ops-map-page">
        <PageSpinner />
      </div>
    );
  }

  if (propError) {
    return (
      <div className="ops-map-page">
        <div className="ops-map-error" role="alert">
          <strong>Could not load properties:</strong> {propError}
        </div>
      </div>
    );
  }

  return (
    <div className="ops-map-page">

      {/* Confidential header bar */}
      <div className="ops-map-header">
        <div className="ops-map-title">
          <svg className="ops-map-title-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
            <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6C12.5 3.515 10.485 1.5 8 1.5z"/>
            <circle cx="8" cy="6" r="1.5"/>
          </svg>
          Operations Map
        </div>
        <div className="ops-map-meta">
          <span className="ops-map-badge ops-map-badge--confidential" aria-label="Confidential — staff only">
            Confidential
          </span>
          {role && roleLabel[role] && (
            <span className="ops-map-badge ops-map-badge--role">
              {roleLabel[role]}
            </span>
          )}
          <span className="ops-map-count">
            {pinned.length} pinned · {unpinned.length} without coords
            {shorelinePins.length > 0 && ` · ${shorelinePins.length} markers`}
          </span>
        </div>
      </div>

      {/* Map + sidebar body row */}
      <div className="ops-map-body-row">

      {/* Map */}
      <div className="ops-map-container">
        <MapContainer
          center={defaultCenter}
          zoom={pinned.length > 0 ? 9 : 8}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer attribution={TILE_ATTR} url={TILE_URL} />

          {/* Auto-fit to pins on first load */}
          {enrichedPins.length > 0 && <FitBounds pins={enrichedPins} />}

          {/* Property pins */}
          {enrichedPins.map(({ property, lat, lng, markerLabel, markerLoading }) => (
            <Marker key={property.id} position={[lat, lng]} icon={PROPERTY_ICON}>
              <Popup className="ops-map-popup">
                <div className="ops-popup-name">{property.nickname}</div>
                <div className="ops-popup-address">
                  {property.address}
                  {property.city  ? `, ${property.city}`  : ""}
                  {property.state ? `, ${property.state}` : ""}
                </div>
                <div className="ops-popup-marker-row">
                  <svg className="ops-popup-marker-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="6" cy="5" r="3"/>
                    <path d="M6 8v3"/>
                  </svg>
                  {markerLoading ? (
                    <span className="ops-popup-marker-loading">Locating marker…</span>
                  ) : markerLabel ? (
                    <span className="ops-popup-marker-label">{markerLabel}</span>
                  ) : (
                    <span className="ops-popup-marker-none">No marker data</span>
                  )}
                </div>
                <div className="ops-popup-coords">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Shoreline marker overlay — only rendered if table has rows */}
          {shorelinePins.map(({ marker, lat, lng }) => (
            <Marker key={marker.id} position={[lat, lng]} icon={MARKER_ICON}>
              <Popup className="ops-map-popup">
                <div className="ops-popup-shore-name">
                  Marker {marker.markerNumber}
                </div>
                {marker.description && (
                  <div className="ops-popup-shore-desc">{marker.description}</div>
                )}
                <div className="ops-popup-coords">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </div>
                <div className="ops-popup-lake">{marker.lake}</div>
              </Popup>
            </Marker>
          ))}

          {/* Shoreline marker proximity circles (50m) */}
          {shorelinePins.map(({ marker, lat, lng }) => (
            <Circle
              key={`circle-${marker.id}`}
              center={[lat, lng]}
              radius={50}
              pathOptions={{ color: "#e8a838", fillColor: "#e8a838", fillOpacity: 0.12, weight: 1 }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Sidebar panel — legend + unpinned list */}
      <div className="ops-map-sidebar">

        {/* Legend */}
        <div className="ops-legend">
          <div className="ops-legend-title">Legend</div>
          <div className="ops-legend-item">
            <span className="ops-legend-dot ops-legend-dot--property" aria-hidden="true" />
            Property
          </div>
          {markersFetched && shorelinePins.length > 0 && (
            <div className="ops-legend-item">
              <span className="ops-legend-dot ops-legend-dot--marker" aria-hidden="true" />
              Shoreline Marker
            </div>
          )}
          {markersFetched && shorelinePins.length === 0 && (
            <div className="ops-legend-item ops-legend-item--muted">
              <span className="ops-legend-dot ops-legend-dot--marker ops-legend-dot--empty" aria-hidden="true" />
              No markers seeded yet
            </div>
          )}
        </div>

        {/* Unpinned properties */}
        {unpinned.length > 0 && (
          <div className="ops-unpinned">
            <div className="ops-unpinned-title">
              {unpinned.length} without coordinates
            </div>
            <ul className="ops-unpinned-list" role="list">
              {unpinned.map((p) => (
                <li key={p.id} className="ops-unpinned-item" title={p.address}>
                  <span className="ops-unpinned-name">{p.nickname}</span>
                  {p.nearestShorelineMarker && (
                    <span className="ops-unpinned-marker">
                      {p.nearestShorelineMarker}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All properties pinned — clean state */}
        {unpinned.length === 0 && properties.length > 0 && (
          <div className="ops-all-pinned">
            All {pinned.length} propert{pinned.length === 1 ? "y" : "ies"} pinned
          </div>
        )}

        {/* No properties at all */}
        {properties.length === 0 && (
          <div className="ops-no-properties" role="status">
            No properties assigned to your account.
          </div>
        )}
      </div>

      </div> {/* end ops-map-body-row */}
    </div>
  );
}
