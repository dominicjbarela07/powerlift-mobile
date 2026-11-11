import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchJson } from './api';

type ReuseInput = { owner: string; workoutId: number; action: 'repeat' | 'save_routine' | 'start_empty'; name?: string };
const pendingWorkoutReuse = new Map<string, ReturnType<typeof performWorkoutReuse>>();

/** Concurrent taps share the same durable operation. */
export async function reuseSelfCoachWorkout(input: ReuseInput) {
  const key = JSON.stringify([input.owner, input.workoutId, input.action, input.name]);
  const running = pendingWorkoutReuse.get(key);
  if (running) return running;
  const request = performWorkoutReuse(input);
  pendingWorkoutReuse.set(key, request);
  try { return await request; }
  finally { pendingWorkoutReuse.delete(key); }
}

/** An uncertain response retains the same request identity across a relaunch. */
async function performWorkoutReuse({ owner, workoutId, action, name }: ReuseInput) {
  if (!owner || !Number.isInteger(workoutId) || workoutId <= 0) throw new Error('Reopen your session before continuing.');
  const storageKey = `strength-ledger:workout-reuse:${owner}:${workoutId}:${action}`;
  const saved = await AsyncStorage.getItem(storageKey);
  let command: { command_key: string; action: string; name?: string } | null = null;
  try { command = saved ? JSON.parse(saved) : null; } catch { command = null; }
  if (!command || command.action !== action || command.name !== name || typeof command.command_key !== 'string'
    || command.command_key.length < 12 || command.command_key.length > 64) {
    command = { command_key: `workout-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`, action,
      ...(name ? { name } : {}) };
    await AsyncStorage.setItem(storageKey, JSON.stringify(command));
  }
  const response = await fetchJson<any>(`/workouts/mobile/${workoutId}/reuse`, { method: 'POST', body: command as any });
  if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Could not reuse this session. Try again.');
  await AsyncStorage.removeItem(storageKey);
  return response.json as { workout_id?: number; routine_id?: number; name?: string; date?: string };
}
