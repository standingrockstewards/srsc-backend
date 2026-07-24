import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, TierBadge } from "@/components/status-badge";
import { apiRequest } from "@/lib/queryClient";
import { FileDown, ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Visit, Property, VisitPhoto, VendorDispatch, Recommendation } from "../../../../shared/schema";
import { getResultLabel, getResultColor, CHECKLIST_MODULES } from "@/lib/checklist";
import { generateAAR } from "@/lib/pdf";

export default function AdminVisitDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: visit, isLoading } = useQuery<Visit>({ queryKey: ["/api/visits", id], queryFn: async () => {
    const res = await apiRequest("GET", `/api/visits/${id}`);
    return res.json();
  }});
  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", visit?.propertyId],
    enabled: !!visit?.propertyId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties/${visit?.propertyId}`);
      return res.json();
    }
  });
  const { data: photos } = useQuery<VisitPhoto[]>({
    queryKey: ["/api/visits", id, "photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits/${id}/photos`);
      return res.json();
    }
  });
  const { data: vendors } = useQuery<VendorDispatch[]>({
    queryKey: ["/api/visits", id, "vendors"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits/${id}/vendors`);
      return res.json();
    }
  });
  const { data: recs } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations", property?.id],
    enabled: !!property?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recommendations?propertyId=${property?.id}`);
      return res.json();
    }
  });

  if (isLoading) return <AppLayout title="Loading..."><div className="p-8 text-center text-muted-foreground">Loading visit...</div></AppLayout>;
  if (!visit) return <AppLayout title="Not Found"><div className="p-8 text-center">Visit not found</div></AppLayout>;

  const checklistData = visit.checklistData ? JSON.parse(visit.checklistData) : {};

  const handleDownloadAAR = () => {
    if (!property) return;
    generateAAR({ visit, property, photos: photos ?? [], vendors: vendors ?? [], recommendations: recs ?? [] });
  };

  return (
    <AppLayout
      title="Visit Report"
      subtitle={property?.nickname ?? ""}
      actions={
        <div className="flex gap-2">
          <Link href={`/properties/${property?.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Property
            </Button>
          </Link>
          <Button size="sm" onClick={handleDownloadAAR} data-testid="button-download-aar">
            <FileDown className="w-4 h-4 mr-1" /> Download AAR
          </Button>
        </div>
      }
    >
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        {/* Header card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{property?.nickname}</p>
                <p className="text-sm text-muted-foreground">{property?.ownerName} · {property?.address}, {property?.city}</p>
              </div>
              <TierBadge tier={property?.serviceTier} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{visit.visitDate}</p></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium capitalize">{visit.visitType?.replace(/_/g, " ")}</p></div>
              <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{visit.durationMinutes ? `${visit.durationMinutes} min` : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Weather</p><p className="font-medium">{visit.weatherTemp ? `${visit.weatherTemp}°F` : ""} {visit.weatherConditions ?? "—"}</p></div>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <span className="text-sm text-muted-foreground">Overall Status:</span>
              <StatusBadge status={visit.overallStatus ?? visit.status} />
            </div>
          </CardContent>
        </Card>

        {/* Checklist Results */}
        {CHECKLIST_MODULES.filter(mod => checklistData[mod.key]).map(mod => {
          const modData = checklistData[mod.key] ?? {};
          const items = mod.items.filter(item => modData[item.key]);
          if (!items.length) return null;
          return (
            <Card key={mod.key}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{mod.label}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(item => {
                    const result = modData[item.key];
                    const resultVal = result?.result;
                    return (
                      <div key={item.key} className={`px-4 py-3 ${resultVal === "fail" ? "bg-red-50 dark:bg-red-950/20" : resultVal === "flag" ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {resultVal === "pass" && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />}
                            {resultVal === "flag" && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                            {resultVal === "fail" && <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                            <p className="text-sm">{item.label}</p>
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ${getResultColor(resultVal)}`}>
                            {getResultLabel(resultVal)}
                          </span>
                        </div>
                        {result?.notes && <p className="text-xs text-muted-foreground mt-1 ml-6">{result.notes}</p>}
                        {/* Photos for this item */}
                        {(photos ?? []).filter(p => p.checklistItemKey === `${mod.key}.${item.key}`).map(photo => (
                          <img key={photo.id} src={photo.dataUrl} alt={photo.caption ?? item.label} className="mt-2 ml-6 rounded-lg max-h-40 object-cover" />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Actions Taken */}
        {visit.actionsTaken && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Actions Taken</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{visit.actionsTaken}</p></CardContent>
          </Card>
        )}

        {/* Vendor Dispatches */}
        {!!(vendors ?? []).length && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Vendor Dispatches</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(vendors ?? []).map(v => (
                <div key={v.id} className="p-3 bg-muted rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{v.vendorName}</span>
                    <span className="text-muted-foreground">{v.dateDispatched}</span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">{v.reason}</p>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span>Approval: {v.approvalObtained ? "Yes" : "No"}</span>
                    {v.estimatedCost && <span>Est. Cost: ${v.estimatedCost.toFixed(2)}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Billing Summary */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Billing Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Hours ({visit.hoursWorked ?? 0}h × ${visit.hourlyRate ?? 85}/hr)</span><span>${((visit.hoursWorked ?? 0) * (visit.hourlyRate ?? 85)).toFixed(2)}</span></div>
              {(visit.materialsAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Materials</span><span>${(visit.materialsAmount ?? 0).toFixed(2)}</span></div>}
              {(visit.mileage ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Mileage ({visit.mileage} mi)</span><span>${((visit.mileage ?? 0) * 0.67).toFixed(2)}</span></div>}
              <div className="flex justify-between font-semibold pt-2 border-t mt-2">
                <span>Total</span>
                <span>${(((visit.hoursWorked ?? 0) * (visit.hourlyRate ?? 85)) + (visit.materialsAmount ?? 0) + ((visit.mileage ?? 0) * 0.67)).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature */}
        {visit.techSignature && (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="text-muted-foreground">Submitted by</p>
              <p className="font-semibold">{visit.techSignature}</p>
              <p className="text-xs text-muted-foreground">{visit.techSignatureDate}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
