import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { getActiveModules, CHECKLIST_MODULES, type ChecklistModule, type ChecklistData } from "@/lib/checklist";
import { saveDraft, getDraft, deleteDraft, generateId, compressImage } from "@/lib/offline";
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight,
  Camera, Trash2, Save, Send, Home, CloudOff
} from "lucide-react";
import type { Property, OfflineDraft } from "../../../../shared/schema";

// ─── PASS/FLAG/FAIL SELECTOR ────────────────────────────────────────────────
function PFFSelector({
  value, onChange
}: { value: string | null; onChange: (v: string) => void }) {
  const opts = [
    { val: "pass", label: "Pass", icon: CheckCircle2, selected: "selected-pass" },
    { val: "flag", label: "Flag", icon: AlertTriangle, selected: "selected-flag" },
    { val: "fail", label: "Fail", icon: XCircle, selected: "selected-fail" },
  ];
  return (
    <div className="field-radio-group">
      {opts.map(opt => (
        <button
          key={opt.val}
          type="button"
          onClick={() => onChange(opt.val === value ? "" : opt.val)}
          className={`field-radio-btn ${value === opt.val ? opt.selected : "unselected"}`}
          data-testid={`btn-pff-${opt.val}`}
        >
          <opt.icon className="w-5 h-5 mb-1" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── CHECKLIST ITEM ─────────────────────────────────────────────────────────
function ChecklistItem({
  moduleKey, item, value, onChange, onPhotoCapture, photos
}: {
  moduleKey: string;
  item: any;
  value: any;
  onChange: (v: any) => void;
  onPhotoCapture?: (itemKey: string, file: File) => Promise<void>;
  photos?: { key: string; dataUrl: string }[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const itemKey = `${moduleKey}.${item.key}`;
  const itemPhotos = (photos ?? []).filter(p => p.key === itemKey);

  const needsPhoto = (value?.result === "flag" || value?.result === "fail") && item.allowPhoto;

  return (
    <div className={`p-3 rounded-lg border mb-2 ${
      value?.result === "fail" ? "border-red-200 bg-red-50 dark:bg-red-950/30" :
      value?.result === "flag" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30" :
      "border-border bg-background"
    }`}>
      <p className="text-sm font-medium mb-2">{item.label}</p>

      {item.fieldType === "pass_flag_fail" && (
        <PFFSelector
          value={value?.result ?? null}
          onChange={result => onChange({ ...value, result })}
        />
      )}

      {item.fieldType === "select" && (
        <Select value={value?.result ?? ""} onValueChange={result => onChange({ ...value, result })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {item.options?.map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(item.fieldType === "text") && (
        <Textarea
          value={value?.result ?? ""}
          onChange={e => onChange({ ...value, result: e.target.value })}
          placeholder="Enter notes..."
          rows={2}
          className="mt-1"
        />
      )}

      {item.fieldType === "number" && (
        <Input
          type="number"
          value={value?.result ?? ""}
          onChange={e => onChange({ ...value, result: e.target.value })}
          placeholder="Enter value..."
          className="mt-1"
        />
      )}

      {item.fieldType === "date" && (
        <Input
          type="date"
          value={value?.result ?? ""}
          onChange={e => onChange({ ...value, result: e.target.value })}
          className="mt-1"
        />
      )}

      {/* Notes field for PFF items */}
      {item.allowNotes && item.fieldType === "pass_flag_fail" && (
        <Textarea
          value={value?.notes ?? ""}
          onChange={e => onChange({ ...value, notes: e.target.value })}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-2"
        />
      )}

      {/* Photo capture */}
      {item.allowPhoto && onPhotoCapture && (
        <div className="mt-2">
          {needsPhoto && (
            <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
              <Camera className="w-3 h-3" /> Photo recommended for flagged/failed items
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {itemPhotos.map((p, i) => (
              <img key={i} src={p.dataUrl} className="w-20 h-20 object-cover rounded-lg border" alt="capture" />
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground text-xs gap-1"
              data-testid={`btn-photo-${item.key}`}
            >
              <Camera className="w-5 h-5" />
              Photo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) await onPhotoCapture(itemKey, file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── VISIT FLOW MAIN ────────────────────────────────────────────────────────
export default function TechVisitFlow() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = Number(params.propertyId);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Draft state
  const [draftId] = useState(() => generateId());
  const [step, setStep] = useState(0); // 0=setup, 1..N=modules, last=review
  const [visitType, setVisitType] = useState("routine");
  const [stormSubtype, setStormSubtype] = useState("post_storm");
  const [requestReason, setRequestReason] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [signature, setSignature] = useState(user?.name ?? "");
  const [checklistData, setChecklistData] = useState<ChecklistData>({});
  const [photos, setPhotos] = useState<{ key: string; dataUrl: string; caption?: string }[]>([]);
  const [vendors, setVendors] = useState<{ vendorName: string; reason: string; dateDispatched: string; approvalObtained: boolean; estimatedCost: string }[]>([]);
  const [recs, setRecs] = useState<{ description: string; priority: string }[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [autoSaveTimer, setAutoSaveTimer] = useState<number | null>(null);
  const [summaryFields, setSummaryFields] = useState({ weatherTemp: "", weatherConditions: "Clear", durationMinutes: "", generalNotes: "" });

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: ["/api/properties", propertyId],
    queryFn: async () => { const r = await apiRequest("GET", `/api/properties/${propertyId}`); return r.json(); },
  });

  // Online/offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // Auto-save every 30s
  const doAutoSave = useCallback(async () => {
    if (!property) return;
    const draft: OfflineDraft = {
      id: draftId, propertyId, visitType, startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(), formData: { visitType },
      checklistData, photos, synced: false,
    };
    await saveDraft(draft);
  }, [draftId, propertyId, visitType, checklistData, photos, property]);

  useEffect(() => {
    const t = window.setInterval(doAutoSave, 30000);
    return () => clearInterval(t);
  }, [doAutoSave]);

  const activeModules = property ? getActiveModules(property) : [];
  // Filter out summary module (step N) — handled at review
  const checklistModules = activeModules.filter(m => m.key !== "summary");
  const totalSteps = checklistModules.length + 2; // 0=setup, 1..N=modules, final=review/submit
  const currentModule = step > 0 && step <= checklistModules.length ? checklistModules[step - 1] : null;

  const setModuleItemResult = (moduleKey: string, itemKey: string, value: any) => {
    setChecklistData(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? {}), [itemKey]: value }
    }));
  };

  const getItemValue = (moduleKey: string, itemKey: string) => {
    return checklistData[moduleKey]?.[itemKey] ?? null;
  };

  const handlePhoto = async (itemKey: string, file: File) => {
    try {
      const dataUrl = await compressImage(file);
      setPhotos(prev => [...prev, { key: itemKey, dataUrl, caption: itemKey }]);
    } catch {
      toast({ title: "Photo error", description: "Could not process photo", variant: "destructive" });
    }
  };

  // Calculate overall status from checklist
  const calcOverallStatus = () => {
    let hasFail = false, hasFlag = false;
    for (const [modKey, mod] of Object.entries(checklistData)) {
      for (const [, item] of Object.entries(mod as any)) {
        const r = (item as any)?.result;
        if (r === "fail") hasFail = true;
        if (r === "flag") hasFlag = true;
      }
    }
    return hasFail ? "action_required" : hasFlag ? "items_flagged" : "all_clear";
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const overallStatus = calcOverallStatus();
      // Create visit
      const visitRes = await apiRequest("POST", "/api/visits", {
        propertyId, techId: user?.id,
        visitType, visitDate: new Date().toISOString().split('T')[0],
        weatherTemp: summaryFields.weatherTemp, weatherConditions: summaryFields.weatherConditions,
        durationMinutes: summaryFields.durationMinutes ? parseInt(summaryFields.durationMinutes) : null,
        generalNotes: summaryFields.generalNotes,
        overallStatus, actionsTaken,
        stormSubtype: visitType === "storm_event" ? stormSubtype : null,
        requestReason: visitType === "requested_check" ? requestReason : null,
        status: "submitted",
        checklistData: JSON.stringify(checklistData),
        nextScheduledVisit: nextVisit,
        techSignature: signature, techSignatureDate: new Date().toISOString().split('T')[0],
      });
      const visit = await visitRes.json();

      // Upload photos
      for (const photo of photos) {
        await apiRequest("POST", `/api/visits/${visit.id}/photos`, {
          checklistItemKey: photo.key,
          filename: `photo_${Date.now()}.jpg`,
          dataUrl: photo.dataUrl,
          caption: photo.caption,
        });
      }

      // Save vendors
      for (const v of vendors) {
        await apiRequest("POST", `/api/visits/${visit.id}/vendors`, {
          ...v, estimatedCost: v.estimatedCost ? parseFloat(v.estimatedCost) : null,
        });
      }

      // Save recommendations
      for (const r of recs) {
        await apiRequest("POST", "/api/recommendations", {
          ...r, visitId: visit.id, propertyId,
        });
      }

      // Clean up draft
      await deleteDraft(draftId);
      return visit;
    },
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({ title: "Visit submitted!", description: "Report saved successfully." });
      navigate("/");
    },
    onError: (e: any) => {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    }
  });

  if (isLoading) return <AppLayout title="Loading..."><div className="p-8 text-center text-muted-foreground">Loading property...</div></AppLayout>;
  if (!property) return <AppLayout title="Not Found"><div className="p-8 text-center">Property not found</div></AppLayout>;

  const progress = Math.round((step / (totalSteps - 1)) * 100);

  return (
    <AppLayout
      title={property.nickname}
      subtitle={step === 0 ? "Start Visit" : step > checklistModules.length ? "Review & Submit" : currentModule?.label ?? ""}
      actions={
        <div className="flex items-center gap-2">
          {isOffline && (
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-full">
              <CloudOff className="w-3 h-3" /> Offline
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={doAutoSave}>
            <Save className="w-4 h-4" />
          </Button>
        </div>
      }
    >
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="px-4 pb-24">
          {/* STEP 0: Setup */}
          {step === 0 && (
            <div className="space-y-4 pt-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Visit Setup</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Visit Type *</Label>
                    <Select value={visitType} onValueChange={setVisitType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine Visit</SelectItem>
                        <SelectItem value="storm_event">Storm Event</SelectItem>
                        <SelectItem value="requested_check">Requested Check</SelectItem>
                        <SelectItem value="pre_season_open">Pre-Season Open</SelectItem>
                        <SelectItem value="post_season_close">Post-Season Close</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {visitType === "storm_event" && (
                    <div>
                      <Label>Storm Sub-type</Label>
                      <Select value={stormSubtype} onValueChange={setStormSubtype}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pre_storm">Pre-Storm</SelectItem>
                          <SelectItem value="post_storm">Post-Storm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {visitType === "requested_check" && (
                    <div>
                      <Label>Reason for Request</Label>
                      <Textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} placeholder="What did the owner request we check?" rows={2} className="mt-1" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Temperature (°F)</Label>
                      <Input value={summaryFields.weatherTemp} onChange={e => setSummaryFields(f => ({ ...f, weatherTemp: e.target.value }))} placeholder="72" className="mt-1" />
                    </div>
                    <div>
                      <Label>Conditions</Label>
                      <Select value={summaryFields.weatherConditions} onValueChange={v => setSummaryFields(f => ({ ...f, weatherConditions: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Clear","Cloudy","Rain","Storm","Snow","Ice"].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Modules that will be included */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Modules for This Visit</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {activeModules.map(mod => (
                      <span key={mod.key} className="text-xs bg-muted px-2 py-1 rounded-full capitalize">
                        {mod.label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CHECKLIST STEPS */}
          {currentModule && (
            <div className="pt-2">
              <div className="space-y-1">
                {currentModule.items.map(item => (
                  <ChecklistItem
                    key={item.key}
                    moduleKey={currentModule.key}
                    item={item}
                    value={getItemValue(currentModule.key, item.key)}
                    onChange={v => setModuleItemResult(currentModule.key, item.key, v)}
                    onPhotoCapture={item.allowPhoto ? handlePhoto : undefined}
                    photos={photos}
                  />
                ))}
              </div>
            </div>
          )}

          {/* REVIEW & SUBMIT */}
          {step > checklistModules.length && (
            <div className="pt-2 space-y-4">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Visit Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Overall Status</Label>
                    <p className="text-sm font-semibold mt-1 capitalize">{calcOverallStatus().replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={summaryFields.durationMinutes} onChange={e => setSummaryFields(f => ({ ...f, durationMinutes: e.target.value }))} placeholder="60" className="mt-1" />
                  </div>
                  <div>
                    <Label>General Notes</Label>
                    <Textarea value={summaryFields.generalNotes} onChange={e => setSummaryFields(f => ({ ...f, generalNotes: e.target.value }))} placeholder="Overall visit observations..." rows={3} className="mt-1" />
                  </div>
                  <div>
                    <Label>Actions Taken</Label>
                    <Textarea value={actionsTaken} onChange={e => setActionsTaken(e.target.value)} placeholder="What was done during this visit?" rows={2} className="mt-1" />
                  </div>
                  <div>
                    <Label>Next Scheduled Visit</Label>
                    <Input type="date" value={nextVisit} onChange={e => setNextVisit(e.target.value)} className="mt-1" />
                  </div>
                </CardContent>
              </Card>

              {/* Vendors */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Vendor Dispatches</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setVendors(v => [...v, { vendorName: "", reason: "", dateDispatched: new Date().toISOString().split('T')[0], approvalObtained: false, estimatedCost: "" }])}>
                      + Add
                    </Button>
                  </div>
                </CardHeader>
                {vendors.length > 0 && (
                  <CardContent className="space-y-3">
                    {vendors.map((v, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Vendor Name</Label><Input value={v.vendorName} onChange={e => { const n=[...vendors]; n[i].vendorName=e.target.value; setVendors(n); }} className="mt-0.5" /></div>
                          <div><Label className="text-xs">Date</Label><Input type="date" value={v.dateDispatched} onChange={e => { const n=[...vendors]; n[i].dateDispatched=e.target.value; setVendors(n); }} className="mt-0.5" /></div>
                        </div>
                        <div><Label className="text-xs">Reason</Label><Input value={v.reason} onChange={e => { const n=[...vendors]; n[i].reason=e.target.value; setVendors(n); }} className="mt-0.5" /></div>
                        <div className="flex gap-2 items-center">
                          <Label className="text-xs">Est. Cost $</Label><Input type="number" value={v.estimatedCost} onChange={e => { const n=[...vendors]; n[i].estimatedCost=e.target.value; setVendors(n); }} className="mt-0.5 w-28" />
                          <Button variant="ghost" size="icon" onClick={() => setVendors(vv => vv.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Recommendations</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setRecs(r => [...r, { description: "", priority: "Medium" }])}>
                      + Add
                    </Button>
                  </div>
                </CardHeader>
                {recs.length > 0 && (
                  <CardContent className="space-y-3">
                    {recs.map((r, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                        <Textarea value={r.description} onChange={e => { const n=[...recs]; n[i].description=e.target.value; setRecs(n); }} placeholder="Recommendation..." rows={2} />
                        <div className="flex gap-2 items-center">
                          <Select value={r.priority} onValueChange={v => { const n=[...recs]; n[i].priority=v; setRecs(n); }}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Low","Medium","High","Urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => setRecs(rr => rr.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>

              {/* Signature */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Technician Signature</CardTitle></CardHeader>
                <CardContent>
                  <Input value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your full name" data-testid="input-signature" />
                  <p className="text-xs text-muted-foreground mt-1">By entering your name, you certify this report is accurate.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Sticky footer navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-2 max-w-2xl mx-auto">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="flex-1" data-testid="button-next-step">
              {step === 0 ? "Begin Checklist" : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !signature}
              className="flex-1"
              data-testid="button-submit-visit"
            >
              <Send className="w-4 h-4 mr-1" />
              {submitMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
