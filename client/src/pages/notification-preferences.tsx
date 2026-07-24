/**
 * Notification Preferences — /notification-preferences
 * Per-user, per-event-type channel toggles.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Mail, MessageSquare, Check } from "lucide-react";
import { useState } from "react";

const TERRACOTTA = "#C05A43";
const SAGE       = "#7A8C6E";
const CREAM      = "#F5F0EA";
const MUTED      = "rgba(245,240,234,0.55)";
const RED_ALERT  = "#E05252";
const SERIF      = "var(--font-serif)";
const SANS       = "var(--font-sans)";

function Toggle({
  checked, onChange, label, icon: Icon, disabled = false,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; icon: any; disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      title={disabled ? "In-app notifications are always on" : label}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: 8,
        border: `1px solid ${checked ? (label === "Email" ? TERRACOTTA : label === "SMS" ? SAGE : SAGE) : "rgba(245,240,234,0.12)"}`,
        background: checked ? `${label === "Email" ? TERRACOTTA : SAGE}20` : "transparent",
        color: checked ? CREAM : MUTED, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: SANS, fontSize: 13, opacity: disabled ? 0.7 : 1,
        transition: "all 0.15s",
      }}
    >
      <Icon size={14} />
      {label}
      {disabled && <Check size={12} />}
    </button>
  );
}

export function NotificationPreferencesPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["notification-preferences"],
    queryFn: () => apiRequest("GET", "/api/notification-preferences").then(r => r.json()),
    staleTime: 60_000,
  });

  // Local copy for edits
  const [localPrefs, setLocalPrefs] = useState<Record<string, { in_app: boolean; email: boolean; sms: boolean }>>({});

  const prefs = data?.preferences ?? [];

  function getVal(eventType: string, channel: "in_app" | "email" | "sms"): boolean {
    if (eventType in localPrefs) return localPrefs[eventType][channel];
    const pref = prefs.find((p: any) => p.event_type === eventType);
    return pref?.[channel] ?? false;
  }

  function setVal(eventType: string, channel: "in_app" | "email" | "sms", value: boolean) {
    setLocalPrefs(prev => ({
      ...prev,
      [eventType]: {
        in_app: getVal(eventType, "in_app"),
        email:  getVal(eventType, "email"),
        sms:    getVal(eventType, "sms"),
        ...prev[eventType],
        [channel]: value,
      },
    }));
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const updates = Object.entries(localPrefs).map(([event_type, vals]) => ({
        event_type,
        ...vals,
      }));
      return apiRequest("PATCH", "/api/notification-preferences", updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      setLocalPrefs({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const hasChanges = Object.keys(localPrefs).length > 0;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: CREAM, margin: 0 }}>
          Notification Preferences
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, marginTop: 6 }}>
          Choose which events send in-app, email, or SMS alerts.
          In-app is always on. Email and SMS send only if enabled.
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: MUTED, fontFamily: SANS }}>Loading…</div>
      ) : (
        <>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 120px 120px",
            gap: 8, marginBottom: 8,
            padding: "0 12px",
          }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Type</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>In-App</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Email</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>SMS</div>
          </div>

          {prefs.map((pref: any) => (
            <div
              key={pref.event_type}
              style={{
                display: "grid", gridTemplateColumns: "1fr 120px 120px 120px",
                gap: 8, alignItems: "center",
                padding: "14px 12px",
                borderBottom: "1px solid rgba(245,240,234,0.06)",
              }}
            >
              <div>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: CREAM }}>{pref.label}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Toggle
                  label="In-App" icon={Bell}
                  checked={true}
                  disabled={true}
                  onChange={() => {}}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Toggle
                  label="Email" icon={Mail}
                  checked={getVal(pref.event_type, "email")}
                  onChange={v => setVal(pref.event_type, "email", v)}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Toggle
                  label="SMS" icon={MessageSquare}
                  checked={getVal(pref.event_type, "sms")}
                  onChange={v => setVal(pref.event_type, "sms", v)}
                />
              </div>
            </div>
          ))}

          {/* Save */}
          <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => saveMut.mutate()}
              disabled={!hasChanges || saveMut.isPending}
              style={{
                fontFamily: SANS, fontSize: 14, fontWeight: 600,
                padding: "10px 28px", borderRadius: 8,
                border: `1px solid ${hasChanges ? TERRACOTTA : "rgba(245,240,234,0.15)"}`,
                background: hasChanges ? TERRACOTTA : "transparent",
                color: hasChanges ? "#fff" : MUTED,
                cursor: hasChanges && !saveMut.isPending ? "pointer" : "default",
                opacity: hasChanges && !saveMut.isPending ? 1 : 0.5,
              }}
            >
              {saveMut.isPending ? "Saving…" : "Save Preferences"}
            </button>
            {saved && (
              <div style={{ fontFamily: SANS, fontSize: 13, color: SAGE, display: "flex", alignItems: "center", gap: 5 }}>
                <Check size={14} /> Saved
              </div>
            )}
            {hasChanges && !saved && (
              <button
                onClick={() => setLocalPrefs({})}
                style={{
                  fontFamily: SANS, fontSize: 13,
                  background: "transparent", border: "none", color: MUTED, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {/* SMS disclaimer */}
          <div style={{
            marginTop: 32, padding: "14px 18px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,240,234,0.08)",
          }}>
            <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: CREAM }}>SMS note:</strong> SMS delivery is optional and may require additional setup.
              Email notifications go to your account email on file. Contact us to update your contact information.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
