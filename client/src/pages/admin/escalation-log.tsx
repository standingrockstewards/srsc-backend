import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, AlertOctagon } from "lucide-react";
import type { EscalationLog, Property } from "../../../../shared/schema";

const ESCALATION_LEVELS = ["Initial", "First Escalation", "Second Escalation"] as const;

function escalationLevelBadge(level: string) {
  const styles: Record<string, string> = {
    "Initial": "bg-blue-100 text-blue-800 border-blue-200",
    "First Escalation": "bg-orange-100 text-orange-800 border-orange-200",
    "Second Escalation": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge className={`text-xs font-semibold border ${styles[level] ?? "bg-muted text-muted-foreground"}`}>
      {level}
    </Badge>
  );
}

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    Emergency: "bg-red-100 text-red-800 border-red-200",
    High: "bg-orange-100 text-orange-800 border-orange-200",
    Medium: "bg-amber-100 text-amber-800 border-amber-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <Badge className={`text-xs font-semibold border ${styles[severity] ?? "bg-muted"}`}>
      {severity}
    </Badge>
  );
}

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function EscalationLogPage() {
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState(false);

  const { data: logs = [], isLoading } = useQuery<EscalationLog[]>({
    queryKey: ["/api/escalation-log"],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const filtered = logs.filter(log => {
    if (propertyFilter !== "all" && log.propertyId !== Number(propertyFilter)) return false;
    if (levelFilter !== "all" && log.escalationLevel !== levelFilter) return false;
    if (resolvedFilter && !log.resolvedBeforeEscalation) return false;
    if (dateFrom && log.triggeredAt < dateFrom) return false;
    if (dateTo && log.triggeredAt > dateTo + "T23:59:59") return false;
    return true;
  });

  return (
    <AppLayout title="Escalation Log" subtitle="Signal Flare Automation">
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Property</Label>
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nickname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Escalation Level</Label>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {ESCALATION_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">From Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">To Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch
                  checked={resolvedFilter}
                  onCheckedChange={setResolvedFilter}
                  id="resolved-toggle"
                />
                <Label htmlFor="resolved-toggle" className="text-xs cursor-pointer">
                  Resolved Before Escalation Only
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* Desktop Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Loading escalation log...
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No escalation log entries match the current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Property</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Alert Event ID</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Escalation Level</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Triggered At</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Account Manager</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Notification Sent</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Resolved Before Esc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((log, idx) => {
                        const property = propertyMap[log.propertyId];
                        const manager = log.accountManagerId ? userMap[log.accountManagerId] : null;
                        return (
                          <tr
                            key={log.id}
                            className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium">{property?.nickname ?? `Property #${log.propertyId}`}</span>
                              <span className="block text-xs text-muted-foreground">{property?.ownerName}</span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                              #{log.alertEventId}
                            </td>
                            <td className="px-4 py-3">
                              {escalationLevelBadge(log.escalationLevel)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(log.triggeredAt)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {manager ? (
                                <span>{manager.name}<span className="text-muted-foreground ml-1">({manager.role})</span></span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {log.notificationSent ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Sent</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {log.resolvedBeforeEscalation ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Yes</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">No</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map(log => {
                const property = propertyMap[log.propertyId];
                const manager = log.accountManagerId ? userMap[log.accountManagerId] : null;
                return (
                  <Card key={log.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{property?.nickname ?? `Property #${log.propertyId}`}</p>
                          <p className="text-xs text-muted-foreground">{property?.ownerName}</p>
                        </div>
                        {escalationLevelBadge(log.escalationLevel)}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-muted-foreground">Alert Event:</span>
                        <span className="font-mono">#{log.alertEventId}</span>
                        <span className="text-muted-foreground">Triggered:</span>
                        <span>{formatDate(log.triggeredAt)}</span>
                        <span className="text-muted-foreground">Account Manager:</span>
                        <span>{manager ? manager.name : "—"}</span>
                        <span className="text-muted-foreground">Notification:</span>
                        <span>{log.notificationSent ? "Sent" : "Pending"}</span>
                        <span className="text-muted-foreground">Resolved Before Esc.:</span>
                        <span>{log.resolvedBeforeEscalation ? "Yes" : "No"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
