import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  filter,
  interval,
  map,
} from 'rxjs';
import type {
  CivicReport,
  DisasterCategory,
  RealtimeConnectionStatus,
  RealtimeReportEvent,
  SeverityLevel,
} from '../types/civic';

type ReportListener = (report: CivicReport) => void;
type StatusListener = (status: RealtimeConnectionStatus) => void;

const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const SIMULATION_INTERVAL_MS = 18_000;
const DEFAULT_GPS_ACCURACY_METERS = 3.2;

interface SimulatedIncidentTemplate {
  title: string;
  category: DisasterCategory;
  severity: SeverityLevel;
  latitude: number;
  longitude: number;
}

const SIMULATED_MALANG_INCIDENTS: SimulatedIncidentTemplate[] = [
  {
    title: 'Genangan Air Underpass Karanglo',
    category: 'FLOOD',
    severity: 'HIGH',
    latitude: -7.9165,
    longitude: 112.6562,
  },
  {
    title: 'Jalan Ambles di Jl. Mayjen Panjaitan',
    category: 'ROAD_DAMAGE',
    severity: 'HIGH',
    latitude: -7.9518,
    longitude: 112.6194,
  },
  {
    title: 'Dahan Trembesi Patah di Jl. Bandung',
    category: 'FALLEN_TREE',
    severity: 'MEDIUM',
    latitude: -7.9612,
    longitude: 112.6254,
  },
  {
    title: 'Tebing Longsor Ringan Jalur Payung Batu',
    category: 'LANDSLIDE',
    severity: 'CRITICAL',
    latitude: -7.8689,
    longitude: 112.4951,
  },
];

const connectionStatus$ = new BehaviorSubject<RealtimeConnectionStatus>('offline');
const incomingReportEvents$ = new Subject<RealtimeReportEvent>();

/**
 * Validates whether an untrusted JSON payload conforms to the CivicReport schema.
 */
function isValidCivicReport(candidate: unknown): candidate is CivicReport {
  if (!candidate || typeof candidate !== 'object') return false;
  const record = candidate as Record<string, unknown>;
  const coordinates = record.coordinates as Record<string, unknown> | undefined;

  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.timestamp === 'number' &&
    Boolean(coordinates) &&
    typeof coordinates?.latitude === 'number' &&
    typeof coordinates?.longitude === 'number'
  );
}

/**
 * Parses an incoming WebSocket message frame into a CivicReport if valid.
 */
function parseSocketReportMessage(rawPayload: unknown): CivicReport | null {
  try {
    const parsed: unknown = JSON.parse(String(rawPayload));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('type' in parsed) ||
      parsed.type !== 'report' ||
      !('report' in parsed)
    ) {
      return null;
    }

    return isValidCivicReport(parsed.report) ? parsed.report : null;
  } catch {
    return null;
  }
}

/**
 * Creates a deterministic simulated civic report for real-time stream fallback.
 */
export function createSimulatedRealtimeReport(sequenceIndex: number): CivicReport {
  const template =
    SIMULATED_MALANG_INCIDENTS[sequenceIndex % SIMULATED_MALANG_INCIDENTS.length];
  const now = Date.now();
  const coordinateJitter = ((sequenceIndex % 5) - 2) * 0.0004;
  const coordinates = {
    latitude: Number((template.latitude + coordinateJitter).toFixed(6)),
    longitude: Number((template.longitude - coordinateJitter).toFixed(6)),
  };

  return {
    id: `sim-rpt-${now}-${sequenceIndex}`,
    title: template.title,
    category: template.category,
    severity: template.severity,
    coordinates,
    timestamp: now,
    photoUri: null,
    syncStatus: 'SYNCED',
    watermarkMetadata: {
      capturedAt: new Date(now).toISOString(),
      gpsAccuracy: DEFAULT_GPS_ACCURACY_METERS,
      coordinates,
    },
  };
}

/**
 * Starts an RxJS interval stream that emits simulated real-time civic incidents
 * when no external WebSocket URL is configured and offline mode is inactive.
 */
function startSimulatedRealtimeFeed(
  onReport: ReportListener,
  onStatus: StatusListener,
  isOfflineCheck: () => boolean,
): () => void {
  onStatus(isOfflineCheck() ? 'offline' : 'simulated');
  connectionStatus$.next(isOfflineCheck() ? 'offline' : 'simulated');

  const subscription: Subscription = interval(SIMULATION_INTERVAL_MS)
    .pipe(
      filter(() => !isOfflineCheck()),
      map((tick) => createSimulatedRealtimeReport(tick)),
    )
    .subscribe((simulatedReport) => {
      onStatus('simulated');
      connectionStatus$.next('simulated');
      incomingReportEvents$.next({
        type: 'report',
        report: simulatedReport,
        source: 'simulation',
        receivedAt: Date.now(),
      });
      onReport(simulatedReport);
    });

  return () => {
    subscription.unsubscribe();
  };
}

export interface RealtimeConnectionOptions {
  enableSimulationFallback?: boolean;
  isOffline?: () => boolean;
}

/**
 * Connects to the real-time civic report feed via WebSocket with exponential backoff,
 * or gracefully falls back to an RxJS simulated live stream when unconfigured.
 */
export function connectRealtimeReports(
  onReport: ReportListener,
  onStatus: StatusListener,
  options: RealtimeConnectionOptions = {},
): () => void {
  const wsUrl = process.env.EXPO_PUBLIC_CIVIC_WS_URL;
  const enableSimulation = options.enableSimulationFallback ?? true;
  const isOfflineCheck = options.isOffline ?? (() => false);

  if (isOfflineCheck()) {
    onStatus('offline');
    connectionStatus$.next('offline');
    return () => undefined;
  }

  if (!wsUrl) {
    if (enableSimulation) {
      return startSimulatedRealtimeFeed(onReport, onStatus, isOfflineCheck);
    }
    onStatus('offline');
    connectionStatus$.next('offline');
    return () => undefined;
  }

  let isConnectionActive = true;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let currentRetryDelayMs = INITIAL_RETRY_DELAY_MS;

  const updateStatus = (nextStatus: RealtimeConnectionStatus) => {
    connectionStatus$.next(nextStatus);
    onStatus(nextStatus);
  };

  const scheduleReconnect = () => {
    if (!isConnectionActive) return;
    updateStatus('offline');
    retryTimer = setTimeout(openSocketConnection, currentRetryDelayMs);
    currentRetryDelayMs = Math.min(
      currentRetryDelayMs * BACKOFF_MULTIPLIER,
      MAX_RETRY_DELAY_MS,
    );
  };

  const openSocketConnection = () => {
    if (!isConnectionActive) return;
    if (isOfflineCheck()) {
      updateStatus('offline');
      return;
    }

    updateStatus('connecting');

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        currentRetryDelayMs = INITIAL_RETRY_DELAY_MS;
        updateStatus('live');
      };

      socket.onmessage = (event) => {
        const report = parseSocketReportMessage(event.data);
        if (!report) return;

        incomingReportEvents$.next({
          type: 'report',
          report,
          source: 'websocket',
          receivedAt: Date.now(),
        });
        onReport(report);
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  };

  openSocketConnection();

  return () => {
    isConnectionActive = false;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}

export const realtimeReportStream = {
  events$: incomingReportEvents$.asObservable() as Observable<RealtimeReportEvent>,
  status$: connectionStatus$.asObservable() as Observable<RealtimeConnectionStatus>,
  emitManualSimulation(sequenceIndex: number = Date.now()): CivicReport {
    const report = createSimulatedRealtimeReport(sequenceIndex);
    incomingReportEvents$.next({
      type: 'report',
      report,
      source: 'simulation',
      receivedAt: Date.now(),
    });
    return report;
  },
};
