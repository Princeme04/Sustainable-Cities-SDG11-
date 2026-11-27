/**
 * Domain models for CivicPulse SDG-11.
 * Pure data contracts with zero framework dependencies.
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

export type ReportCategoryFilter = 'ALL' | DisasterCategory;

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SeverityFilter = 'ALL' | SeverityLevel;

export type RiskLevel = 'MODERATE' | 'HIGH' | 'EXTREME';

export type PermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'restricted';

export type SyncStatus = 'SYNCED' | 'PENDING_UPLOAD' | 'FAILED';

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'live'
  | 'simulated'
  | 'offline';

export interface WatermarkMetadata {
  capturedAt: string;
  gpsAccuracy: number | null;
  coordinates: Coordinates;
}

export interface CivicReport {
  id: string;
  title: string;
  category: DisasterCategory;
  severity: SeverityLevel;
  coordinates: Coordinates;
  timestamp: number;
  photoUri: string | null;
  syncStatus: SyncStatus;
  localVaultUri?: string;
  watermarkMetadata: WatermarkMetadata;
}

export interface HazardZone {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  riskLevel: RiskLevel;
}

export interface ReporterIdentity {
  reporterId: string;
  fullName: string;
  nikMasked: string;
  authToken: string;
  verifiedAt: string;
}

export interface RealtimeReportEvent {
  type: 'report' | 'heartbeat';
  report?: CivicReport;
  source: 'websocket' | 'simulation' | 'offline_cache';
  receivedAt: number;
}

export interface SyncBatchSummary {
  syncedIds: string[];
  failedIds: string[];
  remainingCount: number;
  completedAt: number;
}
