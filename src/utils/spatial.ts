import type { Coordinates, HazardZone } from '../types/civic';

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Haversine formula: returns the great-circle distance between two
 * geographic coordinates in meters. Uses WGS-84 mean Earth radius.
 *
 * Accuracy: sub-meter for distances under 100 km.
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates,
): number {
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);

  const halfChordSquared =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(deltaLon / 2) ** 2;

  const angularDistance =
    2 * Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared));

  return EARTH_RADIUS_METERS * angularDistance;
}

/**
 * Returns true when the user's position is inside (or on the boundary
 * of) the given hazard zone.
 */
export function isWithinHazardZone(
  userCoord: Coordinates,
  zone: HazardZone,
): boolean {
  const distance = calculateHaversineDistance(userCoord, zone.center);
  return distance <= zone.radiusMeters;
}
