/**
 * Admin User Management + Access Matrix
 * Requires: manage_users (user list) + edit_permissions (access matrix)
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  Users, Shield, ChevronRight, ChevronDown, AlertTriangle,
  CheckCircle2, RefreshCw, UserCheck, UserX, Edit3, RotateCcw,
  Lock, Unlock, Eye, EyeOff,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SIDEBAR_BG = "#141414";

const ROLE_COLORS: Record<string, string> = {
  admin: TERRACOTTA,
  supervisor: "#5A7A8C",
  field_tech: SAGE,
  client: "#8B7355",
  vendor: "#7B6B5A",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  field_tech: "Field Tech",
  client: "Client",
  vendor: "Vendor",
};

// ─── Permission groups for the matrix ────────────────────────────────────────
const PERM_GROUPS: { group: string; keys: string[] }[] = [
  { group: "Properties",     keys: ["view_all_properties","edit_properties","create_properties","delete_properties"] },
  { group: "Visits",         keys: ["view_all_visits","view_own_visits","create_visits","edit_visits","complete_visits","schedule_visits","assign_techs"] },
  { group: "Reports",        keys: ["view_visit_reports","create_visit_reports","view_escalation_log","create_escalation","send_aar","approve_documents"] },
  { group: "Vendors",        keys: ["manage_vendors","view_vendors"] },
  { group: "Service",        keys: ["manage_service_requests","submit_service_requests"] },
  { group: "Storm",          keys: ["respond_storm_events","trigger_storm_test"] },
  { group: "Calendar",       keys: ["manage_calendar","view_calendar"] },
  { group: "Messaging",      keys: ["send_property_messages","view_all_messages"] },
  { group: "Dashboard",      keys: ["view_dashboard","view_signal_flare"] },
  { group: "Administration", keys: ["manage_users","edit_permissions","view_billing"] },
];

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "#888";
  return (
    <span className="text-xs font-bold rounded-full px-2.5 py-0.5"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Access Matrix Drawer ─────────────────────────────────────────────────────
function AccessMatrix({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("edit_permissions");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/users", userId, "permissions"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/users/${userId}/permissions`);
      return r.json();
    },
  });

  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/users/${userId}/permissions`, { overrides: localOverrides });
    },
    onSuccess: async () => {
      setSaveMsg("Saved — permissions took effect immediately.");
      setLocalOverrides({});
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "permissions"] });
      setTimeout(() => setSaveMsg(""), 3000);
    },
    onError: (e: any) => setSaveMsg("Error: " + e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      // Set all overrides to null (delete)
      const allKeys = PERM_GROUPS.flatMap(g => g.keys);
      const nullOverrides: Record<string, null> = {};
      for (const k of allKeys) nullOverrides[k] = null;
      await apiRequest("PATCH", `/api/users/${userId}/permissions`, { overrides: nullOverrides });
    },
    onSuccess: async () => {
      setSaveMsg("Reset to role defaults.");
      setLocalOverrides({});
      await refetch();
    },
  });

  if (isLoading) return (
    <div className="p-8 text-center" style={{ color: "#555" }}>Loading permissions…</div>
  );
  if (!data) return null;

  const { user, roleDefaults, overrides: serverOverrides, meta } = data;

  function getEffective(key: string): boolean {
    // Local override first, then server override, then role default
    if (key in localOverrides) return localOverrides[key] ?? roleDefaults[key] ?? false;
    if (key in serverOverrides) return serverOverrides[key];
    return roleDefaults[key] ?? false;
  }
  function isOverridden(key: string): boolean {
    if (key in localOverrides) return localOverrides[key] !== null;
    return key in serverOverrides;
  }
  function toggle(key: string) {
    if (!canEdit) return;
    const current = getEffective(key);
    const roleDefault = roleDefaults[key] ?? false;
    const newVal = !current;
    // If new value equals role default, remove override
    if (newVal === roleDefault) {
      setLocalOverrides(prev => ({ ...prev, [key]: null }));
    } else {
      setLocalOverrides(prev => ({ ...prev, [key]: newVal }));
    }
  }
  function resetKey(key: string) {
    setLocalOverrides(prev => ({ ...prev, [key]: null }));
  }

  const hasPending = Object.keys(localOverrides).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ background: "#0f0f0f", borderLeft: `1px solid ${CARD_BORDER}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: SIDEBAR_BG, borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div>
            <div className="flex items-center gap-2">
              <Shield size={16} style={{ color: TERRACOTTA }} />
              <h2 className="text-lg font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
                Access Matrix
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm" style={{ color: "#999" }}>{user.name}</span>
              <RoleBadge role={user.role} />
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#888" }}>
            Close
          </button>
        </div>

        {/* Legend */}
        <div className="px-6 py-2 flex items-center gap-4 text-xs flex-shrink-0"
          style={{ background: "#111", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: `${SAGE}44`, border: `1px solid ${SAGE}` }} />
            <span style={{ color: "#777" }}>Role default (granted)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: `${TERRACOTTA}44`, border: `1px solid ${TERRACOTTA}` }} />
            <span style={{ color: "#777" }}>Custom override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#2a2a2a", border: `1px solid #333` }} />
            <span style={{ color: "#777" }}>Denied</span>
          </div>
        </div>

        {/* Permission groups */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {PERM_GROUPS.map(({ group, keys }) => (
            <div key={group}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2 px-1"
                style={{ color: TERRACOTTA }}>{group}</div>
              <div className="space-y-1">
                {keys.map(key => {
                  const effective = getEffective(key);
                  const overridden = isOverridden(key);
                  const roleDefault = roleDefaults[key] ?? false;
                  const label = meta[key]?.label ?? key;
                  const desc = meta[key]?.description ?? "";
                  const pendingChange = key in localOverrides;

                  // Color coding
                  let rowBg = "#1a1a1a";
                  let indicator = "#333";
                  let indicatorBorder = "#444";
                  if (effective && overridden) { rowBg = `${TERRACOTTA}0d`; indicator = TERRACOTTA; indicatorBorder = `${TERRACOTTA}55`; }
                  else if (effective) { indicator = SAGE; indicatorBorder = `${SAGE}55`; }
                  if (!effective && overridden) { rowBg = "rgba(192,90,67,0.04)"; }
                  if (pendingChange) rowBg = "rgba(217,144,43,0.1)";

                  return (
                    <div key={key}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                      style={{ background: rowBg, border: `1px solid ${pendingChange ? "#D9902B44" : CARD_BORDER}` }}>
                      {/* Toggle */}
                      <button
                        onClick={() => toggle(key)}
                        disabled={!canEdit}
                        className="flex-shrink-0 w-5 h-5 rounded transition-all flex items-center justify-center"
                        style={{
                          background: effective ? indicator : "#1e1e1e",
                          border: `1.5px solid ${indicatorBorder}`,
                          cursor: canEdit ? "pointer" : "default",
                          opacity: canEdit ? 1 : 0.7,
                        }}>
                        {effective && <CheckCircle2 size={11} style={{ color: "#fff" }} />}
                      </button>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: effective ? CREAM : "#555" }}>
                            {label}
                          </span>
                          {overridden && (
                            <span className="text-xs rounded px-1.5 py-0.5 font-bold"
                              style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA }}>
                              override
                            </span>
                          )}
                          {pendingChange && (
                            <span className="text-xs rounded px-1.5 py-0.5 font-bold"
                              style={{ background: "rgba(217,144,43,0.2)", color: "#D9902B" }}>
                              unsaved
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "#555" }}>{desc}</div>
                      </div>

                      {/* Role default indicator + reset button */}
                      <div className="flex-shrink-0 flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: roleDefault ? "#4a9a6a" : "#444" }}>
                          {roleDefault ? "default:on" : "default:off"}
                        </span>
                        {overridden && canEdit && (
                          <button onClick={() => resetKey(key)} title="Reset to role default"
                            className="rounded p-1 hover:bg-white/10"
                            style={{ color: "#666" }}>
                            <RotateCcw size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 px-6 py-4 flex flex-col gap-3"
          style={{ background: SIDEBAR_BG, borderTop: `1px solid ${CARD_BORDER}` }}>
          {saveMsg && (
            <div className="text-sm rounded-xl px-3 py-2"
              style={{ background: saveMsg.startsWith("Error") ? "rgba(192,90,67,0.15)" : "rgba(74,154,106,0.15)",
                color: saveMsg.startsWith("Error") ? TERRACOTTA : "#4a9a6a" }}>
              {saveMsg}
            </div>
          )}
          <div className="flex gap-3">
            {canEdit && (
              <>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity"
                  style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#888",
                    opacity: resetMutation.isPending ? 0.6 : 1 }}>
                  Reset All to Role Defaults
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!hasPending || saveMutation.isPending}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity"
                  style={{ background: hasPending ? TERRACOTTA : "#333", color: "#fff",
                    opacity: (saveMutation.isPending || !hasPending) ? 0.6 : 1 }}>
                  {saveMutation.isPending ? "Saving…" : hasPending ? `Save ${Object.keys(localOverrides).length} Change(s)` : "No Changes"}
                </button>
              </>
            )}
            {!canEdit && (
              <div className="text-sm" style={{ color: "#555" }}>
                You have view-only access to this user's permissions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: "", name: "", email: "", phone: "", password: "", role: "field_tech" });
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.username || !form.name || !form.password) throw new Error("Username, name, and password are required");
      const r = await apiRequest("POST", "/api/users", form);
      return r.json();
    },
    onSuccess: () => { onCreated(); onClose(); },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative rounded-2xl overflow-hidden w-full max-w-md"
        style={{ background: "#141414", border: `1px solid ${CARD_BORDER}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <h3 className="font-bold text-base" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            Add New User
          </h3>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(192,90,67,0.12)", color: TERRACOTTA }}>{error}</div>}
          {[
            { label: "Full Name", key: "name", placeholder: "John Doe" },
            { label: "Username", key: "username", placeholder: "jdoe" },
            { label: "Email", key: "email", placeholder: "jdoe@example.com" },
            { label: "Phone", key: "phone", placeholder: "9185551234" },
            { label: "Password", key: "password", placeholder: "Initial password", type: "password" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: "#777" }}>{label}</label>
              <input type={type ?? "text"} value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
            </div>
          ))}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: "#777" }}>Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
              style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="field_tech">Field Tech</option>
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#888" }}>Cancel</button>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold"
            style={{ background: TERRACOTTA, color: "#fff", opacity: createMutation.isPending ? 0.6 : 1 }}>
            {createMutation.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canManageUsers = can("manage_users");
  const canEditPerms = can("edit_permissions");

  const [matrixUserId, setMatrixUserId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: users = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/users");
      return r.json();
    },
    enabled: canManageUsers,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => {
      const r = await apiRequest("PATCH", `/api/users/${id}`, patch);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users"] }),
  });

  const filtered = filter === "all" ? users : users.filter((u: any) => u.role === filter);

  if (!canManageUsers) {
    return (
      <AppLayout title="User Management">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Lock size={40} style={{ color: "#333", margin: "0 auto 12px" }} />
            <p className="font-semibold" style={{ color: "#666" }}>Access Restricted</p>
            <p className="text-sm mt-1" style={{ color: "#444" }}>
              You don't have the manage_users permission. Contact your administrator.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User Management" subtitle="Accounts, roles, and access control">
      {matrixUserId !== null && (
        <AccessMatrix userId={matrixUserId} onClose={() => setMatrixUserId(null)} />
      )}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => refetch()} />
      )}

      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"
              style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              <Users size={20} style={{ color: TERRACOTTA }} />
              User Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>
              {users.length} user{users.length !== 1 ? "s" : ""} · Click any row to edit permissions
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: TERRACOTTA, color: "#fff" }}>
            + Add User
          </button>
        </div>

        {/* Role filter */}
        <div className="flex flex-wrap gap-2">
          {["all", "admin", "supervisor", "field_tech", "client", "vendor"].map(r => {
            const count = r === "all" ? users.length : users.filter((u: any) => u.role === r).length;
            const color = r === "all" ? TERRACOTTA : ROLE_COLORS[r] ?? "#888";
            const isActive = filter === r;
            return (
              <button key={r} onClick={() => setFilter(r)}
                className="rounded-full px-3 py-1 text-xs font-bold transition-all"
                style={{ background: isActive ? `${color}22` : CARD_BG, border: `1px solid ${isActive ? color : CARD_BORDER}`, color: isActive ? color : "#888" }}>
                {ROLE_LABELS[r] ?? "All"} ({count})
              </button>
            );
          })}
        </div>

        {/* User table */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: CARD_BG }} />)}</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
                  {["Name", "Username", "Role", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#555" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any, i: number) => (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? CARD_BG : "#1e1e1e", borderBottom: `1px solid #1a1a1a` }}>
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: CREAM }}>{u.name}</div>
                      <div className="text-xs" style={{ color: "#666" }}>{u.email}</div>
                    </td>
                    {/* Username */}
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#888" }}>{u.username}</td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => updateMutation.mutate({ id: u.id, patch: { role: e.target.value } })}
                        className="appearance-none text-xs font-bold rounded-full px-2.5 py-1 outline-none"
                        style={{ background: `${ROLE_COLORS[u.role] ?? "#888"}22`, color: ROLE_COLORS[u.role] ?? "#888",
                          border: `1px solid ${ROLE_COLORS[u.role] ?? "#888"}44`, cursor: "pointer" }}>
                        <option value="admin">Admin</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="field_tech">Field Tech</option>
                        <option value="client">Client</option>
                        <option value="vendor">Vendor</option>
                      </select>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateMutation.mutate({ id: u.id, patch: { active: !u.active } })}
                        className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1"
                        style={{ background: u.active ? "rgba(74,154,106,0.12)" : "rgba(102,102,102,0.12)",
                          color: u.active ? "#4a9a6a" : "#666", border: `1px solid ${u.active ? "#4a9a6a44" : "#44444444"}` }}>
                        {u.active ? <UserCheck size={11} /> : <UserX size={11} />}
                        {u.active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canEditPerms && (
                          <button
                            onClick={() => setMatrixUserId(u.id)}
                            title="Open Access Matrix"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-white/10"
                            style={{ background: "#252525", color: SAGE, border: `1px solid ${SAGE}33` }}>
                            <Shield size={11} />
                            Permissions
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
