// realtime.ts — Supabase real-time subscription utilities
// Falls back gracefully if VITE_SUPABASE_URL is not configured

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type RealtimeCallback = (payload: any) => void;

export function subscribeToAlertEvents(propertyId: number, onInsert: RealtimeCallback): (() => void) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.info("[Realtime] Supabase not configured — real-time disabled");
    return () => {};
  }
  // Dynamic import to avoid bundle bloat when not configured
  let unsubscribe = () => {};
  import("@supabase/supabase-js").then(({ createClient }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase
      .channel(`alert-events-${propertyId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alert_events",
        filter: `property_id=eq.${propertyId}`,
      }, onInsert)
      .subscribe();
    unsubscribe = () => supabase.removeChannel(channel);
  }).catch(() => {});
  return () => unsubscribe();
}

export function subscribeToDeviceStatus(propertyId: number, onChange: RealtimeCallback): (() => void) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return () => {};
  let unsubscribe = () => {};
  import("@supabase/supabase-js").then(({ createClient }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase
      .channel(`devices-${propertyId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "monitoring_devices",
        filter: `property_id=eq.${propertyId}`,
      }, onChange)
      .subscribe();
    unsubscribe = () => supabase.removeChannel(channel);
  }).catch(() => {});
  return () => unsubscribe();
}

export function subscribeToGlobalAlerts(onInsert: RealtimeCallback): (() => void) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return () => {};
  let unsubscribe = () => {};
  import("@supabase/supabase-js").then(({ createClient }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase
      .channel("global-alert-events")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alert_events",
        filter: "resolved=eq.false",
      }, onInsert)
      .subscribe();
    unsubscribe = () => supabase.removeChannel(channel);
  }).catch(() => {});
  return () => unsubscribe();
}
