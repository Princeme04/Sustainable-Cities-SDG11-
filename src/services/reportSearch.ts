import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs';
import type { CivicReport } from '../types/civic';

export interface ReportSearchQuery {
  text: string;
  category: string;
}

const querySubject = new Subject<ReportSearchQuery>();
const reportsSubject = new BehaviorSubject<CivicReport[]>([]);
const resultSubject = new BehaviorSubject<CivicReport[]>([]);

querySubject.pipe(
  debounceTime(250),
  distinctUntilChanged((a, b) => a.text === b.text && a.category === b.category),
  switchMap((query) => reportsSubject.pipe(
    map((reports) => {
      const normalized = query.text.trim().toLocaleLowerCase();
      return reports.filter((report) => {
        const matchesText = !normalized || `${report.title} ${report.category} ${report.severity}`.toLocaleLowerCase().includes(normalized);
        const matchesCategory = query.category === 'ALL' || report.category === query.category;
        return matchesText && matchesCategory;
      });
    }),
  )),
).subscribe(resultSubject);

export const reportSearch = {
  publishQuery(query: ReportSearchQuery): void {
    querySubject.next(query);
  },
  publishReports(reports: CivicReport[]): void {
    reportsSubject.next(reports);
  },
  subscribe(listener: (reports: CivicReport[]) => void): () => void {
    const subscription = resultSubject.subscribe(listener);
    return () => subscription.unsubscribe();
  },
};
