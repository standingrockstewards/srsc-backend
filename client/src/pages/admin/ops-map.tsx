/**
 * ops-map.tsx — Confidential Staff Operations Map
 *
 * Visible only to Admin, Supervisor, Field Tech with view_ops_map permission.
 * Uses Leaflet + OpenStreetMap (free, no billing). Google Maps gated behind VITE_GOOGLE_MAPS_KEY env var.
 *
 * Features:
 * - All property pins, color-coded by status
 * - Pin popups: name, address, client, tier, next visit, alerts, detail link
 * - Nearby awareness: click pin or use "near me" → highlights props within radius
 * - Storm overlay: live NWS warning polygons
 * - Filters: tier, tech, has-upcoming, has-alert
 * - Multi-select → Open in Google Maps directions
 * - Per-property task rate context panel (worth-the-trip)
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, AlertTriangle, Zap, Calendar, Navigation,
  RefreshCw, Filter, X, ChevronDown, ChevronUp,
  Route, DollarSign, Layers, Circle, Shield,
  Building2, Users, CheckCircle2, Clock,
} from "lucide-react";

// ─── Brand palette ─────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const AMBER = "#D9A441";
const CREAM = "#F5F0EA";
const CARD_BG = "#1e1e1e";
const SIDEBAR_BG = "#141414";
const BORDER = "#2a2a2a";
const MUTED = "#888";
const FONT_HEAD = "'Playfair Display', serif";
const FONT_BODY = "'Source Sans 3', sans-serif";

// ─── Pin status colors ──────────────────────────────────────────────────────────
const PIN_COLORS: Record<string, string> = {
  critical:    "#E53E3E", // bright red
  storm:       "#DD6B20", // orange
  flare:       TERRACOTTA,
  visit_today: SAGE,
  scheduled:   "#4299E1", // blue
  routine:     "#718096", // grey
};

const PIN_LABELS: Record<string, string> = {
  critical:    "Critical Alert",
  storm:       "Active Storm Response",
  flare:       "Open Signal Flare",
  visit_today: "Visit Scheduled Today",
  scheduled:   "Visit Upcoming",
  routine:     "Routine",
};

const TIER_LABELS: Record<string, string> = {
  signal_flare: "Signal Flare",
  shipshape:    "Ship Shape",
  anchor_watch: "Anchor Watch",
  launch_crew:  "Launch Crew",
};

const TIER_COLORS: Record<string, string> = {
  signal_flare: TERRACOTTA,
  shipshape:    SAGE,
  anchor_watch: "#4299E1",
  launch_crew:  AMBER,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface MapProperty {
  id: number;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  service_tier: string;
  tech_name: string | null;
  client_name: string;
  assigned_tech_id: number | null;
  pin_status: string;
  has_dock: boolean;
  has_boat: boolean;
  has_alarm: boolean;
  next_visit: { date: string; time: string; type: string; tech: string } | null;
  open_flares: { id: number; severity: string; category: string; description: string }[];
  active_storm: { id: number; event_type: string; severity: string; headline: string } | null;
  task_rates: Record<string, { rate: number; unit: string }>;
  distance_miles?: number;
}

// ─── Haversine (client-side for radius ring) ──────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Leaflet icon factory ────────────────────────────────────────────────────
function createLeafletIcon(color: string, selected: boolean, nearby: boolean) {
  const size = selected ? 36 : nearby ? 30 : 24;
  const border = selected ? "3px solid white" : nearby ? "2px solid " + color : "2px solid rgba(255,255,255,0.4)";
  const shadow = selected ? "0 0 0 3px " + color + ", 0 4px 12px rgba(0,0,0,0.6)" : "0 2px 6px rgba(0,0,0,0.4)";
  const html = `<div style="
    width:${size}px; height:${size}px;
    background:${color};
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:${border};
    box-shadow:${shadow};
    cursor:pointer;
    transition: all 0.2s;
  "></div>`;
  return html;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OpsMapPage() {
  const { user, can } = useAuth();
  const mapRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const radiusCircleRef = useRef<any>(null);
  const stormLayersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);

  const [selectedProp, setSelectedProp] = useState<MapProperty | null>(null);
  const [nearbyOrigin, setNearbyOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [selectedForRoute, setSelectedForRoute] = useState<Set<number>>(new Set());
  const [showStormOverlay, setShowStormOverlay] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTier, setFilterTier] = useState("");
  const [filterTech, setFilterTech] = useState("");
  const [filterAlert, setFilterAlert] = useState(false);
  const [filterUpcoming, setFilterUpcoming] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────────
  const { data: mapData, isLoading, refetch } = useQuery({
    queryKey: ["ops-map-properties"],
    queryFn: () => apiRequest("GET", "/api/ops-map/properties").then(r => r.json()),
    staleTime: 0,
    refetchInterval: 60_000, // refresh every minute
    enabled: !!user, // wait for auth to be ready
  });

  const { data: weatherData } = useQuery({
    queryKey: ["ops-map-weather"],
    queryFn: () => apiRequest("GET", "/api/ops-map/weather").then(r => r.json()),
    staleTime: 0,
    enabled: showStormOverlay,
  });

  const properties: MapProperty[] = useMemo(() => {
    if (!mapData?.properties) return [];
    let props = mapData.properties as MapProperty[];
    if (filterTier) props = props.filter(p => p.service_tier === filterTier);
    if (filterTech) props = props.filter(p => String(p.assigned_tech_id) === filterTech);
    if (filterAlert) props = props.filter(p => p.open_flares.length > 0 || p.active_storm);
    if (filterUpcoming) props = props.filter(p => p.next_visit);
    return props;
  }, [mapData, filterTier, filterTech, filterAlert, filterUpcoming]);

  const nearbyProps = useMemo(() => {
    if (!nearbyOrigin) return new Set<number>();
    return new Set(
      properties
        .filter(p => haversine(nearbyOrigin.lat, nearbyOrigin.lng, p.lat, p.lng) <= radiusMiles)
        .map(p => p.id)
    );
  }, [nearbyOrigin, radiusMiles, properties]);

  // ─── Map initialization ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    import("leaflet").then(L => {
      leafletRef.current = L.default || L;
      const Lx = leafletRef.current;

      // Fix default icon paths (Vite/webpack issue)
      delete (Lx.Icon.Default.prototype as any)._getIconUrl;
      Lx.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Center on Lake Eufaula, OK
      const map = Lx.map(mapElRef.current!, {
        center: [35.39, -95.55],
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      // OpenStreetMap tile layer (primary — free)
      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Render markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const Lx = leafletRef.current;
    const map = mapRef.current;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    properties.forEach(prop => {
      const isSelected = selectedProp?.id === prop.id;
      const isNearby = nearbyOrigin ? nearbyProps.has(prop.id) : false;
      const color = PIN_COLORS[prop.pin_status] ?? PIN_COLORS.routine;

      const divIcon = Lx.divIcon({
        html: createLeafletIcon(color, isSelected, isNearby),
        className: "",
        iconSize: [isSelected ? 36 : isNearby ? 30 : 24, isSelected ? 36 : isNearby ? 30 : 24],
        iconAnchor: [isSelected ? 18 : isNearby ? 15 : 12, isSelected ? 36 : isNearby ? 30 : 24],
      });

      const marker = Lx.marker([prop.lat, prop.lng], { icon: divIcon });

      // Popup content
      const tierColor = TIER_COLORS[prop.service_tier] ?? MUTED;
      const tierLabel = TIER_LABELS[prop.service_tier] ?? prop.service_tier;
      const dist = prop.distance_miles !== undefined ? `<span style="color:${MUTED};font-size:11px;">📍 ${prop.distance_miles}mi away</span>` : "";
      const flareHtml = prop.open_flares.length > 0
        ? `<div style="margin-top:6px;padding:5px 8px;background:#C05A4322;border-left:3px solid #C05A43;border-radius:4px;font-size:12px;color:#C05A43;">⚡ ${prop.open_flares.length} open signal flare${prop.open_flares.length > 1 ? "s" : ""}</div>`
        : "";
      const stormHtml = prop.active_storm
        ? `<div style="margin-top:4px;padding:5px 8px;background:#DD6B2022;border-left:3px solid #DD6B20;border-radius:4px;font-size:12px;color:#DD6B20;">🌩 ${prop.active_storm.event_type}</div>`
        : "";
      const visitHtml = prop.next_visit
        ? `<div style="margin-top:6px;font-size:12px;color:${MUTED};">📅 Next visit: <strong style="color:${CREAM}">${prop.next_visit.date}</strong> · ${prop.next_visit.type.replace("_", " ")}</div>`
        : "";

      const popupHtml = `
        <div style="min-width:220px;font-family:'Source Sans 3',sans-serif;color:${CREAM};background:#1e1e1e;border-radius:8px;padding:12px;">
          <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;margin-bottom:4px;color:${CREAM};">${prop.nickname}</div>
          <div style="font-size:12px;color:${MUTED};margin-bottom:6px;">${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="background:${tierColor}22;color:${tierColor};border:1px solid ${tierColor}44;padding:2px 7px;border-radius:12px;font-size:11px;font-weight:600;">${tierLabel}</span>
            <span style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 7px;border-radius:12px;font-size:11px;">${PIN_LABELS[prop.pin_status] ?? prop.pin_status}</span>
          </div>
          <div style="font-size:12px;color:${MUTED};">👤 ${prop.client_name}</div>
          ${prop.tech_name ? `<div style="font-size:12px;color:${MUTED};">🔧 ${prop.tech_name}</div>` : ""}
          ${dist}
          ${visitHtml}${flareHtml}${stormHtml}
          <div style="margin-top:10px;display:flex;gap:6px;">
            <a href="#/properties/${prop.id}" style="flex:1;text-align:center;background:${TERRACOTTA};color:white;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">View Property</a>
          </div>
        </div>`;

      marker.bindPopup(popupHtml, {
        maxWidth: 280,
        className: "srsc-map-popup",
      });

      marker.on("click", () => setSelectedProp(prop));

      marker.addTo(map);
      markersRef.current.set(prop.id, marker);
    });
  }, [mapReady, properties, selectedProp, nearbyOrigin, nearbyProps]);

  // ─── Nearby radius circle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return;
    const Lx = leafletRef.current;

    // Remove old circle
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }

    if (nearbyOrigin) {
      const radiusMeters = radiusMiles * 1609.34;
      radiusCircleRef.current = Lx.circle([nearbyOrigin.lat, nearbyOrigin.lng], {
        radius: radiusMeters,
        color: SAGE,
        fillColor: SAGE,
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "6 4",
      }).addTo(mapRef.current);
    }
  }, [mapReady, nearbyOrigin, radiusMiles]);

  // ─── Storm overlay ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return;
    const Lx = leafletRef.current;

    // Clear old storm layers
    stormLayersRef.current.forEach(l => l.remove());
    stormLayersRef.current = [];

    if (!showStormOverlay || !weatherData) return;

    const allAlerts = [...(weatherData.live_alerts ?? []), ...(weatherData.db_alerts ?? [])];

    allAlerts.forEach((alert: any) => {
      const geo = alert.geometry;
      if (!geo) return;

      const layer = Lx.geoJSON(geo, {
        style: {
          color: "#E53E3E",
          fillColor: "#E53E3E",
          fillOpacity: 0.15,
          weight: 2,
          dashArray: "4 3",
        },
      });

      layer.bindPopup(`
        <div style="font-family:'Source Sans 3',sans-serif;color:${CREAM};background:#1e1e1e;padding:10px;border-radius:6px;min-width:200px;">
          <div style="font-weight:700;color:#E53E3E;margin-bottom:4px;">⚠️ ${alert.event_type}</div>
          <div style="font-size:12px;color:${MUTED};">${alert.headline ?? ""}</div>
          <div style="font-size:11px;color:${MUTED};margin-top:4px;">Severity: ${alert.severity}</div>
        </div>
      `, { maxWidth: 260, className: "srsc-map-popup" });

      layer.addTo(mapRef.current);
      stormLayersRef.current.push(layer);
    });
  }, [mapReady, showStormOverlay, weatherData]);

  // ─── Fly to selected property ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProp || !mapRef.current) return;
    mapRef.current.flyTo([selectedProp.lat, selectedProp.lng], 13, { duration: 1 });
    const marker = markersRef.current.get(selectedProp.id);
    marker?.openPopup();
  }, [selectedProp]);

  // ─── Get current location ─────────────────────────────────────────────────────
  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setNearbyOrigin({ lat: latitude, lng: longitude });
        mapRef.current?.flyTo([latitude, longitude], 12, { duration: 1.2 });
        setGettingLocation(false);
      },
      () => {
        // Fallback: use Lake Eufaula center
        setNearbyOrigin({ lat: 35.39, lng: -95.55 });
        setGettingLocation(false);
      }
    );
  }, []);

  // ─── Google Maps routing handoff ──────────────────────────────────────────────
  const openGoogleMapsDirections = useCallback(() => {
    const selected = properties.filter(p => selectedForRoute.has(p.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      const p = selected[0];
      const q = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
      return;
    }
    // Multi-stop: first is origin, rest are waypoints, last is destination
    const origin = encodeURIComponent(`${selected[0].address}, ${selected[0].city}, ${selected[0].state}`);
    const destination = encodeURIComponent(`${selected[selected.length - 1].address}, ${selected[selected.length - 1].city}`);
    const waypoints = selected.slice(1, -1).map(p =>
      encodeURIComponent(`${p.address}, ${p.city}`)
    ).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
    window.open(url, "_blank");
  }, [properties, selectedForRoute]);

  // ─── Unique techs for filter ──────────────────────────────────────────────────
  const uniqueTechs = useMemo(() => {
    if (!mapData?.properties) return [];
    const seen = new Map<number, string>();
    for (const p of mapData.properties as MapProperty[]) {
      if (p.assigned_tech_id && p.tech_name) seen.set(p.assigned_tech_id, p.tech_name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [mapData]);

  // ─── Nearby props list ───────��────────────────────────────────────────────────
  const nearbyList = useMemo(() => {
    if (!nearbyOrigin) return [];
    return properties
      .map(p => ({ ...p, distance_miles: Math.round(haversine(nearbyOrigin.lat, nearbyOrigin.lng, p.lat, p.lng) * 10) / 10 }))
      .filter(p => p.distance_miles <= radiusMiles)
      .sort((a, b) => a.distance_miles - b.distance_miles);
  }, [nearbyOrigin, radiusMiles, properties]);

  // ─── UI helpers ───────────────────────────────────────────────────────────────
  const activeFilters = [filterTier, filterTech, filterAlert ? "alert" : "", filterUpcoming ? "upcoming" : ""].filter(Boolean).length;

  // All staff roles (admin, supervisor, field_tech) always allowed — server scopes data.
  const isStaff = ["admin", "supervisor", "field_tech"].includes(user?.role ?? "");
  if (!isStaff) {
    return (
      <AppLayout title="Operations Map" subtitle="Confidential">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield size={40} style={{ color: MUTED, margin: "0 auto 12px" }} />
            <p style={{ color: CREAM, fontFamily: FONT_HEAD, fontSize: 18 }}>Access Restricted</p>
            <p style={{ color: MUTED, fontFamily: FONT_BODY, marginTop: 6 }}>You don't have permission to view the operations map.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Operations Map" subtitle="Confidential — Staff Only">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <style>{`
        .srsc-map-popup .leaflet-popup-content-wrapper {
          background: #1e1e1e !important;
          border: 1px solid #2a2a2a !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
          padding: 0 !important;
        }
        .srsc-map-popup .leaflet-popup-content { margin: 0 !important; }
        .srsc-map-popup .leaflet-popup-tip { background: #1e1e1e !important; }
        .leaflet-container { background: #1a1a1a; }
        .leaflet-control-zoom a {
          background: #1e1e1e !important;
          color: ${CREAM} !important;
          border-color: #333 !important;
        }
        .leaflet-control-attribution {
          background: rgba(20,20,20,0.8) !important;
          color: #666 !important;
        }
        .leaflet-control-attribution a { color: #888 !important; }
      `}</style>

      <div style={{ display: "flex", height: "calc(100vh - 64px)", fontFamily: FONT_BODY, background: "#141414" }}>

        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
        <div style={{
          width: 320, minWidth: 280, maxWidth: 360,
          background: SIDEBAR_BG, borderRight: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>

          {/* Header */}
          <div style={{ padding: "16px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <MapPin size={18} style={{ color: TERRACOTTA }} />
              <span style={{ fontFamily: FONT_HEAD, fontSize: 16, color: CREAM, fontWeight: 700 }}>
                Field Operations
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 11, padding: "2px 8px",
                background: "#C05A4320", color: TERRACOTTA, borderRadius: 12,
                border: `1px solid ${TERRACOTTA}44`, fontWeight: 600
              }}>CONFIDENTIAL</span>
            </div>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              {isLoading ? "Loading…" : `${properties.length} properties${mapData?.scope === "assigned" ? " (assigned scope)" : ""}`}
            </p>
          </div>

          {/* Controls bar */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {/* Near Me */}
            <button
              onClick={handleNearMe}
              disabled={gettingLocation}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "7px 10px", background: CARD_BG, border: `1px solid ${BORDER}`,
                borderRadius: 8, color: CREAM, fontSize: 12, cursor: "pointer",
              }}
            >
              <Navigation size={13} style={{ color: SAGE }} />
              {gettingLocation ? "Locating…" : "Near Me"}
            </button>

            {/* Filters */}
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "7px 10px", background: activeFilters > 0 ? `${TERRACOTTA}22` : CARD_BG,
                border: `1px solid ${activeFilters > 0 ? TERRACOTTA : BORDER}`,
                borderRadius: 8, color: activeFilters > 0 ? TERRACOTTA : CREAM,
                fontSize: 12, cursor: "pointer",
              }}
            >
              <Filter size={13} />
              Filters {activeFilters > 0 ? `(${activeFilters})` : ""}
            </button>

            {/* Storm toggle */}
            <button
              onClick={() => setShowStormOverlay(s => !s)}
              title="Toggle NWS storm overlay"
              style={{
                padding: "7px 10px",
                background: showStormOverlay ? "#E53E3E22" : CARD_BG,
                border: `1px solid ${showStormOverlay ? "#E53E3E" : BORDER}`,
                borderRadius: 8, color: showStormOverlay ? "#E53E3E" : CREAM,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              }}
            >
              <Layers size={13} />
              Storm
            </button>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              style={{ padding: "7px 9px", background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, cursor: "pointer" }}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, background: "#1a1a1a" }}>
              {/* Tier */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Service Tier</label>
                <select
                  value={filterTier}
                  onChange={e => setFilterTier(e.target.value)}
                  style={{ width: "100%", background: "#252525", border: `1px solid #333`, borderRadius: 6, padding: "5px 8px", color: CREAM, fontSize: 12 }}
                >
                  <option value="">All Tiers</option>
                  {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {/* Tech */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Assigned Tech</label>
                <select
                  value={filterTech}
                  onChange={e => setFilterTech(e.target.value)}
                  style={{ width: "100%", background: "#252525", border: `1px solid #333`, borderRadius: 6, padding: "5px 8px", color: CREAM, fontSize: 12 }}
                >
                  <option value="">All Techs</option>
                  {uniqueTechs.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              {/* Toggles */}
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "Has Alert", val: filterAlert, set: setFilterAlert },
                  { label: "Upcoming Visit", val: filterUpcoming, set: setFilterUpcoming },
                ].map(({ label, val, set }) => (
                  <button
                    key={label}
                    onClick={() => set(v => !v)}
                    style={{
                      flex: 1, padding: "5px 8px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                      background: val ? `${TERRACOTTA}22` : "#252525",
                      border: `1px solid ${val ? TERRACOTTA : "#333"}`,
                      color: val ? TERRACOTTA : MUTED,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setFilterTier(""); setFilterTech(""); setFilterAlert(false); setFilterUpcoming(false); }}
                  style={{ marginTop: 8, width: "100%", padding: "4px", fontSize: 11, color: MUTED, background: "transparent", border: "none", cursor: "pointer" }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Radius control (when nearby active) */}
          {nearbyOrigin && (
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, background: `${SAGE}10` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: SAGE, fontWeight: 600 }}>
                  <Circle size={12} style={{ display: "inline", marginRight: 4 }} />
                  Nearby Radius: {radiusMiles}mi
                </span>
                <button onClick={() => setNearbyOrigin(null)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 11 }}>
                  <X size={14} />
                </button>
              </div>
              <input
                type="range" min={5} max={50} step={5}
                value={radiusMiles}
                onChange={e => setRadiusMiles(Number(e.target.value))}
                style={{ width: "100%", accentColor: SAGE }}
              />
              <p style={{ fontSize: 11, color: MUTED, margin: "4px 0 0" }}>
                {nearbyList.length} propert{nearbyList.length === 1 ? "y" : "ies"} within {radiusMiles}mi
              </p>
            </div>
          )}

          {/* Property list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isLoading ? (
              <div style={{ padding: 20, color: MUTED, textAlign: "center", fontSize: 13 }}>Loading properties…</div>
            ) : properties.length === 0 ? (
              <div style={{ padding: 20, color: MUTED, textAlign: "center", fontSize: 13 }}>No properties match filters</div>
            ) : (
              (nearbyOrigin ? nearbyList : properties).map(prop => {
                const isSelected = selectedProp?.id === prop.id;
                const isNearby = nearbyOrigin ? nearbyProps.has(prop.id) : false;
                const isForRoute = selectedForRoute.has(prop.id);
                const color = PIN_COLORS[prop.pin_status] ?? PIN_COLORS.routine;
                const tierColor = TIER_COLORS[prop.service_tier] ?? MUTED;

                return (
                  <div
                    key={prop.id}
                    onClick={() => {
                      setSelectedProp(isSelected ? null : prop);
                      if (!nearbyOrigin) setNearbyOrigin({ lat: prop.lat, lng: prop.lng });
                    }}
                    style={{
                      padding: "10px 12px",
                      borderBottom: `1px solid ${BORDER}`,
                      background: isSelected ? `${TERRACOTTA}15` : "transparent",
                      borderLeft: isSelected ? `3px solid ${TERRACOTTA}` : isNearby ? `3px solid ${SAGE}` : "3px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      {/* Status dot */}
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%", background: color,
                        marginTop: 4, flexShrink: 0,
                      }} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: FONT_HEAD, fontSize: 13, color: CREAM, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {prop.nickname}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED }}>
                          {prop.city} · {prop.tech_name ?? "Unassigned"}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ background: `${tierColor}22`, color: tierColor, border: `1px solid ${tierColor}44`, padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
                            {TIER_LABELS[prop.service_tier] ?? prop.service_tier}
                          </span>
                          {prop.open_flares.length > 0 && (
                            <span style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, border: `1px solid ${TERRACOTTA}44`, padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>
                              ⚡ {prop.open_flares.length} flare{prop.open_flares.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {prop.active_storm && (
                            <span style={{ background: "#DD6B2022", color: "#DD6B20", border: "1px solid #DD6B2044", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>
                              🌩 Storm
                            </span>
                          )}
                          {(prop as any).distance_miles !== undefined && (
                            <span style={{ color: MUTED, fontSize: 10 }}>
                              {(prop as any).distance_miles}mi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Route checkbox */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedForRoute(prev => {
                            const next = new Set(prev);
                            if (next.has(prop.id)) next.delete(prop.id); else next.add(prop.id);
                            return next;
                          });
                        }}
                        title="Add to route"
                        style={{
                          width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                          background: isForRoute ? TERRACOTTA : "#252525",
                          border: `1px solid ${isForRoute ? TERRACOTTA : "#444"}`,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "white",
                        }}
                      >
                        {isForRoute ? <CheckCircle2 size={12} /> : <span style={{ fontSize: 9, color: MUTED }}>+</span>}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Route action bar */}
          {selectedForRoute.size > 0 && (
            <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "#1a1a1a" }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
                {selectedForRoute.size} stop{selectedForRoute.size > 1 ? "s" : ""} selected
              </div>
              <button
                onClick={openGoogleMapsDirections}
                style={{
                  width: "100%", padding: "8px 12px", background: TERRACOTTA, color: "white",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Route size={14} />
                Open in Google Maps
              </button>
              <button
                onClick={() => setSelectedForRoute(new Set())}
                style={{ width: "100%", marginTop: 5, padding: "5px", background: "transparent", border: "none", color: MUTED, fontSize: 11, cursor: "pointer" }}
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Legend */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "#161616" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pin Status
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {Object.entries(PIN_LABELS).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIN_COLORS[k] }} />
                  <span style={{ fontSize: 10, color: MUTED }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── MAP AREA ─────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />

          {/* Selected property detail panel (bottom overlay) */}
          {selectedProp && (
            <div style={{
              position: "absolute", bottom: 16, left: 16, right: 16,
              background: CARD_BG, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "14px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              zIndex: 1000, maxWidth: 640, margin: "0 auto",
              display: "flex", gap: 16, flexWrap: "wrap",
            }}>
              <button
                onClick={() => setSelectedProp(null)}
                style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: MUTED, cursor: "pointer" }}
              >
                <X size={16} />
              </button>

              {/* Property info */}
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 15, color: CREAM, fontWeight: 700, marginBottom: 2 }}>
                  {selectedProp.nickname}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  {selectedProp.address}, {selectedProp.city} · {selectedProp.client_name}
                </div>
                {selectedProp.next_visit && (
                  <div style={{ fontSize: 12, color: SAGE, display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} />
                    Next: {selectedProp.next_visit.date} · {selectedProp.next_visit.type.replace("_", " ")}
                  </div>
                )}
                {selectedProp.open_flares.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: TERRACOTTA }}>
                    <Zap size={12} style={{ display: "inline", marginRight: 3 }} />
                    {selectedProp.open_flares[0].category} — {selectedProp.open_flares[0].severity}
                  </div>
                )}
                {selectedProp.active_storm && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#DD6B20" }}>
                    <AlertTriangle size={12} style={{ display: "inline", marginRight: 3 }} />
                    {selectedProp.active_storm.event_type}
                  </div>
                )}
              </div>

              {/* Task rates (worth-the-trip) */}
              <div style={{ flex: "1 1 180px" }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Task Rates
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Object.entries(selectedProp.task_rates)
                    .filter(([, v]) => v.rate > 0)
                    .slice(0, 5)
                    .map(([type, rate]) => (
                      <div key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: MUTED }}>{type.replace(/_/g, " ")}</span>
                        <span style={{ color: SAGE, fontWeight: 600 }}>${rate.rate}/{rate.unit.replace("per_", "")}</span>
                      </div>
                    ))}
                  {Object.keys(selectedProp.task_rates).length === 0 && (
                    <span style={{ fontSize: 11, color: MUTED }}>No rates configured</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", minWidth: 140 }}>
                <a
                  href={`#/properties/${selectedProp.id}`}
                  style={{
                    padding: "7px 14px", background: TERRACOTTA, color: "white",
                    borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  View Property
                </a>
                <button
                  onClick={() => {
                    setSelectedForRoute(prev => {
                      const next = new Set(prev);
                      if (next.has(selectedProp.id)) next.delete(selectedProp.id); else next.add(selectedProp.id);
                      return next;
                    });
                  }}
                  style={{
                    padding: "6px 14px",
                    background: selectedForRoute.has(selectedProp.id) ? `${TERRACOTTA}22` : "#252525",
                    color: selectedForRoute.has(selectedProp.id) ? TERRACOTTA : CREAM,
                    border: `1px solid ${selectedForRoute.has(selectedProp.id) ? TERRACOTTA : "#333"}`,
                    borderRadius: 7, fontSize: 12, cursor: "pointer",
                  }}
                >
                  {selectedForRoute.has(selectedProp.id) ? "✓ Added to Route" : "+ Add to Route"}
                </button>
                <button
                  onClick={() => {
                    setNearbyOrigin({ lat: selectedProp.lat, lng: selectedProp.lng });
                  }}
                  style={{
                    padding: "6px 14px", background: "#252525",
                    color: CREAM, border: `1px solid #333`,
                    borderRadius: 7, fontSize: 12, cursor: "pointer",
                  }}
                >
                  <Navigation size={11} style={{ display: "inline", marginRight: 4 }} />
                  Who's Nearby?
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(20,20,20,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 999, borderRadius: 0,
            }}>
              <div style={{ color: CREAM, fontFamily: FONT_BODY }}>
                <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} />
                Loading operations map…
              </div>
            </div>
          )}

          {/* Storm overlay indicator */}
          {showStormOverlay && (
            <div style={{
              position: "absolute", top: 12, right: 12,
              background: "#E53E3E22", border: "1px solid #E53E3E55",
              borderRadius: 8, padding: "5px 10px", zIndex: 900,
              fontSize: 11, color: "#E53E3E", display: "flex", alignItems: "center", gap: 5,
            }}>
              <Layers size={12} />
              NWS Storm Overlay Active
              {weatherData && (
                <span style={{ color: MUTED }}>
                  · {(weatherData.live_alerts?.length ?? 0) + (weatherData.db_alerts?.filter((a: any) => a.geometry)?.length ?? 0)} polygon{((weatherData.live_alerts?.length ?? 0)) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
