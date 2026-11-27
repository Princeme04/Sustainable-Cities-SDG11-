import { create } from 'zustand';
import type {
  CivicReport,
  Coordinates,
  HazardZone,
  PermissionStatus,
  RealtimeConnectionStatus,
  ReporterIdentity,
  SyncBatchSummary,
} from '../types/civic';
import {
  getReporterIdentity,
  saveReporterCredentials,
  clearSecurityVault,
} from '../services/security/secureVaultService';
import {
  flushPendingSyncQueue,
  offlineSyncEngine,
  persistReportToOfflineCache,
} from '../services/offlineSyncEngine';

const ONE_HOUR_MS = 3_600_000;
const TWO_HOURS_MS = 7_200_000;
const THREE_HOURS_MS = 10_800_000;
const HALF_HOUR_MS = 1_800_000;
const NINETY_MINUTES_MS = 5_400_000;

// Realistic mock reports around Malang, East Java, Indonesia
const MOCK_REPORTS: CivicReport[] = [
  {
    id: 'rpt-001',
    title: 'Jl. Ijen Flooding After Heavy Rain',
    category: 'FLOOD',
    severity: 'HIGH',
    coordinates: { latitude: -7.9725, longitude: 112.6311 },
    timestamp: Date.now() - ONE_HOUR_MS,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(Date.now() - ONE_HOUR_MS).toISOString(),
      gpsAccuracy: 3.5,
      coordinates: { latitude: -7.9725, longitude: 112.6311 },
    },
  },
  {
    id: 'rpt-002',
    title: 'Pothole on Jl. Soekarno-Hatta',
    category: 'ROAD_DAMAGE',
    severity: 'MEDIUM',
    coordinates: { latitude: -7.9455, longitude: 112.6155 },
    timestamp: Date.now() - TWO_HOURS_MS,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(Date.now() - TWO_HOURS_MS).toISOString(),
      gpsAccuracy: 4.1,
      coordinates: { latitude: -7.9455, longitude: 112.6155 },
    },
  },
  {
    id: 'rpt-003',
    title: 'Fallen Banyan Tree near Alun-Alun Malang',
    category: 'FALLEN_TREE',
    severity: 'CRITICAL',
    coordinates: { latitude: -7.9784, longitude: 112.6320 },
    timestamp: Date.now() - HALF_HOUR_MS,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(Date.now() - HALF_HOUR_MS).toISOString(),
      gpsAccuracy: 2.8,
      coordinates: { latitude: -7.9784, longitude: 112.6320 },
    },
  },
  {
    id: 'rpt-004',
    title: 'Minor Landslide at Batu Hillside',
    category: 'LANDSLIDE',
    severity: 'HIGH',
    coordinates: { latitude: -7.8830, longitude: 112.5260 },
    timestamp: Date.now() - THREE_HOURS_MS,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(Date.now() - THREE_HOURS_MS).toISOString(),
      gpsAccuracy: 5.0,
      coordinates: { latitude: -7.8830, longitude: 112.5260 },
    },
  },
  {
    id: 'rpt-005',
    title: 'Road Crack on Jl. Veteran',
    category: 'ROAD_DAMAGE',
    severity: 'LOW',
    coordinates: { latitude: -7.9636, longitude: 112.6150 },
    timestamp: Date.now() - NINETY_MINUTES_MS,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(Date.now() - NINETY_MINUTES_MS).toISOString(),
      gpsAccuracy: 3.9,
      coordinates: { latitude: -7.9636, longitude: 112.6150 },
    },
  },
];

const MOCK_HAZARD_ZONES: HazardZone[] = [
  {
    id: 'hz-001',
    name: 'Brantas River Flood Plain',
    center: { latitude: -7.9700, longitude: 112.6350 },
    radiusMeters: 500,
    riskLevel: 'HIGH',
  },
  {
    id: 'hz-002',
    name: 'Batu Landslide Corridor',
    center: { latitude: -7.8830, longitude: 112.5260 },
    radiusMeters: 750,
    riskLevel: 'EXTREME',
  },
];

interface CivicState {
  userLocation: Coordinates | null;
  locationPermissionStatus: PermissionStatus;
  reports: CivicReport[];
  reportsConnection: RealtimeConnectionStatus;
  hazardZones: HazardZone[];
  reporterIdentity: ReporterIdentity | null;
  isVaultUnlocked: boolean;
  isOfflineMode: boolean;
  isSyncingQueue: boolean;
  lastSyncedAt: number | null;
  pendingSyncQueue: CivicReport[];
}

interface CivicActions {
  setUserLocation: (location: Coordinates) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  addReport: (report: CivicReport) => void;
  hydrateIdentityFromVault: () => Promise<void>;
  registerReporterSession: (identity: ReporterIdentity, rawNik: string) => Promise<void>;
  logoutAndPurgeVault: () => Promise<void>;
  enqueueOfflineReport: (report: CivicReport) => void;
  markReportSynced: (reportId: string) => void;
  markReportSyncFailed: (reportId: string) => void;
  flushOfflineQueue: () => Promise<SyncBatchSummary>;
  setOfflineMode: (status: boolean) => void;
  setReportsConnection: (status: RealtimeConnectionStatus) => void;
}

export type CivicStore = CivicState & CivicActions;

export const useCivicStore = create<CivicStore>((set, get) => ({
  userLocation: null,
  locationPermissionStatus: 'undetermined',
  reports: MOCK_REPORTS,
  reportsConnection: 'offline',
  hazardZones: MOCK_HAZARD_ZONES,
  reporterIdentity: null,
  isVaultUnlocked: false,
  isOfflineMode: false,
  isSyncingQueue: false,
  lastSyncedAt: null,
  pendingSyncQueue: [],

  setUserLocation: (location) =>
    set({ userLocation: location }),

  setPermissionStatus: (status) =>
    set({ locationPermissionStatus: status }),

  addReport: (report) =>
    set((state) => ({
      reports: [...state.reports.filter((item) => item.id !== report.id), report],
    })),

  hydrateIdentityFromVault: async () => {
    try {
      const identity = await getReporterIdentity();
      set({
        reporterIdentity: identity,
        isVaultUnlocked: identity !== null,
      });
    } catch {
      set({
        reporterIdentity: null,
        isVaultUnlocked: false,
      });
    }
  },

  registerReporterSession: async (identity, rawNik) => {
    await saveReporterCredentials(identity, rawNik);
    set({
      reporterIdentity: identity,
      isVaultUnlocked: true,
    });
  },

  logoutAndPurgeVault: async () => {
    await clearSecurityVault();
    set({
      reporterIdentity: null,
      isVaultUnlocked: false,
    });
  },

  enqueueOfflineReport: (report) => {
    const offlineReport: CivicReport = {
      ...report,
      syncStatus: 'PENDING_UPLOAD',
    };
    void persistReportToOfflineCache(offlineReport);
    set((state) => ({
      reports: [
        ...state.reports.filter((item) => item.id !== offlineReport.id),
        offlineReport,
      ],
      pendingSyncQueue: [
        ...state.pendingSyncQueue.filter((item) => item.id !== offlineReport.id),
        offlineReport,
      ],
    }));

    if (!get().isOfflineMode && get().reportsConnection !== 'offline') {
      offlineSyncEngine.requestSyncFlush();
    }
  },

  markReportSynced: (reportId) =>
    set((state) => ({
      reports: state.reports.map((report) =>
        report.id === reportId ? { ...report, syncStatus: 'SYNCED' } : report,
      ),
      pendingSyncQueue: state.pendingSyncQueue.filter(
        (report) => report.id !== reportId,
      ),
      lastSyncedAt: Date.now(),
    })),

  markReportSyncFailed: (reportId) =>
    set((state) => ({
      reports: state.reports.map((report) =>
        report.id === reportId ? { ...report, syncStatus: 'FAILED' } : report,
      ),
    })),

  flushOfflineQueue: async () => {
    set({ isSyncingQueue: true });
    try {
      const summary = await flushPendingSyncQueue({
        getPendingQueue: () => get().pendingSyncQueue,
        isOfflineMode: () => get().isOfflineMode,
        getConnectionStatus: () => get().reportsConnection,
        onReportSynced: (reportId) => get().markReportSynced(reportId),
        onReportFailed: (reportId) => get().markReportSyncFailed(reportId),
      });
      return summary;
    } finally {
      set({ isSyncingQueue: false });
    }
  },

  setOfflineMode: (status) => {
    set({
      isOfflineMode: status,
      reportsConnection: status ? 'offline' : get().reportsConnection,
    });
    if (!status) {
      offlineSyncEngine.requestSyncFlush();
    }
  },

  setReportsConnection: (status) => {
    set({ reportsConnection: status });
    if (status === 'live' || status === 'simulated') {
      offlineSyncEngine.requestSyncFlush();
    }
  },
}));

// Precision selectors to prevent unnecessary component re-renders (16ms Mandate)
export const usePendingSyncCount = () =>
  useCivicStore((state) => state.pendingSyncQueue.length);

export const useIsSyncingQueue = () =>
  useCivicStore((state) => state.isSyncingQueue);

export const useLastSyncedAt = () =>
  useCivicStore((state) => state.lastSyncedAt);

export const useReportsConnection = () =>
  useCivicStore((state) => state.reportsConnection);

export const useReporterIdentity = () =>
  useCivicStore((state) => state.reporterIdentity);

export const useIsVaultUnlocked = () =>
  useCivicStore((state) => state.isVaultUnlocked);

export const useIsOfflineMode = () =>
  useCivicStore((state) => state.isOfflineMode);

export const useOfflineReports = () =>
  useCivicStore((state) => state.pendingSyncQueue);

export const useUserLocation = () =>
  useCivicStore((state) => state.userLocation);

export const useLocationPermissionStatus = () =>
  useCivicStore((state) => state.locationPermissionStatus);

export const useCivicReports = () =>
  useCivicStore((state) => state.reports);

export const useHazardZones = () =>
  useCivicStore((state) => state.hazardZones);
