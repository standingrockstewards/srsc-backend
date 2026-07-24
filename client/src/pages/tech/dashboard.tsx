import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, TierBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, ClipboardList, MapPin, Play, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Property, Visit, ScheduledVisit } from "../../../../shared/schema";
import { CompleteVisitModal, type ScheduledVisitSummary } from "@/components/complete-visit-modal";

export default function TechDashboard() {
  const { user } = useAuth();
  const [completeTarget, setCompleteTarget] = useState<ScheduledVisitSummary | null>(null);

  const { data: properties, isLoading: propsLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties", "tech", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties?techId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: myVisits } = useQuery<Visit[]>({
    queryKey: ["/api/visits", "tech", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits?techId=${user?.id}&recent=5`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: scheduled, refetch: refetchScheduled } = useQuery<ScheduledVisit[]>({
    queryKey: ["/api/scheduled", "tech", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduled?techId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const today = new Date().toISOString().split('T')[0];
  const todayVisits = (scheduled ?? []).filter(s => s.scheduledDate === today);
  const upcomingVisits = (scheduled ?? []).filter(s => s.scheduledDate > today);

  const propertyMap = Object.fromEntries((properties ?? []).map(p => [p.id, p]));

  function openCompleteModal(sv: ScheduledVisit) {
    const prop = propertyMap[sv.propertyId];
    setCompleteTarget({
      id: sv.id,
      propertyId: sv.propertyId,
      propertyName: prop?.nickname ?? "Unknown Property",
      scheduledDate: sv.scheduledDate,
      scheduledTime: sv.scheduledTime ?? undefined,
      visitType: sv.visitType,
    });
  }

  return (
    <AppLayout
      title={`Good morning, ${user?.name?.split(" ")[0] ?? ""}!`}
      subtitle={`${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
    >
      <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 max-w-6xl mx-auto">
        {/* Today's visits — spans 2 cols on desktop */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Today's Visits</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">{today}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!todayVisits.length ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No visits scheduled for today
              </div>
            ) : (
              <div className="divide-y">
                {todayVisits.map(sv => {
                  const prop = propertyMap[sv.propertyId];
                  return (
                    <div key={sv.id} className="px-4 py-3 flex items-start justify-between gap-3" data-testid={`row-scheduled-${sv.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{prop?.nickname ?? "Unknown Property"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sv.scheduledTime ?? "All day"} · {sv.visitType?.replace(/_/g, " ")}
                        </p>
                        {prop?.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{prop.address}, {prop.city}
                          </p>
                        )}
                        {sv.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">{sv.notes}</p>
                        )}
                      </div>
                      {/* Two actions: Start full form OR Quick Complete */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Link href={`/visit/new/${sv.propertyId}`}>
                          <Button size="sm" variant="outline" className="w-full text-xs" data-testid={`button-start-visit-${sv.propertyId}`}>
                            <Play className="w-3 h-3 mr-1" /> Full Report
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="w-full text-xs font-semibold"
                          style={{ background: "#C05A43", color: "#fff", border: "none" }}
                          onClick={() => openCompleteModal(sv)}
                          data-testid={`button-complete-visit-${sv.id}`}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Properties — right column on desktop */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">My Assigned Properties</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {propsLoading ? (
              <div className="p-4 space-y-2">
                {[1,2].map(i => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
              </div>
            ) : !(properties ?? []).length ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">No properties assigned</div>
            ) : (
              <div className="divide-y">
                {(properties ?? []).map(prop => (
                  <Link key={prop.id} href={`/visit/new/${prop.id}`}>
                    <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors" data-testid={`row-property-${prop.id}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{prop.nickname}</p>
                        <p className="text-xs text-muted-foreground truncate">{prop.ownerName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TierBadge tier={prop.serviceTier} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Visits + Upcoming — share the 2-col bottom row on desktop */}
        {!!(myVisits ?? []).length && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm">My Recent Visits</CardTitle>
                </div>
                <Link href="/visits">
                  <Button variant="ghost" size="sm" className="text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(myVisits ?? []).slice(0, 5).map(visit => {
                  const prop = propertyMap[visit.propertyId];
                  return (
                    <div key={visit.id} className="px-4 py-3 flex items-center justify-between" data-testid={`row-visit-${visit.id}`}>
                      <div>
                        <p className="text-sm font-medium">{prop?.nickname ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{visit.visitDate}</p>
                      </div>
                      <StatusBadge status={visit.overallStatus ?? visit.status} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming */}
        {!!upcomingVisits.length && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Upcoming Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {upcomingVisits.slice(0, 4).map(sv => {
                  const prop = propertyMap[sv.propertyId];
                  return (
                    <div key={sv.id} className="px-4 py-3 flex items-center justify-between" data-testid={`row-upcoming-${sv.id}`}>
                      <div>
                        <p className="text-sm font-medium">{prop?.nickname ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{sv.scheduledDate} · {sv.scheduledTime ?? "Time TBD"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => openCompleteModal(sv)}
                        data-testid={`button-complete-upcoming-${sv.id}`}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Complete Visit Modal */}
      {completeTarget && (
        <CompleteVisitModal
          visit={completeTarget}
          techId={user?.id ?? 0}
          onClose={() => {
            setCompleteTarget(null);
            refetchScheduled();
          }}
        />
      )}
    </AppLayout>
  );
}
