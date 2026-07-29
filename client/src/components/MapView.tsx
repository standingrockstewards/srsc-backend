/**
 * src/components/MapView.tsx  (Brick 10b)
 *
 * Renders one Leaflet marker per property that has non-null lat/lng.
 *
 * COORDINATE SOURCE: Option (i) — real lat/lng from GET /api/v2/properties.
 * Both latitude and longitude are returned as numeric strings (Postgres numeric →
 * JSON string). Parsed to float here. Properties with null/unparseable coords
 * are excluded from the map and listed in the unmapped footer.
 *
 * Nearest-property panel:
 *   - Requests navigator.geolocation on mount.
 *   - On grant: haversine distance from user position to every pinned property.
 *   - On deny or unavailable: shows a "enable location" note (no error thrown).
 *
 * Un-pinned properties are listed in a small footer — nothing silently disappears.
 *
 * All property IDs are string. Money (targetRetainerAmount) stays string.
 */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { haversineDistanceMiles } from "@/lib/haversine";
import type { Property } from "@/types";

// ── Fix Leaflet's broken default icon paths in Vite builds ───────────────────
// Leaflet resolves icon images relative to its CSS file, which fails in bundled
// builds. Override with inline SVG data URIs so no image files are needed.
const MARKER_ICON = L.divIcon({
  className: "",
  html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 20 12 20S24 20.25 24 12C24 5.373 18.627 0 12 0z" fill="#2b9e8e"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
  popupAnchor: [0, -34],
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface PinnedProperty {
  property: Property;
  lat: number;
  lng: number;
}

interface UserPosition {
  lat: number;
  lng: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MapViewProps {
  properties: Property[];
  loading?: boolean;
  error?: string | null;
}

export function MapView({ properties, loading = false, error = null }: MapViewProps) {
  const [userPos, setUserPos]         = useState<UserPosition | null>(null);
  const [geoDenied, setGeoDenied]     = useState(false);
  const [geoLoading, setGeoLoading]   = useState(true);

  // Request geolocation once on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setGeoDenied(true);
        setGeoLoading(false);
      },
      { timeout: 8000 },
    );
  }, []);

  // Split properties into pinned (valid lat/lng) and unmapped
  const { pinned, unmapped } = useMemo(() => {
    const pinned: PinnedProperty[] = [];
    const unmapped: Property[] = [];

    for (const p of properties) {
      const lat = p.latitude  != null ? parseFloat(p.latitude)  : NaN;
      const lng = p.longitude != null ? parseFloat(p.longitude) : NaN;
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        pinned.push({ property: p, lat, lng });
      } else {
        unmapped.push(p);
      }
    }
    return { pinned, unmapped };
  }, [properties]);

  // Compute nearest pinned property to user
  const nearest = useMemo(() => {
    if (!userPos || pinned.length === 0) return null;
    let closest: { pp: PinnedProperty; dist: number } | null = null;
    for (const pp of pinned) {
      const dist = haversineDistanceMiles(userPos.lat, userPos.lng, pp.lat, pp.lng);
      if (closest === null || dist < closest.dist) closest = { pp, dist };
    }
    return closest;
  }, [userPos, pinned]);

  // Default map center: center of all pinned properties, or Lake Eufaula fallback
  const center = useMemo<[number, number]>(() => {
    if (pinned.length === 0) return [35.29, -95.58]; // Lake Eufaula fallback
    const avgLat = pinned.reduce((s, p) => s + p.lat, 0) / pinned.length;
    const avgLng = pinned.reduce((s, p) => s + p.lng, 0) / pinned.length;
    return [avgLat, avgLng];
  }, [pinned]);

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="map-wrapper">
        <div className="map-container">
          <div className="map-state">
            <div className="map-state-icon">🗺</div>
            <span>Loading map…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-wrapper">
        <div className="map-container map-error">
          <div className="map-state">
            <div className="map-state-icon">⚠</div>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="map-wrapper">
        <div className="map-container">
          <div className="map-state">
            <div className="map-state-icon">📍</div>
            <span>No properties to display.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={center}
          zoom={pinned.length > 0 ? 10 : 8}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pinned.map(({ property, lat, lng }) => (
            <Marker key={property.id} position={[lat, lng]} icon={MARKER_ICON}>
              <Popup>
                <div className="map-popup-name">{property.nickname}</div>
                <div className="map-popup-address">
                  {property.address}
                  {property.city ? `, ${property.city}` : ""}
                  {property.state ? `, ${property.state}` : ""}
                </div>
                <div className="map-popup-retainer">
                  Target retainer: ${property.targetRetainerAmount}
                </div>
                {property.nearestShorelineMarker && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Marker: {property.nearestShorelineMarker}
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Nearest property panel */}
      <div className="map-nearest-panel">
        <span className="map-nearest-label">Nearest property</span>
        {geoLoading ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Locating…</span>
        ) : geoDenied || !userPos ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Enable location to see nearest property
          </span>
        ) : nearest ? (
          <>
            <span className="map-nearest-name">{nearest.pp.property.nickname}</span>
            <span className="map-nearest-dist">{nearest.dist.toFixed(1)} mi away</span>
          </>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No pinned properties</span>
        )}
      </div>

      {/* Unmapped properties footer — nothing silently disappears */}
      {unmapped.length > 0 && (
        <div className="map-unmapped">
          <div className="map-unmapped-title">
            {unmapped.length} propert{unmapped.length === 1 ? "y" : "ies"} without coordinates
          </div>
          <ul className="map-unmapped-list">
            {unmapped.map((p) => (
              <li key={p.id} className="map-unmapped-item" title={p.address}>
                {p.nickname}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
