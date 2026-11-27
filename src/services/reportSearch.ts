import {
  BehaviorSubject,
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import type {
  CivicReport,
  ReportCategoryFilter,
  SeverityFilter,
} from '../types/civic';

const SEARCH_DEBOUNCE_MS = 250;
const REPLAY_BUFFER_SIZE = 1;

export interface ReportSearchQuery {
  text: string;
  category: string;
  severity?: SeverityFilter;
  onlyPendingSync?: boolean;
}

const DEFAULT_SEARCH_QUERY: ReportSearchQuery = {
  text: '',
  category: 'ALL',
  severity: 'ALL',
  onlyPendingSync: false,
};

const querySubject = new BehaviorSubject<ReportSearchQuery>(DEFAULT_SEARCH_QUERY);
const reportsSubject = new BehaviorSubject<CivicReport[]>([]);
const resultSubject = new BehaviorSubject<CivicReport[]>([]);

/**
 * Normalizes user search text for case-insensitive matching.
 */
function normalizeSearchText(rawText: string): string {
  return rawText.trim().toLocaleLowerCase();
}

/**
 * Compares two search queries to prevent redundant pipeline evaluations.
 */
function areQueriesEqual(
  previous: ReportSearchQuery,
  next: ReportSearchQuery,
): boolean {
  return (
    normalizeSearchText(previous.text) === normalizeSearchText(next.text) &&
    previous.category === next.category &&
    (previous.severity ?? 'ALL') === (next.severity ?? 'ALL') &&
    Boolean(previous.onlyPendingSync) === Boolean(next.onlyPendingSync)
  );
}

/**
 * Evaluates whether a single report matches the active search criteria.
 */
function matchesSearchQuery(
  report: CivicReport,
  query: ReportSearchQuery,
  normalizedText: string,
): boolean {
  const searchableContent =
    `${report.title} ${report.category} ${report.severity}`.toLocaleLowerCase();
  const matchesText =
    normalizedText.length === 0 || searchableContent.includes(normalizedText);
  const matchesCategory =
    query.category === 'ALL' || report.category === query.category;
  const activeSeverity = query.severity ?? 'ALL';
  const matchesSeverity =
    activeSeverity === 'ALL' || report.severity === activeSeverity;
  const matchesSyncFilter =
    !query.onlyPendingSync || report.syncStatus !== 'SYNCED';

  return (
    matchesText && matchesCategory && matchesSeverity && matchesSyncFilter
  );
}

/**
 * Filters a list of civic reports against a search query, sorted newest first.
 */
export function filterReportsByQuery(
  reports: CivicReport[],
  query: ReportSearchQuery,
): CivicReport[] {
  const normalizedText = normalizeSearchText(query.text);
  return reports
    .filter((report) => matchesSearchQuery(report, query, normalizedText))
    .sort((first, second) => second.timestamp - first.timestamp);
}

/**
 * Creates a standalone RxJS search pipeline (debounceTime -> distinctUntilChanged -> switchMap)
 * for reactive filtering over an observable report stream.
 */
export function createReportSearchPipeline(
  query$: Observable<ReportSearchQuery>,
  reports$: Observable<CivicReport[]>,
  debounceDurationMs: number = SEARCH_DEBOUNCE_MS,
): Observable<CivicReport[]> {
  return query$.pipe(
    debounceTime(debounceDurationMs),
    distinctUntilChanged(areQueriesEqual),
    // switchMap cancels stale inner subscriptions whenever a newer query arrives
    switchMap((activeQuery) =>
      reports$.pipe(
        map((currentReports) =>
          filterReportsByQuery(currentReports, activeQuery),
        ),
        catchError(() => of<CivicReport[]>([])),
      ),
    ),
    shareReplay({ bufferSize: REPLAY_BUFFER_SIZE, refCount: true }),
  );
}

const activeSearchPipeline$ = createReportSearchPipeline(
  querySubject.asObservable(),
  reportsSubject.asObservable(),
);

activeSearchPipeline$.subscribe((filteredReports) => {
  resultSubject.next(filteredReports);
});

export const reportSearch = {
  publishQuery(query: ReportSearchQuery): void {
    querySubject.next({
      ...DEFAULT_SEARCH_QUERY,
      ...query,
    });
  },

  publishCategory(category: ReportCategoryFilter): void {
    querySubject.next({
      ...querySubject.getValue(),
      category,
    });
  },

  publishSeverity(severity: SeverityFilter): void {
    querySubject.next({
      ...querySubject.getValue(),
      severity,
    });
  },

  publishReports(reports: CivicReport[]): void {
    reportsSubject.next(reports);
  },

  resetQuery(): void {
    querySubject.next(DEFAULT_SEARCH_QUERY);
  },

  getCurrentQuery(): ReportSearchQuery {
    return querySubject.getValue();
  },

  getCurrentResults(): CivicReport[] {
    return resultSubject.getValue();
  },

  asObservable(): Observable<CivicReport[]> {
    return resultSubject.asObservable();
  },

  subscribe(listener: (reports: CivicReport[]) => void): () => void {
    const subscription = resultSubject.subscribe(listener);
    return () => subscription.unsubscribe();
  },
};
