import { fetchJson } from './api';
import { readAuthoringJournal, writeAuthoringJournal, clearAuthoringJournal } from './session-authoring-journal';
import { authoringFingerprint } from './session-authoring-command';
import { createClientEventId } from './session-timing-telemetry';

export function shiftPlanDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function planWeekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftPlanDate(date, -((weekday + 6) % 7));
}

export function planDateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

type PlanResult = { session_id?: number; routine_id?: number; date?: string; name?: string };
const pending = new Map<string, Promise<PlanResult>>();

export function savePlanChange(owner: string, athleteId: number, surface: 'plan' | 'routines', payload: Record<string, unknown>) {
  const body = { ...payload, athlete_id: athleteId };
  const intent = JSON.stringify([surface, body]);
  const identity = `plan:${owner}:${authoringFingerprint(intent)}`;
  const active = pending.get(identity);
  if (active) return active;
  const request = submit().finally(() => pending.delete(identity));
  pending.set(identity, request);
  return request;

  async function submit(): Promise<PlanResult> {
    const prior = await readAuthoringJournal<{ commandKey: string; intent: string }>(identity, owner);
    const commandKey = prior?.intent === intent ? prior.commandKey : createClientEventId('plan').slice(5).replaceAll('-', '');
    await writeAuthoringJournal(identity, owner, { commandKey, intent });
    const response = await fetchJson<PlanResult & { ok?: boolean; error?: string }>(`/workouts/mobile/self-coach/${surface}`, {
      method: 'POST',
      body: { ...body, command_key: commandKey } as any,
    });
    if (!response.ok || !response.json?.ok) {
      throw new Error(response.json?.error || 'Plan could not save this change. Try again.');
    }
    // A failed local cleanup must not make an acknowledged server write look unsaved.
    await clearAuthoringJournal(identity).catch(() => undefined);
    return response.json;
  }
}
