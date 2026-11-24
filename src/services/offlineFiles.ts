import { Directory, File, Paths } from 'expo-file-system';

const documentsDirectory = new Directory(Paths.document, 'civic-reports');
const metadataFile = new File(documentsDirectory, 'reports.json');

export interface OfflineReportDocument {
  id: string;
  title: string;
  createdAt: number;
  mediaUri?: string;
}

async function ensureDirectory(): Promise<void> {
  if (!documentsDirectory.exists) documentsDirectory.create({ idempotent: true, intermediates: true });
}

/** Persists non-secret report drafts and media in the app's private Documents sandbox. */
export const offlineFiles = {
  async readReports(): Promise<OfflineReportDocument[]> {
    await ensureDirectory();
    if (!metadataFile.exists) return [];
    try {
      const parsed: unknown = JSON.parse(await metadataFile.text());
      return Array.isArray(parsed) ? (parsed as OfflineReportDocument[]) : [];
    } catch {
      return [];
    }
  },

  async saveReport(report: OfflineReportDocument): Promise<void> {
    const existing = await this.readReports();
    const next = [...existing.filter((item) => item.id !== report.id), report];
    await metadataFile.write(JSON.stringify(next));
  },

  async importMedia(sourceUri: string, fileName: string): Promise<string> {
    await ensureDirectory();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destination = new File(documentsDirectory, `${Date.now()}-${safeName}`);
    await new File(sourceUri).copy(destination);
    return destination.uri;
  },
};
