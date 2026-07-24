/**
 * Account page — profile view + password change
 * Accessible to all roles, password change is self-service.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Lock, User, Phone, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ClientDataExport } from "@/components/data-export-panel";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

export default function AccountPage() {
  const { user } = useAuth();

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const changePwMutation = useMutation({
    mutationFn: async () => {
      if (!currentPw || !newPw || !confirmPw) throw new Error("All fields are required");
      if (newPw !== confirmPw) throw new Error("New passwords do not match");
      if (newPw.length < 6) throw new Error("New password must be at least 6 characters");
      const res = await apiRequest("POST", "/api/account/change-password", {
        userId: user?.id,
        currentPassword: currentPw,
        newPassword: newPw,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to change password");
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (e: any) => {
      setError(e.message);
      setSuccess(false);
    },
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrator",
    supervisor: "Supervisor",
    field_tech: "Field Technician",
    vendor: "Vendor",
    client: "Property Owner",
  };

  return (
    <AppLayout title="My Account" subtitle="Profile and security">
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
          My Account
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#888" }}>Profile information and security settings</p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="px-5 py-4" style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
              style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, border: `2px solid ${TERRACOTTA}44` }}>
              {user?.name?.charAt(0) ?? "?"}
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
                {user?.name ?? "—"}
              </div>
              <div className="text-xs font-semibold rounded-full px-2 py-0.5 inline-block mt-0.5"
                style={{ background: `${SAGE}22`, color: SAGE }}>
                {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {[
            { icon: User, label: "Username", value: user?.username ?? "—" },
            { icon: Mail, label: "Email", value: user?.email ?? "—" },
            { icon: Phone, label: "Phone", value: user?.phone ?? "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="rounded-lg p-2" style={{ background: "#252525" }}>
                <Icon size={14} style={{ color: "#666" }} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#555" }}>{label}</div>
                <div className="text-sm font-medium" style={{ color: CREAM }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <Lock size={16} style={{ color: TERRACOTTA }} />
          <h2 className="text-base font-bold" style={{ color: CREAM }}>Change Password</h2>
        </div>

        <div className="p-5 space-y-4">
          {success && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: "rgba(74,154,106,0.12)", border: "1px solid rgba(74,154,106,0.3)", color: "#4a9a6a" }}>
              <CheckCircle2 size={14} />
              Password changed successfully. Next sign-in will use your new password.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: "rgba(192,90,67,0.12)", border: "1px solid rgba(192,90,67,0.3)", color: TERRACOTTA }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {[
            { label: "Current Password", value: currentPw, onChange: setCurrentPw, placeholder: "Enter current password" },
            { label: "New Password", value: newPw, onChange: setNewPw, placeholder: "At least 6 characters" },
            { label: "Confirm New Password", value: confirmPw, onChange: setConfirmPw, placeholder: "Re-enter new password" },
          ].map(({ label, value, onChange, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-semibold block mb-1.5 uppercase tracking-wide" style={{ color: "#999" }}>
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
                style={{ background: "#141414", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
              />
            </div>
          ))}

          <button
            onClick={() => changePwMutation.mutate()}
            disabled={changePwMutation.isPending}
            className="w-full rounded-xl py-3 text-sm font-bold transition-opacity"
            style={{ background: TERRACOTTA, color: "#fff", opacity: changePwMutation.isPending ? 0.6 : 1 }}
          >
            {changePwMutation.isPending ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
    <div className="px-4 md:px-6 pb-6 max-w-lg">
      <ClientDataExport />
    </div>
    </AppLayout>
  );
}
