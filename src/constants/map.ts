import type { Coordinates } from '../types/civic';

/**
 * Fallback center for the map when GPS is unavailable.
 * Alun-Alun Kota Malang, East Java, Indonesia.
 */
export const MALANG_CENTER: Coordinates = {
  latitude: -7.9666,
  longitude: 112.6326,
};

export const MAP_DEFAULT_DELTA = 0.035;
