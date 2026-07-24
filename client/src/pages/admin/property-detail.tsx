import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, TierBadge, PriorityBadge } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Phone, Mail, Eye, EyeOff, ClipboardList,
  AlertTriangle, CheckCircle2, Plus, Edit2, Zap
} from "lucide-react";
import SignalFlareDashboard from "./signal-flare-dashboard";
import { PropertyTaskRatesTab } from "@/components/property-task-rates-tab";
import { PropertyDocumentsTab } from "@/components/property-documents-tab";
import type { Property, Visit, Recommendation } from "../../../../shared/schema";

function SensitiveField({ label, value }: { label: string; value: string | null | undefined }) {
  const [visible, setVisible] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono">{visible ? value : "••••••••"}</p>
      </div>
      <button onClick={() => setVisible(!visible)} className="text-muted-foreground p-1">
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminPropertyDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();

  const { data: property, isLoading } = useQuery<Property>({ queryKey: ["/api/properties", id] });
  const { data: visits } = useQuery<Visit[]>({ queryKey: ["/api/visits", { propertyId: id }], queryFn: async () => {
    const res = await apiRequest("GET", `/api/visits?propertyId=${id}`);
    return res.json();
  }});
  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recommendations?propertyId=${id}`);
      return res.json();
    }
  });
  const { data: allScheduled } = useQuery<any[]>({ queryKey: ["/api/scheduled"] });
  const scheduled = (allScheduled ?? []).filter((s: any) => s.propertyId === id || s.property_id === id);
  const { data: allWorkOrders } = useQuery<any[]>({ queryKey: ["/api/vendor-work-orders"] });
  const propertyWorkOrders = (allWorkOrders ?? []).filter((wo: any) => wo.property_id === id);

  const toggleActive = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/properties/${id}`, { active: !property?.active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    }
  });

  const resolveRec = useMutation({
    mutationFn: async (recId: number) => {
      const res = await apiRequest("PATCH", `/api/recommendations/${recId}/resolve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations", id] });
      toast({ title: "Recommendation resolved" });
    }
  });

  if (isLoading) return <AppLayout title="Loading..."><div className="p-8 text-center text-muted-foreground">Loading property...</div></AppLayout>;
  if (!property) return <AppLayout title="Not Found"><div className="p-8 text-center">Property not found</div></AppLayout>;

  const openRecs = (recommendations ?? []).filter(r => !r.resolved);

  return (
    <AppLayout
      title={property.nickname}
      subtitle={`${property.address}, ${property.city}, ${property.state}`}
      actions={
        <div className="flex items-center gap-2">
          <TierBadge tier={property.serviceTier} />
          <Link href={`/visit/new/${property.id}`}>
            <Button size="sm" data-testid="button-start-visit">
              <Plus className="w-4 h-4 mr-1" /> Start Visit
            </Button>
          </Link>
        </div>
      }
    >
      <div className="p-4 max-w-4xl mx-auto">
        <Tabs defaultValue={property.serviceTier === "signal_flare" ? "monitoring" : "overview"}>
          <TabsList className="mb-4">
            {property.serviceTier === "signal_flare" && (
              <TabsTrigger value="monitoring" className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Monitoring
              </TabsTrigger>
            )}
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="visits">
              Visit History {visits?.length ? `(${visits.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              Action Items {openRecs.length ? `(${openRecs.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">
              Activity {(scheduled.length + propertyWorkOrders.length) > 0 ? `(${scheduled.length + propertyWorkOrders.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* SIGNAL FLARE MONITORING */}
          {property.serviceTier === "signal_flare" && (
            <TabsContent value="monitoring">
              <SignalFlareDashboard propertyId={property.id} />
            </TabsContent>
          )}

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Owner Information</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-base font-semibold">{property.ownerName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {property.ownerPhone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {property.ownerEmail}
                  </div>
                  {property.emergencyContactName && (
                    <div className="pt-1 border-t text-xs text-muted-foreground">
                      Emergency: {property.emergencyContactName} · {property.emergencyContactPhone}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Property Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Service</span>
                    <Switch
                      checked={!!property.active}
                      onCheckedChange={() => toggleActive.mutate()}
                      data-testid="switch-active"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Service Tier</span>
                    <TierBadge tier={property.serviceTier} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Open Action Items</span>
                    <span className={`text-sm font-semibold ${openRecs.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {openRecs.length === 0 ? "None" : openRecs.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Visits</span>
                    <span className="text-sm font-semibold">{visits?.length ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sensitive Fields */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sensitive Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <SensitiveField label="Access Notes" value={property.accessNotes} />
                <SensitiveField label="Alarm Code" value={property.alarmCode} />
                <SensitiveField label="Alarm Panel Location" value={property.alarmPanelLocation} />
                {property.propertyNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Property Notes</p>
                    <p className="text-sm mt-1">{property.propertyNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VISIT HISTORY */}
          <TabsContent value="visits" className="space-y-2">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">{visits?.length ?? 0} total visits</p>
              <Link href={`/visit/new/${property.id}`}>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Visit</Button>
              </Link>
            </div>
            {!visits?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No visits recorded yet</p>
              </div>
            ) : (
              visits.map(visit => (
                <Link key={visit.id} href={`/visits/${visit.id}`}>
                  <Card className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`card-visit-${visit.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{visit.visitDate}</p>
                          <p className="text-xs text-muted-foreground capitalize">{visit.visitType.replace(/_/g, " ")} · {visit.durationMinutes ? `${visit.durationMinutes} min` : "—"}</p>
                        </div>
                        <StatusBadge status={visit.overallStatus ?? visit.status} />
                      </div>
                      {visit.generalNotes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{visit.generalNotes}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>

          {/* RECOMMENDATIONS */}
          <TabsContent value="recommendations" className="space-y-2">
            {!(recommendations ?? []).length ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No action items — property in good standing</p>
              </div>
            ) : (
              (recommendations ?? []).map(rec => (
                <Card key={rec.id} className={rec.resolved ? "opacity-50" : ""} data-testid={`card-rec-${rec.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${rec.resolved ? "text-gray-400" : "text-amber-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${rec.resolved ? "line-through text-muted-foreground" : ""}`}>{rec.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <PriorityBadge priority={rec.priority} />
                          <span className="text-xs text-muted-foreground">{rec.createdAt}</span>
                        </div>
                      </div>
                      {!rec.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveRec.mutate(rec.id)}
                          disabled={resolveRec.isPending}
                          data-testid={`button-resolve-${rec.id}`}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* DETAILS */}
          <TabsContent value="details">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: "Interior Access", val: property.interiorAccess },
                    { label: "Dock", val: property.hasDock },
                    { label: "Boat / Watercraft", val: property.hasBoat },
                    { label: "Boat Lift", val: property.hasBoatLift },
                    { label: "Generator", val: property.hasGenerator },
                    { label: "Irrigation System", val: property.hasIrrigation },
                    { label: "Propane System", val: property.hasPropane },
                    { label: "Alarm System", val: property.hasAlarm },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${val ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className={val ? "" : "text-muted-foreground"}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Added: {property.dateAdded} · ID: #{property.id}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACTIVITY — Scheduled Visits + Work Orders */}
          <TabsContent value="activity" className="space-y-4">
            {/* Scheduled Visits */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scheduled Visits ({scheduled.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scheduled.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scheduled visits</p>
                ) : scheduled.map((sv: any) => (
                  <div key={sv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sv.scheduledDate ?? sv.scheduled_date}</p>
                      {sv.scheduledTime && <p className="text-xs text-muted-foreground">{sv.scheduledTime}</p>}
                      {sv.notes && <p className="text-xs text-muted-foreground mt-0.5">{sv.notes}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sv.completed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {sv.completed ? "Completed" : "Scheduled"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Vendor Work Orders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Work Orders ({propertyWorkOrders.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {propertyWorkOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendor work orders</p>
                ) : propertyWorkOrders.map((wo: any) => (
                  <div key={wo.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{wo.title}</p>
                      {wo.due_date && <p className="text-xs text-muted-foreground">Due: {wo.due_date}</p>}
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted capitalize">
                      {wo.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="pricing">
            <PropertyTaskRatesTab propertyId={id} />
          </TabsContent>
          <TabsContent value="documents">
            <PropertyDocumentsTab propertyId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
