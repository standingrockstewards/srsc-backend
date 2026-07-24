import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Wifi, WifiOff, AlertTriangle, Camera, Thermometer, Wind,
  DoorOpen, Activity, Plus, Bell, Clock, CheckCircle2, Zap,
  BatteryLow, RefreshCw, Eye, Radio, Shield, Flame
} from "lucide-react";
import type { MonitoringDevice, AlertEvent } from "../../../../shared/schema";
import { subscribeToAlertEvents, subscribeToDeviceStatus } from "@/lib/realtime";

// ─── TYPE HELPERS ─────────────────────────────────────────────────────────────

const DEVICE_TYPES = [
  "Camera", "Motion Sensor", "Door-Window Sensor", "Smoke-CO Detector",
  "Minut Sensor", "Temperature Sensor", "Humidity Sensor", "Other"
] as const;

const EVENT_TYPES = [
  "Motion", "Sound", "Temperature", "Humidity", "Smoke-CO",
  "Device Offline", "Unauthorized Entry", "Manual Entry", "Other"
] as const;

const SEVERITIES = ["Low", "Medium", "High", "Emergency"] as const;

const ACTION_OPTIONS = [
  "Resolved-No Action",
  "Owner Notified",
  "Vendor Dispatched",
  "Site Visit Initiated",
  "Emergency Escalated",
] as const;

function deviceIcon(type: string) {
  switch (type) {
    case "Camera": return <Camera className="w-4 h-4" />;
    case "Motion Sensor": return <Activity className="w-4 h-4" />;
    case "Door-Window Sensor": return <DoorOpen className="w-4 h-4" />;
    case "Smoke-CO Detector": return <Flame className="w-4 h-4" />;
    case "Minut Sensor": return <Radio className="w-4 h-4" />;
    case "Temperature Sensor": return <Thermometer className="w-4 h-4" />;
    case "Humidity Sensor": return <Wind className="w-4 h-4" />;
    default: return <Shield className="w-4 h-4" />;
  }
}

function eventIcon(type: string) {
  switch (type) {
    case "Motion": return <Activity className="w-4 h-4" />;
    case "Temperature": return <Thermometer className="w-4 h-4" />;
    case "Smoke-CO": return <Flame className="w-4 h-4" />;
    case "Device Offline": return <WifiOff className="w-4 h-4" />;
    case "Unauthorized Entry": return <DoorOpen className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
}

function statusBadge(status: string, batteryLevel: number | null) {
  const lowBattery = batteryLevel !== null && batteryLevel < 20;
  if (status === "Online" && !lowBattery) {
    return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Online</Badge>;
  }
  if (status === "Online" && lowBattery) {
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs"><BatteryLow className="w-3 h-3 mr-1" />Low Battery</Badge>;
  }
  if (status === "Alert") {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Alert</Badge>;
  }
  if (status === "Offline") {
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Offline</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
}

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    Low: "bg-blue-100 text-blue-800 border-blue-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    High: "bg-orange-100 text-orange-800 border-orange-200",
    Emergency: "bg-red-100 text-red-800 border-red-200",
  };
  return <Badge className={`${colors[severity] || ""} text-xs font-semibold`}>{severity}</Badge>;
}

function timeElapsed(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

// ─── RESPOND MODAL ────────────────────────────────────────────────────────────

function RespondModal({
  alert, devices, propertyId, onClose
}: { alert: AlertEvent; devices: MonitoringDevice[]; propertyId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [action, setAction] = useState<string>("");
  const [notes, setNotes] = useState("");

  const device = devices.find(d => d.id === alert.deviceId);

  const mutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/alerts/${alert.id}/resolve`, {
      resolvedBy: user?.name || "Unknown",
      actionTaken: action,
      actionNotes: notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/properties", propertyId, "alerts"] });
      toast({ title: "Alert resolved", description: `Marked as: ${action}` });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to resolve alert", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Respond to Alert</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
            <div className="flex items-center gap-2">
              {eventIcon(alert.eventType)}
              <span className="font-semibold text-sm">{alert.eventType}</span>
              {severityBadge(alert.severity)}
            </div>
            {device && <p className="text-xs text-muted-foreground">Device: {device.nickname} — {device.locationDescription}</p>}
            <p className="text-sm">{alert.description}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(alert.eventTimestamp).toLocaleString()}</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Action Taken *</Label>
            <Select onValueChange={setAction}>
              <SelectTrigger className="mt-1" data-testid="select-alert-action">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Notes *</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Describe what was done, who was contacted, outcome..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              data-testid="input-alert-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!action || !notes || mutation.isPending}
            style={{ backgroundColor: '#A0432F', color: '#F5F0EA' }}
            data-testid="button-resolve-alert"
          >
            {mutation.isPending ? "Saving..." : "Mark Resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ADD DEVICE MODAL ─────────────────────────────────────────────────────────

function AddDeviceModal({ propertyId, onClose }: { propertyId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nickname: "", deviceType: "", locationDescription: "",
    manufacturer: "", model: "", serialNumber: "",
    installDate: "", installedBy: "", warrantyExpiration: "",
    batteryLevel: "", configurationNotes: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/properties/${propertyId}/devices`, {
      ...form,
      batteryLevel: form.batteryLevel ? Number(form.batteryLevel) : null,
      status: "Online",
      lastPing: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/properties", propertyId, "devices"] });
      toast({ title: "Device added" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to add device", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Add Monitoring Device</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-sm">Device Nickname *</Label>
            <Input className="mt-1" value={form.nickname} onChange={e => set("nickname", e.target.value)} placeholder="e.g. Front Door Cam" data-testid="input-device-nickname" />
          </div>
          <div>
            <Label className="text-sm">Device Type *</Label>
            <Select onValueChange={v => set("deviceType", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Location Description</Label>
            <Input className="mt-1" value={form.locationDescription} onChange={e => set("locationDescription", e.target.value)} placeholder="e.g. Front entrance" />
          </div>
          <div>
            <Label className="text-sm">Manufacturer</Label>
            <Input className="mt-1" value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Model</Label>
            <Input className="mt-1" value={form.model} onChange={e => set("model", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Serial Number</Label>
            <Input className="mt-1" value={form.serialNumber} onChange={e => set("serialNumber", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Battery Level %</Label>
            <Input className="mt-1" type="number" min="0" max="100" value={form.batteryLevel} onChange={e => set("batteryLevel", e.target.value)} placeholder="Leave blank if wired" />
          </div>
          <div>
            <Label className="text-sm">Install Date</Label>
            <Input className="mt-1" type="date" value={form.installDate} onChange={e => set("installDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Installed By</Label>
            <Input className="mt-1" value={form.installedBy} onChange={e => set("installedBy", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Warranty Expiration</Label>
            <Input className="mt-1" type="date" value={form.warrantyExpiration} onChange={e => set("warrantyExpiration", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-sm">Configuration Notes</Label>
            <Textarea className="mt-1" rows={2} value={form.configurationNotes} onChange={e => set("configurationNotes", e.target.value)} placeholder="Recording settings, alert thresholds, access codes..." />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.nickname || !form.deviceType || mutation.isPending}
            style={{ backgroundColor: '#A0432F', color: '#F5F0EA' }}
            data-testid="button-add-device"
          >
            {mutation.isPending ? "Adding..." : "Add Device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MANUAL ALERT MODAL ───────────────────────────────────────────────────────

function ManualAlertModal({ propertyId, devices, onClose }: { propertyId: number; devices: MonitoringDevice[]; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    deviceId: "", eventType: "", severity: "",
    description: "", eventTimestamp: new Date().toISOString().slice(0, 16),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/properties/${propertyId}/alerts`, {
      ...form,
      deviceId: form.deviceId ? Number(form.deviceId) : null,
      eventTimestamp: new Date(form.eventTimestamp).toISOString(),
      eventType: form.eventType || "Manual Entry",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/properties", propertyId, "alerts"] });
      toast({ title: "Alert logged" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to log alert", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Log Manual Alert</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Device (optional)</Label>
            <Select onValueChange={v => set("deviceId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None / Not device-specific" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {devices.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nickname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Event Type *</Label>
              <Select onValueChange={v => set("eventType", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Severity *</Label>
              <Select onValueChange={v => set("severity", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm">Timestamp</Label>
            <Input className="mt-1" type="datetime-local" value={form.eventTimestamp} onChange={e => set("eventTimestamp", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Description *</Label>
            <Textarea className="mt-1" rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe the event..." data-testid="input-alert-description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.eventType || !form.severity || !form.description || mutation.isPending}
            style={{ backgroundColor: '#A0432F', color: '#F5F0EA' }}
            data-testid="button-log-alert"
          >
            {mutation.isPending ? "Logging..." : "Log Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function SignalFlareDashboard({ propertyId }: { propertyId: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTech = user?.role === "field_tech";
  const canEdit = isAdmin || isTech;

  const [respondAlert, setRespondAlert] = useState<AlertEvent | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showManualAlert, setShowManualAlert] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: devices = [], isLoading: loadingDevices } = useQuery<MonitoringDevice[]>({
    queryKey: ["/api/properties", propertyId, "devices"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties/${propertyId}/devices`);
      return res.json();
    },
  });

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery<AlertEvent[]>({
    queryKey: ["/api/properties", propertyId, "alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties/${propertyId}/alerts`);
      return res.json();
    },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubAlerts = subscribeToAlertEvents(propertyId, () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signal-flare/stats"] });
    });
    const unsubDevices = subscribeToDeviceStatus(propertyId, () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "devices"] });
    });
    return () => {
      unsubAlerts();
      unsubDevices();
    };
  }, [propertyId]);

  const onlineDevices = devices.filter(d => d.status === "Online");
  const offlineDevices = devices.filter(d => d.status === "Offline");
  const alertDevices = devices.filter(d => d.status === "Alert");
  const lowBatteryDevices = devices.filter(d => d.batteryLevel !== null && d.batteryLevel < 20);
  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const hasEmergencyAlert = unresolvedAlerts.some(a => a.severity === "Emergency");

  const filteredEvents = alerts.filter(a => {
    if (eventFilter !== "all" && a.eventType !== eventFilter) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    // Last 30 days
    return new Date(a.eventTimestamp) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });

  // Sort unresolved alerts: Emergency first, then High, Medium, Low, then by time
  const severityOrder: Record<string, number> = { Emergency: 0, High: 1, Medium: 2, Low: 3 };
  const sortedUnresolved = [...unresolvedAlerts].sort((a, b) => {
    const sd = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    if (sd !== 0) return sd;
    return new Date(b.eventTimestamp).getTime() - new Date(a.eventTimestamp).getTime();
  });

  return (
    <div className="space-y-5 p-4">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Devices", value: devices.length, color: "text-foreground", icon: <Shield className="w-4 h-4" /> },
          { label: "Online", value: onlineDevices.length, color: "text-green-700", icon: <Wifi className="w-4 h-4 text-green-600" /> },
          { label: "Offline / Alert", value: offlineDevices.length + alertDevices.length, color: offlineDevices.length + alertDevices.length > 0 ? "text-red-700" : "text-foreground", icon: <WifiOff className="w-4 h-4 text-red-500" /> },
          { label: "Active Alerts", value: unresolvedAlerts.length, color: unresolvedAlerts.length > 0 ? "text-red-700 font-bold" : "text-foreground", icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
        ].map(stat => (
          <Card key={stat.label} className="border-card-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<p className="text-xs text-muted-foreground">{stat.label}</p></div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Alerts Panel */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Active Alerts
              {unresolvedAlerts.length > 0 && (
                <span className={`relative inline-flex ${hasEmergencyAlert ? "animate-pulse" : ""}`}>
                  {hasEmergencyAlert && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50 animate-ping" />
                  )}
                  <Badge className="bg-red-100 text-red-800 ml-1 relative">{unresolvedAlerts.length}</Badge>
                </span>
              )}
            </CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowManualAlert(true)} data-testid="button-manual-alert">
                <Plus className="w-3 h-3 mr-1" /> Log Alert
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingAlerts ? (
            <div className="text-sm text-muted-foreground text-center py-4">Loading alerts...</div>
          ) : sortedUnresolved.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              No active alerts — all systems nominal
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUnresolved.map(alert => {
                const device = devices.find(d => d.id === alert.deviceId);
                return (
                  <div key={alert.id} className={`border rounded-lg p-3 flex items-start gap-3 ${alert.severity === "Emergency" ? "border-red-300 bg-red-50" : alert.severity === "High" ? "border-orange-300 bg-orange-50" : "border-border bg-background"}`} data-testid={`alert-row-${alert.id}`}>
                    <div className="flex-shrink-0 mt-0.5">{eventIcon(alert.eventType)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">{alert.eventType}</span>
                        {severityBadge(alert.severity)}
                        <span className="text-xs text-muted-foreground">{timeElapsed(alert.eventTimestamp)}</span>
                      </div>
                      {device && <p className="text-xs text-muted-foreground mb-0.5">{device.nickname} — {device.locationDescription}</p>}
                      <p className="text-sm">{alert.description}</p>
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setRespondAlert(alert)} data-testid={`button-respond-${alert.id}`}>
                        <Eye className="w-3 h-3 mr-1" /> Respond
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Health Grid */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: '#A0432F' }} />
              Device Health
              {lowBatteryDevices.length > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">{lowBatteryDevices.length} Low Battery</Badge>
              )}
            </CardTitle>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowAddDevice(true)} data-testid="button-add-device-open">
                <Plus className="w-3 h-3 mr-1" /> Add Device
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingDevices ? (
            <div className="text-sm text-muted-foreground text-center py-4">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No devices installed yet</p>
              {isAdmin && <p className="text-xs mt-1">Click "Add Device" to get started</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {devices.map(device => (
                <div key={device.id} className="border rounded-lg p-3 space-y-2" data-testid={`device-card-${device.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 text-muted-foreground">{deviceIcon(device.deviceType)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{device.nickname}</p>
                        <p className="text-xs text-muted-foreground truncate">{device.locationDescription}</p>
                      </div>
                    </div>
                    {statusBadge(device.status, device.batteryLevel)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{device.deviceType}</span>
                    {device.batteryLevel !== null && (
                      <span className={device.batteryLevel < 20 ? "text-red-600 font-semibold" : ""}>
                        🔋 {device.batteryLevel}%
                      </span>
                    )}
                  </div>
                  {device.lastPing && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> {timeElapsed(device.lastPing)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Event Feed */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Event Feed <span className="text-xs text-muted-foreground font-normal">(last 30 days)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No events match the current filters</div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map(event => {
                const device = devices.find(d => d.id === event.deviceId);
                return (
                  <div key={event.id} className="flex items-start gap-3 py-2 border-b last:border-0" data-testid={`event-row-${event.id}`}>
                    <div className={`flex-shrink-0 mt-1 ${event.resolved ? "text-muted-foreground" : "text-orange-500"}`}>
                      {eventIcon(event.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{event.eventType}</span>
                        {severityBadge(event.severity)}
                        {event.resolved && <Badge variant="outline" className="text-xs text-green-700 border-green-300">Resolved</Badge>}
                        <span className="text-xs text-muted-foreground ml-auto">{new Date(event.eventTimestamp).toLocaleString()}</span>
                      </div>
                      {device && <p className="text-xs text-muted-foreground">{device.nickname}</p>}
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      {event.actionNotes && <p className="text-xs text-muted-foreground italic mt-0.5">→ {event.actionNotes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {respondAlert && (
        <RespondModal alert={respondAlert} devices={devices} propertyId={propertyId} onClose={() => setRespondAlert(null)} />
      )}
      {showAddDevice && isAdmin && (
        <AddDeviceModal propertyId={propertyId} onClose={() => setShowAddDevice(false)} />
      )}
      {showManualAlert && canEdit && (
        <ManualAlertModal propertyId={propertyId} devices={devices} onClose={() => setShowManualAlert(false)} />
      )}
    </div>
  );
}
