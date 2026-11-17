/**
 * Domain models for CivicPulse SDG-11.
 * Pure data contracts with no framework dependencies.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type DisasterCategory =
  | 'FLOOD'
  | 'ROAD_DAMAGE'
  | 'FALLEN_TREE'
  | 'LANDSLIDE';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskLevel = 'MODERATE' | 'HIGH' | 'EXTREME';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'restricted';

export interface CivicReport {
  id: string;
  title: string;
  category: DisasterCategory;
  severity: SeverityLevel;
  coordinates: Coordinates;
  timestamp: number;
  photoUri: string | null;
}

export interface HazardZone {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  riskLevel: RiskLevel;
}
