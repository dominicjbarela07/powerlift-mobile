import * as FileSystem from 'expo-file-system/legacy';
import { currentExecutionActor, subscribeExecutionActor } from './execution-actor';

const inFlight = new Map<string, Promise<string>>();
const tasks = new Map<string, { owner: string; task: ReturnType<typeof FileSystem.createDownloadResumable> }>();
const pinned = new Set<string>();

export function cancelVideoArtifactTransfers(owner: string) {
  for (const transfer of tasks.values()) if (transfer.owner === owner) void transfer.task.cancelAsync().catch(() => {});
}

export function pinVideoArtifact(uri: string) {
  pinned.add(uri);
  return () => pinned.delete(uri);
}

export async function videoArtifactFile(input: { owner: string; exportId: number; unit: string;
  url: string; filename?: string | null; expectedBytes?: number | null; expectedMd5?: string | null; onProgress?: (percent: number) => void }) {
  if (currentExecutionActor() !== input.owner || !/^\d+$/.test(input.owner) || !Number.isInteger(input.exportId)) {
    throw new Error('Sign in again before downloading this video.');
  }
  const directory = `${FileSystem.cacheDirectory}video-exports/${input.owner}/`;
  const safeName = (input.filename || `strength-ledger-video-${input.unit === 'kg' ? 'kg' : 'lbs'}.mp4`)
    .replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '').replace(/\.mp4$/i, '').slice(0, 140) || 'strength-ledger-video';
  const artifactDirectory = `${directory}${input.exportId}/`;
  const target = `${artifactDirectory}${safeName}.mp4`;
  const previous = inFlight.get(target);
  if (previous) return previous;
  const operation = (async () => {
    await FileSystem.makeDirectoryAsync(artifactDirectory, { intermediates: true });
    const valid = async () => {
      const file = await FileSystem.getInfoAsync(target, { md5: !!input.expectedMd5 });
      if (!file.exists || file.size <= 0) return false;
      const prefix = await FileSystem.readAsStringAsync(target, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 12 });
      return atob(prefix).slice(4, 8) === 'ftyp' && (!input.expectedBytes || file.size === input.expectedBytes) &&
        (!input.expectedMd5 || file.md5?.toLowerCase() === input.expectedMd5.toLowerCase());
    };
    // Bound disk use without deleting a file currently used by the system share sheet.
    const files = (await Promise.all((await FileSystem.readDirectoryAsync(directory)).map(async name => {
      const uri = directory + name, info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.isDirectory) return Promise.all((await FileSystem.readDirectoryAsync(uri)).map(async child => {
        const childUri = `${uri}/${child}`;
        return { uri: childUri, info: await FileSystem.getInfoAsync(childUri) };
      }));
      return [{ uri, info }];
    }))).flat();
    let total = files.reduce((sum, file) => sum + (file.info.exists ? file.info.size : 0), 0);
    const oldest = files.filter(file => file.info.exists).sort((a, b) =>
      (a.info.exists ? a.info.modificationTime : 0) - (b.info.exists ? b.info.modificationTime : 0));
    for (const file of oldest) {
      if (total <= 250 * 1024 * 1024 || file.uri === target || pinned.has(file.uri) || inFlight.has(file.uri)) continue;
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      total -= file.info.exists ? file.info.size : 0;
    }
    if (await valid()) {
      if (currentExecutionActor() !== input.owner) throw new Error('Account changed while downloading video.');
      return target;
    }
    const task = FileSystem.createDownloadResumable(input.url, target,
      { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }, progress => {
        if (currentExecutionActor() === input.owner && progress.totalBytesExpectedToWrite > 0)
          input.onProgress?.(Math.min(99, Math.floor(progress.totalBytesWritten * 100 / progress.totalBytesExpectedToWrite)));
      });
    tasks.set(target, { owner: input.owner, task });
    try {
      const result = await task.downloadAsync();
      if (currentExecutionActor() !== input.owner) throw new Error('Account changed while downloading video.');
      if (!result || result.status !== 200 || !(await valid())) throw new Error('Downloaded video could not be verified. Please retry.');
      input.onProgress?.(100);
      return target;
    } catch (error) {
      await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
      throw error;
    } finally {
      tasks.delete(target);
    }
  })();
  inFlight.set(target, operation);
  try { return await operation; }
  finally { inFlight.delete(target); }
}

subscribeExecutionActor(() => {
  for (const { owner, task } of tasks.values()) if (owner !== currentExecutionActor()) void task.cancelAsync().catch(() => {});
});
