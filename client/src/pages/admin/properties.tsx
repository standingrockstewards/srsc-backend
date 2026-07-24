import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, TierBadge } from "@/components/status-badge";
import { Plus, Search, ChevronRight, Building2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "../../../../shared/schema";

function AddPropertyDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nickname: "", ownerName: "", ownerEmail: "", ownerPhone: "",
    address: "", city: "", state: "OK", zip: "",
    serviceTier: "anchor_watch",
    interiorAccess: false, hasDock: false, hasBoat: false,
    hasBoatLift: false, hasGenerator: false, hasIrrigation: false,
    hasPropane: false, hasAlarm: false,
    alarmPanelLocation: "", alarmCode: "",
    emergencyContactName: "", emergencyContactPhone: "",
    accessNotes: "", propertyNotes: "",
    // Signal Flare additions
    accountManagerId: "",
    notificationPreferences: {
      escalation_enabled: true,
      emergency_threshold_minutes: 15,
      high_threshold_minutes: 60,
      account_manager_email: "",
      global_alerts_cc: "alerts@standingrockstewards.com",
    },
  });

  const { data: managers } = useQuery<any[]>({ queryKey: ["/api/users/managers"] });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/properties", {
        ...form,
        active: true,
        dateAdded: new Date().toISOString().split('T')[0],
        notificationPreferences: JSON.stringify(form.notificationPreferences),
        accountManagerId: form.accountManagerId ? Number(form.accountManagerId) : null,
      });
      if (!res.ok) throw new Error("Failed to create property");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "Property added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Property Nickname *</Label>
          <Input value={form.nickname} onChange={e => set("nickname", e.target.value)} placeholder="e.g. Smith Lake House" className="mt-1" required />
        </div>
        <div>
          <Label>Owner Name *</Label>
          <Input value={form.ownerName} onChange={e => set("ownerName", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Owner Email *</Label>
          <Input type="email" value={form.ownerEmail} onChange={e => set("ownerEmail", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Owner Phone *</Label>
          <Input value={form.ownerPhone} onChange={e => set("ownerPhone", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Service Tier *</Label>
          <Select value={form.serviceTier} onValueChange={v => set("serviceTier", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anchor_watch">Anchor Watch</SelectItem>
              <SelectItem value="shipshape">Shipshape</SelectItem>
              <SelectItem value="launch_crew">Launch Crew</SelectItem>
              <SelectItem value="signal_flare">⚡ Signal Flare</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Street Address *</Label>
          <Input value={form.address} onChange={e => set("address", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>City *</Label>
          <Input value={form.city} onChange={e => set("city", e.target.value)} className="mt-1" required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>State</Label>
            <Input value={form.state} onChange={e => set("state", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>ZIP *</Label>
            <Input value={form.zip} onChange={e => set("zip", e.target.value)} className="mt-1" required />
          </div>
        </div>
      </div>

      {/* Feature flags */}
      <div className="space-y-2 border rounded-lg p-3">
        <p className="text-sm font-semibold mb-2">Property Features</p>
        {[
          { key: "interiorAccess", label: "Interior Access Authorized" },
          { key: "hasDock", label: "Dock Present" },
          { key: "hasBoat", label: "Boat / Watercraft Present" },
          { key: "hasBoatLift", label: "Boat Lift Present" },
          { key: "hasGenerator", label: "Generator Present" },
          { key: "hasIrrigation", label: "Irrigation System" },
          { key: "hasPropane", label: "Propane System" },
          { key: "hasAlarm", label: "Alarm System" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between py-1">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={!!(form as any)[key]}
              onCheckedChange={v => set(key, v)}
            />
          </div>
        ))}
      </div>

      {form.hasAlarm && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Alarm Panel Location</Label>
            <Input value={form.alarmPanelLocation} onChange={e => set("alarmPanelLocation", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Alarm Code (sensitive)</Label>
            <Input type="password" value={form.alarmCode} onChange={e => set("alarmCode", e.target.value)} className="mt-1" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Emergency Contact Name</Label>
          <Input value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Emergency Contact Phone</Label>
          <Input value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Access Notes (sensitive)</Label>
        <Textarea value={form.accessNotes} onChange={e => set("accessNotes", e.target.value)} placeholder="Gate codes, lockbox location, key instructions..." className="mt-1" rows={2} />
      </div>
      <div>
        <Label>Property Notes</Label>
        <Textarea value={form.propertyNotes} onChange={e => set("propertyNotes", e.target.value)} placeholder="Anything unique about this property..." className="mt-1" rows={2} />
      </div>

      {/* Account Manager & Notification Prefs — Signal Flare only */}
      {form.serviceTier === "signal_flare" && (
        <div className="space-y-3 border rounded-lg p-3 border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">⚡ Signal Flare Settings</p>
          <div>
            <Label>Account Manager</Label>
            <Select value={form.accountManagerId} onValueChange={v => set("accountManagerId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select account manager..." /></SelectTrigger>
              <SelectContent>
                {(managers ?? []).map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">Escalation Enabled</Label>
            <Switch
              checked={form.notificationPreferences.escalation_enabled}
              onCheckedChange={v => set("notificationPreferences", { ...form.notificationPreferences, escalation_enabled: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Emergency Threshold (min)</Label>
              <Input type="number" value={form.notificationPreferences.emergency_threshold_minutes}
                onChange={e => set("notificationPreferences", { ...form.notificationPreferences, emergency_threshold_minutes: Number(e.target.value) })}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">High Threshold (min)</Label>
              <Input type="number" value={form.notificationPreferences.high_threshold_minutes}
                onChange={e => set("notificationPreferences", { ...form.notificationPreferences, high_threshold_minutes: Number(e.target.value) })}
                className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Global Alerts CC</Label>
            <Input value={form.notificationPreferences.global_alerts_cc}
              onChange={e => set("notificationPreferences", { ...form.notificationPreferences, global_alerts_cc: e.target.value })}
              className="mt-1" placeholder="alerts@standingrockstewards.com" />
          </div>
        </div>
      )}

      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Add Property"}
      </Button>
    </div>
  );
}

export default function AdminProperties() {
  const { data: properties, isLoading } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = (properties ?? []).filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.nickname.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q);
    const matchTier = tierFilter === "all" || p.serviceTier === tierFilter;
    return matchSearch && matchTier;
  });

  return (
    <AppLayout
      title="Properties"
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-property">
              <Plus className="w-4 h-4 mr-1" /> Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <AddPropertyDialog onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search properties or owners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-properties"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Tiers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="anchor_watch">Anchor Watch</SelectItem>
              <SelectItem value="shipshape">Shipshape</SelectItem>
              <SelectItem value="launch_crew">Launch Crew</SelectItem>
              <SelectItem value="signal_flare">⚡ Signal Flare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Property cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No properties found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(prop => (
              <Link key={prop.id} href={`/properties/${prop.id}`}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer" data-testid={`card-property-${prop.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${prop.active ? "bg-green-500" : "bg-gray-400"}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{prop.nickname}</p>
                          <p className="text-xs text-muted-foreground truncate">{prop.ownerName} · {prop.city}, {prop.state}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TierBadge tier={prop.serviceTier} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground ml-6">
                      {prop.hasDock && <span>Dock</span>}
                      {prop.hasBoat && <span>Boat</span>}
                      {prop.hasGenerator && <span>Generator</span>}
                      {prop.interiorAccess && <span>Interior Access</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
