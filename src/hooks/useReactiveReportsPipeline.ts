import { useCallback, useEffect, useState } from 'react';
import {
  useCivicStore,
  useIsOfflineMode,
  useIsSyncingQueue,
  usePendingSyncCount,
  useReportsConnection,
} from '../store/useCivicStore';
import {
  reportSearch,
  type ReportSearchQuery,
} from '../services/reportSearch';
import {
  connectRealtimeReports,
  realtimeReportStream,
} from '../services/realtimeReports';
import { startBackgroundSyncWorker } from '../services/offlineSyncEngine';
import type {
  CivicReport,
  ReportCategoryFilter,
  SeverityFilter,
} from '../types/civic';

/**
 * Orchestrates the Milestone 3 reactive data pipeline:
 * 1. RxJS debounced search & multi-facet filter stream (debounceTime, distinctUntilChanged, switchMap)
 * 2. Real-time WebSocket / simulated incident ingestion
 * 3. Graceful offline fallback & background sync queue processing
 */
export function useReactiveReportsPipeline() {
  const reports = useCivicStore((state) => state.reports);
  const addReport = useCivicStore((state) => state.addReport);
  const enqueueOfflineReport = useCivicStore((state) => state.enqueueOfflineReport);
  const flushOfflineQueue = useCivicStore((state) => state.flushOfflineQueue);
  const setOfflineMode = useCivicStore((state) => state.setOfflineMode);
  const setReportsConnection = useCivicStore((state) => state.setReportsConnection);
  const markReportSynced = useCivicStore((state) => state.markReportSynced);
  const markReportSyncFailed = useCivicStore((state) => state.markReportSyncFailed);

  const reportsConnection = useReportsConnection();
  const isOfflineMode = useIsOfflineMode();
  const pendingSyncCount = usePendingSyncCount();
  const isSyncingQueue = useIsSyncingQueue();

  const [searchText, setSearchText] = useState<string>('');
  const [category, setCategory] = useState<ReportCategoryFilter>('ALL');
  const [severity, setSeverity] = useState<SeverityFilter>('ALL');
  const [filteredReports, setFilteredReports] = useState<CivicReport[]>(reports);

  // Feed current store reports into the RxJS BehaviorSubject
  useEffect(() => {
    reportSearch.publishReports(reports);
  }, [reports]);

  // Publish query changes into the RxJS pipeline (debounceTime -> distinctUntilChanged -> switchMap)
  useEffect(() => {
    const query: ReportSearchQuery = {
      text: searchText,
      category,
      severity,
    };
    reportSearch.publishQuery(query);
  }, [searchText, category, severity]);

  // Subscribe to filtered output from the RxJS pipeline
  useEffect(() => {
    return reportSearch.subscribe(setFilteredReports);
  }, []);

  // Connect real-time stream (WebSocket or simulated live fallback) with offline awareness
  useEffect(() => {
    return connectRealtimeReports(
      (incomingReport) => {
        if (useCivicStore.getState().isOfflineMode) {
          enqueueOfflineReport(incomingReport);
          return;
        }
        addReport(incomingReport);
      },
      (status) => setReportsConnection(status),
      {
        enableSimulationFallback: true,
        isOffline: () => useCivicStore.getState().isOfflineMode,
      },
    );
  }, [addReport, enqueueOfflineReport, setReportsConnection, isOfflineMode]);

  // Start background queue processor for graceful offline recovery
  useEffect(() => {
    return startBackgroundSyncWorker({
      getPendingQueue: () => useCivicStore.getState().pendingSyncQueue,
      isOfflineMode: () => useCivicStore.getState().isOfflineMode,
      getConnectionStatus: () => useCivicStore.getState().reportsConnection,
      onReportSynced: (reportId) => markReportSynced(reportId),
      onReportFailed: (reportId) => markReportSyncFailed(reportId),
    });
  }, [markReportSynced, markReportSyncFailed]);

  const toggleOfflineMode = useCallback(() => {
    const nextOffline = !useCivicStore.getState().isOfflineMode;
    setOfflineMode(nextOffline);
  }, [setOfflineMode]);

  const simulateIncomingReport = useCallback(() => {
    const simulated = realtimeReportStream.emitManualSimulation();
    if (useCivicStore.getState().isOfflineMode) {
      enqueueOfflineReport(simulated);
      return simulated;
    }
    addReport(simulated);
    return simulated;
  }, [addReport, enqueueOfflineReport]);

  return {
    searchText,
    setSearchText,
    category,
    setCategory,
    severity,
    setSeverity,
    filteredReports,
    reportsConnection,
    isOfflineMode,
    pendingSyncCount,
    isSyncingQueue,
    toggleOfflineMode,
    simulateIncomingReport,
    flushOfflineQueue,
  };
}
