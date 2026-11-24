import type { CivicReport } from '../types/civic';

type Listener = (report: CivicReport) => void;
type StatusListener = (status: 'connecting' | 'live' | 'offline') => void;

/** Optional WebSocket feed. Expected messages: { type: 'report', report: CivicReport }. */
export function connectRealtimeReports(
  onReport: Listener,
  onStatus: StatusListener,
): () => void {
  const url = process.env.EXPO_PUBLIC_CIVIC_WS_URL;
  if (!url) {
    onStatus('offline');
    return () => undefined;
  }

  let active = true;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1_000;

  const connect = () => {
    if (!active) return;
    onStatus('connecting');
    try {
      socket = new WebSocket(url);
      socket.onopen = () => {
        retryDelay = 1_000;
        onStatus('live');
      };
      socket.onmessage = (event) => {
        try {
          const message: unknown = JSON.parse(String(event.data));
          if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'report' || !('report' in message)) return;
          const report = message.report as CivicReport;
          if (typeof report.id === 'string' && typeof report.title === 'string' && report.coordinates && typeof report.timestamp === 'number') onReport(report);
        } catch {
          // Ignore malformed messages while keeping the live connection available.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!active) return;
        onStatus('offline');
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    } catch {
      onStatus('offline');
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }
  };

  connect();
  return () => {
    active = false;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
