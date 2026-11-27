import { AppState, type AppStateStatus } from 'react-native';
import {
  BehaviorSubject,
  Subject,
  Subscription,
  concatMap,
  filter,
  from,
  of,
  timer,
} from 'rxjs';
import { offlineFiles, type OfflineReportDocument } from './offlineFiles';
import type {
  CivicReport,
  RealtimeConnectionStatus,
  SyncBatchSummary,
} from '../types/civic';

const SYNC_ITEM_DELAY_MS = 180;
const AUTO_FLUSH_DEBOUNCE_MS = 400;

export interface OfflineSyncHandlers {
  getPendingQueue: () => CivicReport[];
  isOfflineMode: () => boolean;
  getConnectionStatus: () => RealtimeConnectionStatus;
  onReportSynced: (reportId: string) => void;
  onReportFailed?: (reportId: string) => void;
  onBatchComplete?: (summary: SyncBatchSummary) => void;
}

const isSyncing$ = new BehaviorSubject<boolean>(false);
const lastSyncSummary$ = new BehaviorSubject<SyncBatchSummary | null>(null);
const flushTrigger$ = new Subject<void>();

/**
 * Converts a CivicReport into a persistent offline document record.
 */
function toOfflineDocument(report: CivicReport): OfflineReportDocument {
  return {
    id: report.id,
    title: report.title,
    createdAt: report.timestamp,
    mediaUri: report.localVaultUri ?? report.photoUri ?? undefined,
  };
}

/**
 * Persists a queued report to local file storage so offline data survives restarts.
 */
export async function persistReportToOfflineCache(
  report: CivicReport,
): Promise<void> {
  try {
    await offlineFiles.saveReport(toOfflineDocument(report));
  } catch {
    // Keep in-memory queue intact even if local filesystem write fails.
  }
}

/**
 * Flushes all pending offline reports sequentially once connectivity is available.
 */
export async function flushPendingSyncQueue(
  handlers: OfflineSyncHandlers,
): Promise<SyncBatchSummary> {
  const pendingReports = handlers.getPendingQueue();
  const isOffline =
    handlers.isOfflineMode() || handlers.getConnectionStatus() === 'offline';

  if (isOffline || pendingReports.length === 0 || isSyncing$.getValue()) {
    const skippedSummary: SyncBatchSummary = {
      syncedIds: [],
      failedIds: [],
      remainingCount: pendingReports.length,
      completedAt: Date.now(),
    };
    return skippedSummary;
  }

  isSyncing$.next(true);
  const syncedIds: string[] = [];
  const failedIds: string[] = [];

  try {
    for (const report of pendingReports) {
      if (handlers.isOfflineMode()) {
        failedIds.push(report.id);
        handlers.onReportFailed?.(report.id);
        continue;
      }

      await new Promise<void>((resolve) =>
        setTimeout(resolve, SYNC_ITEM_DELAY_MS),
      );
      await persistReportToOfflineCache(report);
      handlers.onReportSynced(report.id);
      syncedIds.push(report.id);
    }

    const summary: SyncBatchSummary = {
      syncedIds,
      failedIds,
      remainingCount: handlers.getPendingQueue().length,
      completedAt: Date.now(),
    };

    lastSyncSummary$.next(summary);
    handlers.onBatchComplete?.(summary);
    return summary;
  } finally {
    isSyncing$.next(false);
  }
}

/**
 * Starts an RxJS background queue processor that automatically flushes queued
 * offline reports when the app returns to foreground or reconnects.
 */
export function startBackgroundSyncWorker(
  handlers: OfflineSyncHandlers,
): () => void {
  const workerSubscription = new Subscription();

  const queueSub = flushTrigger$
    .pipe(
      filter(
        () =>
          !handlers.isOfflineMode() &&
          handlers.getConnectionStatus() !== 'offline' &&
          handlers.getPendingQueue().length > 0 &&
          !isSyncing$.getValue(),
      ),
      concatMap(() =>
        timer(AUTO_FLUSH_DEBOUNCE_MS).pipe(
          concatMap(() => from(flushPendingSyncQueue(handlers))),
        ),
      ),
    )
    .subscribe();

  workerSubscription.add(queueSub);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      flushTrigger$.next();
    }
  };

  const appStateListener = AppState.addEventListener(
    'change',
    handleAppStateChange,
  );

  return () => {
    workerSubscription.unsubscribe();
    appStateListener.remove();
  };
}

export const offlineSyncEngine = {
  isSyncing$: isSyncing$.asObservable(),
  lastSyncSummary$: lastSyncSummary$.asObservable(),
  requestSyncFlush(): void {
    flushTrigger$.next();
  },
  getIsSyncing(): boolean {
    return isSyncing$.getValue();
  },
  readCachedDrafts(): Promise<OfflineReportDocument[]> {
    return offlineFiles.readReports();
  },
  ofFallback<T>(fallbackValue: T) {
    return of(fallbackValue);
  },
};
