import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList } from "lucide-react";
import type { Visit, Property } from "../../../../shared/schema";

export default function TechVisitList() {
  const { user } = useAuth();

  const { data: visits, isLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits", "tech-all", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits?techId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties", "tech", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties?techId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const propertyMap = Object.fromEntries((properties ?? []).map(p => [p.id, p]));

  return (
    <AppLayout title="My Visits">
      <div className="p-4 max-w-2xl mx-auto space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : !(visits ?? []).length ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No visits submitted yet</p>
          </div>
        ) : (
          (visits ?? []).map(visit => {
            const prop = propertyMap[visit.propertyId];
            return (
              <Link key={visit.id} href={`/visits/${visit.id}`}>
                <Card className="cursor-pointer hover:shadow-sm transition-shadow" data-testid={`card-visit-${visit.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{prop?.nickname ?? "Unknown Property"}</p>
                        <p className="text-xs text-muted-foreground">
                          {visit.visitDate} · <span className="capitalize">{visit.visitType?.replace(/_/g, " ")}</span>
                          {visit.durationMinutes ? ` · ${visit.durationMinutes} min` : ""}
                        </p>
                      </div>
                      <StatusBadge status={visit.overallStatus ?? visit.status} />
                    </div>
                    {visit.generalNotes && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{visit.generalNotes}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
