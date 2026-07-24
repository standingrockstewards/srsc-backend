import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { subscribeToGlobalAlerts } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TierBadge } from "@/components/status-badge";
import { Building2, ClipboardCheck, AlertTriangle, Calendar, Plus, ChevronRight, Zap, Wifi, WifiOff, Bell, Mail } from "lucide-react";
import type { Visit, Property, ScheduledVisit, Lead } from "../../../../shared/schema";

type DashboardStats = {
  totalActive: number;
  propertiesWithActions: number;
  visitsThisMonth: number;
  upcomingCount: number;
  openRecommendations: number;
  recentActivity: Visit[];
  upcoming: ScheduledVisit[];
};

type SFStats = {
  totalProperties: number;
  totalDevices: number;
  unresolvedAlerts: number;
  devicesOffline: number;
};

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start justify-between"
      style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}
    >
      <div>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6a6a6a" }}>{label}</p>
        <p className={`text-2xl font-bold leading-none ${color ?? ""}`} style={{ color: color ? undefined : "#F5F0EA" }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: "#6a6a6a" }}>{sub}</p>}
      </div>
      <div className="p-2 rounded-lg" style={{ background: "#252525" }}>
        <Icon className="w-5 h-5" style={{ color: "#7A8C6E" }} />
      </div>
    </div>
  );
}

// ─── LEADS PANEL ──────────────────────────────────────────────────────────────
function LeadsPanel() {
  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/leads/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/leads"] }),
  });

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    qualified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  const newCount = (leads ?? []).filter(l => l.status === "new").length;

  return (
    <Card className={newCount > 0 ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Contact Form Leads</CardTitle>
            {newCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#A0432F", color: "#F5F0EA" }}>
                {newCount} new
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading leads...</p>}
        {!isLoading && (!leads || leads.length === 0) && (
          <p className="text-sm text-muted-foreground">No contact form submissions yet.</p>
        )}
        {!isLoading && leads && leads.length > 0 && (
          <div className="space-y-3">
            {leads.slice(0, 10).map(lead => (
              <div key={lead.id} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{lead.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[lead.status] ?? statusColors.new}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>{lead.email} · {lead.phone}</p>
                    <p className="truncate">{lead.propertyAddress}</p>
                    <p className="text-primary/80 font-medium">{lead.serviceTierInterest}</p>
                    {lead.message && <p className="italic text-muted-foreground/70 mt-1">"{lead.message.slice(0, 100)}{lead.message.length > 100 ? '...' : ''}"</p>}
                    <p className="text-muted-foreground/50">{new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-col flex-wrap">
                  {lead.status !== "contacted" && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => statusMutation.mutate({ id: lead.id, status: "contacted" })}>Mark Contacted</Button>
                  )}
                  {lead.status !== "qualified" && lead.status !== "closed" && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => statusMutation.mutate({ id: lead.id, status: "qualified" })}>Qualify</Button>
                  )}
                  {lead.status !== "closed" && (
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => statusMutation.mutate({ id: lead.id, status: "closed" })}>Close</Button>
                  )}
                </div>
              </div>
            ))}
            {leads.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">Showing 10 of {leads.length} leads</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: sfStats } = useQuery<SFStats>({
    queryKey: ["/api/signal-flare/stats"],
  });

  useEffect(() => {
    const unsub = subscribeToGlobalAlerts(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/signal-flare/stats"] });
    });
    return unsub;
  }, []);

  const userMap = Object.fromEntries((allUsers ?? []).map(u => [u.id, u]));

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Standing Rock Stewardship Co."
      actions={
        <Link href="/properties">
          <Button size="sm" data-testid="button-add-property">
            <Plus className="w-4 h-4 mr-1" />
            Add Property
          </Button>
        </Link>
      }
    >
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            icon={Building2}
            label="Active Properties"
            value={stats?.totalActive ?? "—"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Properties w/ Actions"
            value={stats?.propertiesWithActions ?? "—"}
            color={stats?.propertiesWithActions ? "text-amber-600" : ""}
          />
          <StatCard
            icon={ClipboardCheck}
            label="Visits This Month"
            value={stats?.visitsThisMonth ?? "—"}
          />
          <StatCard
            icon={Calendar}
            label="Upcoming Visits"
            value={stats?.upcomingCount ?? "—"}
          />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Property List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Properties</CardTitle>
                <Link href="/properties">
                  <Button variant="ghost" size="sm" className="text-xs">View All <ChevronRight className="w-3 h-3 ml-1" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                </div>
              ) : (
                <div className="divide-y">
                  {(properties ?? []).slice(0, 6).map(prop => (
                    <Link key={prop.id} href={`/properties/${prop.id}`}>
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`row-property-${prop.id}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{prop.nickname}</p>
                          <p className="text-xs text-muted-foreground truncate">{prop.ownerName}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <TierBadge tier={prop.serviceTier} />
                          <span className={`w-2 h-2 rounded-full ${prop.active ? "bg-green-500" : "bg-gray-400"}`} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Visit Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                </div>
              ) : !stats?.recentActivity?.length ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No visits yet</div>
              ) : (
                <div className="divide-y">
                  {stats.recentActivity.slice(0, 6).map(visit => {
                    const prop = (properties ?? []).find(p => p.id === visit.propertyId);
                    const tech = userMap[visit.techId];
                    return (
                      <Link key={visit.id} href={`/visits/${visit.id}`}>
                        <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`row-visit-${visit.id}`}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{prop?.nickname ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{visit.visitDate} · {tech?.name ?? "—"}</p>
                          </div>
                          <StatusBadge status={visit.overallStatus ?? visit.status} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Open Recommendations */}
        {(stats?.openRecommendations ?? 0) > 0 && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Open Action Items ({stats?.openRecommendations})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                There are {stats?.openRecommendations} outstanding recommendations across properties.
                Visit individual property pages to review and resolve them.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Leads Panel */}
        <LeadsPanel />

        {/* Signal Flare Monitoring Panel */}
        {(sfStats?.totalProperties ?? 0) > 0 && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Signal Flare Monitoring
                  </CardTitle>
                </div>
                <Link href="/properties">
                  <Button variant="ghost" size="sm" className="text-xs">View Properties <ChevronRight className="w-3 h-3 ml-1" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Properties</p>
                  <p className="text-xl font-bold">{sfStats?.totalProperties ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Devices</p>
                  <p className="text-xl font-bold flex items-center justify-center gap-1">
                    <Wifi className="w-4 h-4 text-green-500" />
                    {sfStats?.totalDevices ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Offline</p>
                  <p className={`text-xl font-bold flex items-center justify-center gap-1 ${(sfStats?.devicesOffline ?? 0) > 0 ? "text-red-600" : ""}`}>
                    <WifiOff className="w-4 h-4" />
                    {sfStats?.devicesOffline ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Active Alerts</p>
                  <p className={`text-xl font-bold flex items-center justify-center gap-1 ${(sfStats?.unresolvedAlerts ?? 0) > 0 ? "text-amber-600" : ""}`}>
                    <Bell className="w-4 h-4" />
                    {sfStats?.unresolvedAlerts ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
