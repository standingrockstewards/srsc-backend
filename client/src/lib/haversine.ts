/**
 * src/lib/haversine.ts
 * Haversine distance between two WGS-84 coordinate pairs.
 * Returns distance in miles.
 */

const R_MILES = 3_958.8; // Earth radius in miles

export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R_MILES * 2 * Math.asin(Math.sqrt(a));
}
