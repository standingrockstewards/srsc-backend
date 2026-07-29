/**
 * src/pages/DashboardPage.tsx  (Brick 10b)
 *
 * Shows MapView populated with the authenticated user's properties.
 * Admin/supervisor: all properties. Client: their own properties.
 * field_tech / vendor: properties endpoint responds per their role — fetched same way.
 *
 * Property IDs are text (string). Money stays string. No integer parsing on IDs.
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { MapView } from "@/components/MapView";
import type { Property } from "@/types";

export function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    api.get<Property[]>("/properties")
      .then((rows) => {
        setProperties(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? `Failed to load properties: ${err.message}`
            : "Failed to load properties.",
        );
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {loading
            ? "Loading properties…"
            : error
            ? "Could not load property data."
            : `${properties.length} propert${properties.length === 1 ? "y" : "ies"} monitored`}
        </p>
      </div>

      <MapView
        properties={properties}
        loading={loading}
        error={error}
      />
    </div>
  );
}
