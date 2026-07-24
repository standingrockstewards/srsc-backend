import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { generateMonitoringReport } from "@/lib/monitoring-pdf";
import { FileDown } from "lucide-react";
import type { Property, MonitoringDevice, AlertEvent } from "../../../../shared/schema";

type Props = {
  property: Property;
  devices: MonitoringDevice[];
  alerts: AlertEvent[];
  onClose: () => void;
};

export default function SignalFlareReportModal({ property, devices, alerts, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth);
  const [recommendations, setRecommendations] = useState("");
  const [billingHours, setBillingHours] = useState("1");
  const [billingRate, setBillingRate] = useState("99");

  const handleGenerate = () => {
    const periodEvents = alerts.filter(e =>
      e.eventTimestamp >= periodStart && e.eventTimestamp <= periodEnd + "T23:59:59"
    );
    const byType: Record<string, number> = {};
    periodEvents.forEach(e => { byType[e.eventType] = (byType[e.eventType] || 0) + 1; });

    generateMonitoringReport({
      property,
      devices,
      events: periodEvents,
      report: {
        periodStart,
        periodEnd,
        recommendations,
        billingHours: Number(billingHours),
        billingRate: Number(billingRate),
        generatedBy: user?.name || "Admin",
      },
    });

    // Save record to DB
    apiRequest("POST", `/api/properties/${property.id}/monitoring-reports`, {
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      totalEvents: periodEvents.length,
      eventsByType: JSON.stringify(byType),
      alertsResolved: periodEvents.filter(e => e.resolved).length,
      siteVisitsTriggered: periodEvents.filter(e => e.actionTaken === "Site Visit Initiated").length,
      recommendations,
      billingHours: Number(billingHours),
      billingRate: Number(billingRate),
      billingTotal: Number(billingHours) * Number(billingRate),
      generatedBy: user?.name || "Admin",
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["/api/properties", property.id, "monitoring-reports"] });
      toast({ title: "Report generated and saved" });
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Generate Monthly Monitoring Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border text-sm">
            <p className="font-semibold">{property.nickname}</p>
            <p className="text-muted-foreground text-xs">{property.ownerName} · Signal Flare™</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Period Start</Label>
              <Input type="date" className="mt-1" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Period End</Label>
              <Input type="date" className="mt-1" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Billing Hours</Label>
              <Input type="number" className="mt-1" value={billingHours} onChange={e => setBillingHours(e.target.value)} min="0" step="0.5" />
            </div>
            <div>
              <Label className="text-sm">Rate ($/hr)</Label>
              <Input type="number" className="mt-1" value={billingRate} onChange={e => setBillingRate(e.target.value)} min="0" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Recommendations / Notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Any recommendations for the client..."
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            The PDF will be downloaded immediately and the report record saved to the property history.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleGenerate}
            style={{ backgroundColor: '#A0432F', color: '#F5F0EA' }}
            data-testid="button-generate-report"
          >
            <FileDown className="w-4 h-4 mr-2" /> Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
