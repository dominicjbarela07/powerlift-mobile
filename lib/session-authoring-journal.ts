import * as SecureStore from 'expo-secure-store';
import { authoringFingerprint } from './session-authoring-command';

const INDEX = 'sl.authoring.journals.v1';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
type Manifest = { scope: string; generation: string; chunks: number };
let queue: Promise<unknown> = Promise.resolve();
let epoch = 0;
// Only a freshly authorized Session read grants recovery access. Logout revokes
// leases synchronously, including delayed writes from an unmounting editor.
const leases = new Map<string, string>();
const storageKey = (identity: string) => `sl.authoring.${authoringFingerprint(identity)}`;
const serial = <T,>(action: () => Promise<T>): Promise<T> => {
  const result = queue.then(action, action);
  queue = result.catch(() => undefined);
  return result;
};
async function manifest(key: string): Promise<Manifest | null> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  const parsed = JSON.parse(value);
  return typeof parsed.scope === 'string' && typeof parsed.generation === 'string' && Number.isInteger(parsed.chunks) && parsed.chunks > 0 && parsed.chunks <= 512 ? parsed : null;
}
async function removeChunks(key: string, entry: Manifest | null) {
  if (!entry) return;
  for (let index = 0; index < entry.chunks; index++) await SecureStore.deleteItemAsync(`${key}.${entry.generation}.${index}`);
}
async function removePending(key: string) {
  const pending = await manifest(`${key}.pending`);
  const published = await manifest(key);
  if (pending?.generation !== published?.generation) await removeChunks(key, pending);
  await SecureStore.deleteItemAsync(`${key}.pending`);
}
async function removeJournal(key: string) {
  await removePending(key);
  const previous = await manifest(key);
  await SecureStore.deleteItemAsync(key);
  await removeChunks(key, previous);
}

export function readAuthoringJournal<T>(identity: string, scope: string): Promise<T | null> {
  const capturedEpoch = epoch;
  return serial(async () => {
    if (capturedEpoch !== epoch) return null;
    const key = storageKey(identity);
    leases.set(key, scope);
    await removePending(key);
    const entry = await manifest(key);
    if (!entry) return null;
    if (entry.scope !== scope) {
      await removeJournal(key);
      return null;
    }
    let text = '';
    for (let index = 0; index < entry.chunks; index++) {
      const part = await SecureStore.getItemAsync(`${key}.${entry.generation}.${index}`);
      if (part === null) return null;
      text += part;
    }
    return JSON.parse(text) as T;
  });
}

export function writeAuthoringJournal(identity: string, scope: string, value: unknown): Promise<void> {
  const capturedEpoch = epoch;
  return serial(async () => {
    const key = storageKey(identity);
    if (capturedEpoch !== epoch || leases.get(key) !== scope) return;
    await removePending(key);
    const previous = await manifest(key);
    const text = JSON.stringify(value);
    const chunks = Math.ceil(text.length / 500);
    if (chunks > 512) throw new Error('This draft is too large for local recovery. Save it to keep your changes.');
    const generation = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    const next = { scope, generation, chunks };
    const index: string[] = JSON.parse(await SecureStore.getItemAsync(INDEX) || '[]');
    if (!index.includes(key)) await SecureStore.setItemAsync(INDEX, JSON.stringify([...index, key]), OPTIONS);
    // Register incomplete chunks so interrupted writes can be cleaned on recovery
    // or logout without losing the previous complete generation.
    await SecureStore.setItemAsync(`${key}.pending`, JSON.stringify(next), OPTIONS);
    for (let part = 0; part < chunks; part++) {
      await SecureStore.setItemAsync(`${key}.${generation}.${part}`, text.slice(part * 500, (part + 1) * 500), OPTIONS);
    }
    await SecureStore.setItemAsync(key, JSON.stringify(next), OPTIONS);
    await SecureStore.deleteItemAsync(`${key}.pending`);
    await removeChunks(key, previous);
  });
}

export function clearAuthoringJournal(identity: string): Promise<void> {
  return serial(async () => {
    const key = storageKey(identity);
    await removeJournal(key);
    const index: string[] = JSON.parse(await SecureStore.getItemAsync(INDEX) || '[]');
    await SecureStore.setItemAsync(INDEX, JSON.stringify(index.filter((value) => value !== key)), OPTIONS);
  });
}

export function purgeAuthoringJournals(): Promise<void> {
  epoch += 1;
  leases.clear();
  return serial(async () => {
    const index: string[] = JSON.parse(await SecureStore.getItemAsync(INDEX) || '[]');
    for (const key of index) await removeJournal(key);
    await SecureStore.deleteItemAsync(INDEX);
  });
}
