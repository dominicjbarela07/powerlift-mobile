export type WeekReportSet = { id: number; text: string; effort: string | null };
export type WeekReportMovement = {
  name: string; equipment: string | null; sets: WeekReportSet[]; set_lines: string[];
  comparison: { kind: string; label: string; percent: number | null; prior_date: string | null; prior_set: string | null; prior_effort?: string | null };
};
export type TrainingWeekReport = {
  athlete_name: string; week_start: string; week_end: string; week_label: string; unit: 'lb' | 'kg';
  summary: { session_count: number; set_count: number; recorded_duration_seconds: number; duration_session_count: number };
  sessions: { id: number; date: string; title: string; duration_seconds: number | null; note: string; note_is_excerpt: boolean; set_count: number; movements: WeekReportMovement[] }[];
};
export type WeekReportExport = { ok: true; report: TrainingWeekReport; pdf_base64: string; page_count: number; filename: string };

export function reportWeekOf(value?: string, now = new Date()): string {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : now;
  const day = Number.isFinite(parsed.getTime()) ? new Date(parsed) : new Date(now);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
export function moveReportWeek(week: string, weeks: number): string {
  const date = new Date(`${week}T12:00:00`); date.setDate(date.getDate() + weeks * 7);
  return reportWeekOf(undefined, date);
}
export function reportWeekEnd(week: string): string {
  const date = new Date(`${week}T12:00:00`); date.setDate(date.getDate() + 6);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function reportDuration(seconds: number | null, recorded = true): string {
  if (!recorded || seconds === null) return 'Time not recorded';
  const minutes = Math.max(0, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

type PdfSharing = {
  available(): Promise<boolean>;
  write(base64: string, name: string): Promise<string>;
  share(uri: string): Promise<void>;
  remove(uri: string): Promise<void>;
};
export async function shareTrainingWeekPdf(value: WeekReportExport, ownerId: number, io: PdfSharing): Promise<void> {
  if (!value.pdf_base64.startsWith('JVBERi0') || !value.report.summary.session_count) throw new Error('Prepare a completed training week before sharing.');
  if (!await io.available()) throw new Error('PDF sharing is not available on this device.');
  const safeName = value.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  // Account-isolated temporary folder; the recipient sees a clean PDF name.
  const uri = await io.write(value.pdf_base64, `${ownerId}-${Date.now()}/${safeName}`);
  try { await io.share(uri); } finally { await io.remove(uri).catch(() => undefined); }
}
