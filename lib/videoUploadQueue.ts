import { currentExecutionActor, executionActorOwns, subscribeExecutionActor } from '@/lib/execution-actor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, Platform } from 'react-native';

import { API_BASE, fetchJson } from '@/lib/api';
import { setUpdateBlocker } from '@/lib/updateSafety';
import { requireUploadedSetVideo } from '@/lib/set-video-upload-status';

export type QueuedVideoUploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'cancelled';

export type QueuedVideoUploadJob = {
  ownerUserId?: string;
  id: string;
  status: QueuedVideoUploadStatus;
  localFileUri: string;
  thumbnailUri?: string | null;
  setLogId: number;
  workoutId?: number | null;
  filename: string;
  mimeType: string;
  fileSizeBytes?: number | null;
  fileMd5?: string | null;
  videoAngle?: string | null;
  submitForReview?: boolean;
  uploadIntent?: string | null;
  retryCount: number;
  lastError?: string | null;
  serverAttachmentId?: number | null;
  uploadedBytes?: number;
  totalBytes?: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string | null;
  uploadSessionId?: string | null;
  cancelRequested?: boolean;
  phase?: 'transferring' | 'processing';
};

type EnqueueVideoUploadInput = {
  localFileUri: string;
  thumbnailUri?: string | null;
  setLogId: number;
  workoutId?: number | null;
  filename: string;
  mimeType: string;
  fileSizeBytes?: number | null;
  videoAngle?: string | null;
  submitForReview?: boolean;
  uploadIntent?: string | null;
};

const STORAGE_KEY = 'strength-ledger.video-upload-queue.v1';
const MAX_RETRY_COUNT = 8;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const CHUNK_UPLOAD_RETRIES = 3;
const listeners = new Set<(jobs: QueuedVideoUploadJob[]) => void>();

let processing = false;
let started = false;
let interval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove?: () => void } | null = null;
let mutationTail: Promise<unknown> = Promise.resolve();
let activeJobId: string | null = null;
let processingDone: Promise<void> = Promise.resolve();
let finishProcessing: (() => void) | null = null;
let activeTransfer: ReturnType<typeof FileSystem.createUploadTask> | null = null;

function mutateJobs<T>(mutation: (jobs: QueuedVideoUploadJob[]) => { jobs: QueuedVideoUploadJob[]; result: T }): Promise<T> {
  const operation = mutationTail.then(async () => {
    const changed = mutation(await loadJobs());
    await saveJobs(changed.jobs);
    return changed.result;
  });
  mutationTail = operation.catch(() => {});
  return operation;
}

function nowIso() {
  return new Date().toISOString();
}

function queueDir() {
  return `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}video-upload-queue`;
}

function extensionFor(filename: string, mimeType: string) {
  const match = filename.match(/(\.[a-z0-9]+)$/i);
  if (match) return match[1].toLowerCase();
  if (/quicktime|mov/i.test(mimeType)) return '.mov';
  if (/mp4|mpeg-4/i.test(mimeType)) return '.mp4';
  return '.mp4';
}

function uploadIntentForJob(job: QueuedVideoUploadJob) {
  return job.uploadIntent || (job.submitForReview === false ? 'archive_only' : 'submitted');
}

function submitForReviewValue(job: QueuedVideoUploadJob) {
  return job.submitForReview === false ? 'false' : 'true';
}

function shouldUseChunkedUpload(_job: QueuedVideoUploadJob, _actualSize?: number | null) {
  // Production iOS has produced empty Flask multipart parses on the direct
  // endpoint at 16MB+, so native video uploads must always use chunked JSON.
  return Platform.OS !== 'web';
}

function backoffMs(retryCount: number) {
  const base = Math.min(15 * 60 * 1000, 5000 * Math.pow(2, Math.max(0, retryCount - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

function isDue(job: QueuedVideoUploadJob) {
  if (!job.nextAttemptAt) return true;
  return new Date(job.nextAttemptAt).getTime() <= Date.now();
}

function isTerminal(status: QueuedVideoUploadStatus) {
  return status === 'uploaded' || status === 'failed_permanent' || status === 'cancelled';
}

async function ensureQueueDir() {
  const dir = queueDir();
  if (!dir) return null;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function copyIntoQueue(uri: string, filename: string, mimeType: string) {
  const dir = await ensureQueueDir();
  if (!dir) return uri;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const target = `${dir}/${id}${extensionFor(filename, mimeType)}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

async function copyThumbnailIntoQueue(uri?: string | null) {
  if (!uri) return null;
  const dir = await ensureQueueDir();
  if (!dir) return uri;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const target = `${dir}/${id}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

async function loadJobs(): Promise<QueuedVideoUploadJob[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error('Saved video queue could not be read. Your local clips have been preserved.');
  return parsed;
}

async function saveJobs(jobs: QueuedVideoUploadJob[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  notify(jobs);
}

function notify(jobs?: QueuedVideoUploadJob[]) {
  if (jobs) {
    listeners.forEach((listener) => listener(jobs.filter(job => executionActorOwns(job.ownerUserId))));
    return;
  }
  void loadJobs().then((loaded) => {
    listeners.forEach((listener) => listener(loaded.filter(job => executionActorOwns(job.ownerUserId))));
  });
}

async function updateJob(id: string, updater: (job: QueuedVideoUploadJob) => QueuedVideoUploadJob, requiredOwner?: string | null) {
  return mutateJobs(jobs => {
    const target = jobs.find(job => job.id === id);
    if (requiredOwner !== undefined && (!executionActorOwns(requiredOwner) || target?.ownerUserId !== requiredOwner)) return { jobs, result: null };
    const next = jobs.map(job => {
      if (job.id !== id) return job;
      const changed = updater(job);
      return (job.status === 'cancelled' || job.status === 'uploaded') && changed.status !== job.status ? job : changed;
    });
    return { jobs: next, result: next.find(job => job.id === id) || null };
  });
}

function statusFromFailure(status: number, message: string): QueuedVideoUploadStatus {
  if (/video file required/i.test(message)) {
    return 'failed_retryable';
  }
  if (status === 400 || status === 403 || status === 410 || status === 413 || status === 422 || /unsupported|too large|forbidden/i.test(message)) {
    return 'failed_permanent';
  }
  return 'failed_retryable';
}

async function ownedVideoFetch(ownerUserId: string | undefined, path: string, options: Parameters<typeof fetchJson>[1]) {
  if (!executionActorOwns(ownerUserId)) throw new Error('This upload belongs to another account.');
  return fetchJson(path, options);
}

async function assertJobActive(job: QueuedVideoUploadJob) {
  if (!executionActorOwns(job.ownerUserId)) throw new Error('This upload belongs to another account.');
  const current = (await loadJobs()).find(item => item.id === job.id);
  if (!current || current.cancelRequested || current.status === 'cancelled') throw Object.assign(new Error('Upload cancellation requested.'), { cancelled: true });
}

async function uploadJobBinary(job: QueuedVideoUploadJob, size: number) {
  if (Platform.OS === 'web' || typeof FileSystem.createUploadTask !== 'function') return null;
  const base = `${API_BASE}/video-review/mobile`;
  const init = await ownedVideoFetch(job.ownerUserId, `${base}/set-logs/${job.setLogId}/video/uploads`, {
    method: 'POST', auth: true, body: { client_upload_id: job.id, filename: job.filename,
      content_type: job.mimeType, size, video_angle: job.videoAngle || 'unknown',
      client_md5: job.fileMd5 || undefined,
      submit_for_review: submitForReviewValue(job), upload_intent: uploadIntentForJob(job) } as any,
  });
  if ((init.status === 404 || init.status === 405) && !job.uploadSessionId) return null; // Older server only.
  if (!init.ok || !init.json?.upload) throw Object.assign(new Error(init.json?.error || 'Could not prepare video upload.'), { httpStatus: init.status });
  let session = init.json.upload;
  await updateJob(job.id, current => ({ ...current, uploadSessionId: session.id, updatedAt: nowIso() }), job.ownerUserId);
  if (session.status === 'completed') return { video: session.video };
  if (session.status === 'rejected') throw Object.assign(new Error(session.error || 'This clip could not be prepared.'), { permanent: true });
  if (session.status === 'cancelled') throw Object.assign(new Error('This upload was cancelled.'), { permanent: true });
  const endpoint = `${base}/video-uploads/${session.id}`;
  if (session.status === 'processing' || session.status === 'validating') return { processing: true };
  const partSize = Number(session.part_size);
  const totalParts = Number(session.total_parts);
  if (!Number.isSafeInteger(partSize) || partSize < 128 * 1024 || partSize > 16 * 1024 * 1024 ||
      !Number.isSafeInteger(totalParts) || totalParts !== Math.ceil(size / partSize)) throw new Error('Invalid video transfer manifest.');
  const acknowledged = new Set<number>((session.completed_parts || []).filter((part: any) => Number.isInteger(part.index) &&
    part.index >= 0 && part.index < totalParts && part.size === Math.min(partSize, size - part.index * partSize)).map((part: any) => part.index));
  let sent = [...acknowledged].reduce((sum, index) => sum + Math.min(partSize, size - index * partSize), 0);
  await updateJob(job.id, current => ({ ...current, phase: 'transferring', uploadedBytes: sent, totalBytes: size }), job.ownerUserId);
  for (let index = 0; index < totalParts; index++) {
    if (acknowledged.has(index)) continue;
    await assertJobActive(job);
    const length = Math.min(partSize, size - index * partSize);
    const partUri = `${queueDir()}/${job.id}-part-${index}.bin`;
    // Native file-backed URLSession transfer. Base64 is only a bounded disk slice,
    // never sent over the network; original video bytes are PUT directly.
    const bytes = await FileSystem.readAsStringAsync(job.localFileUri, { encoding: FileSystem.EncodingType.Base64,
      position: index * partSize, length } as any);
    await FileSystem.writeAsStringAsync(partUri, bytes, { encoding: FileSystem.EncodingType.Base64 });
    try {
      await assertJobActive(job);
      const grant = await ownedVideoFetch(job.ownerUserId, `${endpoint}/parts/${index}`, { method: 'POST', auth: true });
      if (!grant.ok || !grant.json?.url) throw Object.assign(new Error(grant.json?.error || 'Could not resume video transfer.'), { httpStatus: grant.status });
      const target = String(grant.json.url);
      // Grants must use HTTPS, except the same-origin local development server.
      if (!target.startsWith('https://') && !target.startsWith(`${API_BASE}/`)) throw new Error('Invalid video transfer destination.');
      let progressAt = 0;
      activeTransfer = FileSystem.createUploadTask(target, partUri, {
        httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND, headers: grant.json.headers || {},
      }, progress => {
        if (Date.now() - progressAt < 300) return;
        progressAt = Date.now();
        void updateJob(job.id, current => ({ ...current, uploadedBytes: Math.min(size, sent + progress.totalBytesSent), totalBytes: size }), job.ownerUserId).catch(() => {});
      });
      const result = await activeTransfer.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        // A cloud UploadPart capability can expire while iOS suspends the app.
        // Retry obtains a new grant through the actor-authorized API. A 403 from
        // that API remains permanent; object-storage expiry is not revocation.
        const refreshCloudGrant = result?.status === 403 && !target.startsWith(`${API_BASE}/`);
        throw Object.assign(new Error('Video transfer was interrupted. It will resume from saved parts.'),
          { httpStatus: refreshCloudGrant ? 503 : result?.status });
      }
      sent += length;
      await updateJob(job.id, current => ({ ...current, uploadedBytes: sent, totalBytes: size, updatedAt: nowIso() }), job.ownerUserId);
    } finally {
      activeTransfer = null;
      await FileSystem.deleteAsync(partUri, { idempotent: true }).catch(() => {});
    }
  }
  await assertJobActive(job);
  const complete = await ownedVideoFetch(job.ownerUserId, `${endpoint}/complete`, { method: 'POST', auth: true,
    timeoutMs: UPLOAD_TIMEOUT_MS, body: {} as any });
  if (!complete.ok) throw Object.assign(new Error(complete.json?.error || 'Video confirmation was interrupted.'), { httpStatus: complete.status });
  if (complete.json?.video) return { video: complete.json.video };
  return { processing: true };
}

async function uploadChunkWithRetry(setLogId: number, payload: any, ownerUserId?: string) {
  const uploadId = String(payload?.upload_id || '').trim();
  if (!uploadId) {
    throw new Error('Chunked upload session was not initialized.');
  }
  const body = JSON.stringify({
    ...payload,
    upload_id: uploadId,
  });
  let lastError: any = null;
  for (let attempt = 1; attempt <= CHUNK_UPLOAD_RETRIES; attempt += 1) {
    const { ok, status, json, raw } = await ownedVideoFetch(ownerUserId,
      `${API_BASE}/video-review/mobile/set-logs/${setLogId}/video/chunked/chunk`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        auth: true,
        timeoutMs: 60 * 1000,
      },
    );
    if (ok && json?.ok) return json;
    lastError = new Error(json?.error || raw || `Video chunk upload failed (HTTP ${status})`);
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
  }
  throw lastError || new Error('Video chunk upload failed.');
}

async function uploadJobChunked(job: QueuedVideoUploadJob, actualSize: number) {
  const init = await ownedVideoFetch(job.ownerUserId,
    `${API_BASE}/video-review/mobile/set-logs/${job.setLogId}/video/chunked/init`,
    {
      method: 'POST',
      auth: true,
      timeoutMs: 60 * 1000,
      body: {
        client_upload_id: job.id,
        filename: job.filename || 'set-video.mp4',
        content_type: job.mimeType || 'video/mp4',
        size: actualSize,
        video_angle: job.videoAngle || 'unknown',
        submit_for_review: submitForReviewValue(job),
        upload_intent: uploadIntentForJob(job),
      } as any,
    },
  );
  if (!init.ok || !init.json?.ok) {
    throw Object.assign(
      new Error(init.json?.error || init.raw || `Chunked upload init failed (HTTP ${init.status})`),
      { httpStatus: init.status },
    );
  }

  const uploadId = String(init.json.upload_id || '').trim();
  if (!uploadId) {
    throw new Error('Chunked upload init did not return an upload id.');
  }
  await updateJob(job.id, current => ({ ...current, uploadedBytes: 0, totalBytes: actualSize, updatedAt: nowIso() }), job.ownerUserId);
  const chunkSize = Number(init.json.chunk_size || 1024 * 1024);
  const totalChunks = Number(init.json.total_chunks || Math.ceil(actualSize / chunkSize));

  for (let index = 0; index < totalChunks; index += 1) {
    await assertJobActive(job);
    const position = index * chunkSize;
    const length = Math.min(chunkSize, actualSize - position);
    const dataBase64 = await FileSystem.readAsStringAsync(job.localFileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    } as any);
    await uploadChunkWithRetry(job.setLogId, {
      upload_id: uploadId,
      index,
      data_base64: dataBase64,
    }, job.ownerUserId);
    await updateJob(job.id, current => ({ ...current, uploadedBytes: position + length, totalBytes: actualSize, updatedAt: nowIso() }), job.ownerUserId);
  }

  let thumbnailBase64 = '';
  if (job.thumbnailUri) {
    const thumbInfo = await FileSystem.getInfoAsync(job.thumbnailUri);
    if (thumbInfo.exists) {
      thumbnailBase64 = await FileSystem.readAsStringAsync(job.thumbnailUri, {
        encoding: FileSystem.EncodingType.Base64,
      } as any);
    }
  }

  const complete = await ownedVideoFetch(job.ownerUserId,
    `${API_BASE}/video-review/mobile/set-logs/${job.setLogId}/video/chunked/complete`,
    {
      method: 'POST',
      auth: true,
      timeoutMs: UPLOAD_TIMEOUT_MS,
      body: {
        upload_id: uploadId,
        total_chunks: totalChunks,
        thumbnail_base64: thumbnailBase64,
        thumbnail_filename: thumbnailBase64 ? `set-video-thumbnail-${job.id}.jpg` : '',
        thumbnail_content_type: thumbnailBase64 ? 'image/jpeg' : '',
      } as any,
    },
  );
  if (!complete.ok || !complete.json?.ok) {
    throw Object.assign(
      new Error(complete.json?.error || complete.raw || `Chunked upload complete failed (HTTP ${complete.status})`),
      { httpStatus: complete.status },
    );
  }
  return complete.json?.video || null;
}

async function uploadJobLegacyDirectMultipartForWebOnly(job: QueuedVideoUploadJob) {
  const formData = new FormData();
  formData.append('video', {
    uri: job.localFileUri,
    name: job.filename || 'set-video.mp4',
    type: job.mimeType || 'video/mp4',
  } as any);
  formData.append('client_upload_id', job.id);
  formData.append('video_angle', job.videoAngle || 'unknown');
  formData.append('submit_for_review', submitForReviewValue(job));
  formData.append('upload_intent', uploadIntentForJob(job));
  if (job.fileSizeBytes != null) {
    formData.append('file_size_bytes', String(job.fileSizeBytes));
  }
  if (job.thumbnailUri) {
    const thumbInfo = await FileSystem.getInfoAsync(job.thumbnailUri);
    if (thumbInfo.exists) {
      formData.append('thumbnail', {
        uri: job.thumbnailUri,
        name: `set-video-thumbnail-${job.id}.jpg`,
        type: 'image/jpeg',
      } as any);
    }
  }

  const { ok, status, json, raw } = await ownedVideoFetch(job.ownerUserId,
    `${API_BASE}/video-review/mobile/set-logs/${job.setLogId}/video`,
    {
      method: 'POST',
      body: formData,
      auth: true,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    },
  );

  if (!ok || !json?.ok) {
    const message = json?.error || raw || `Video upload failed (HTTP ${status})`;
    throw Object.assign(new Error(message), { httpStatus: status });
  }

  return json?.video || null;
}

async function uploadJob(job: QueuedVideoUploadJob) {
  const info = await FileSystem.getInfoAsync(job.localFileUri, { md5: !job.fileMd5 });
  if (!info.exists) {
    throw Object.assign(new Error('Local video file is no longer available.'), { permanent: true });
  }
  const actualSize = Number((info as any)?.size || job.fileSizeBytes || 0);
  if (!job.fileMd5 && (info as any).md5) {
    job = { ...job, fileMd5: (info as any).md5 };
    await updateJob(job.id, current => ({ ...current, fileMd5: job.fileMd5 }), job.ownerUserId);
  }
  const binary = await uploadJobBinary(job, actualSize);
  if (binary) return binary;
  if (shouldUseChunkedUpload(job, actualSize)) {
    if (!actualSize || actualSize <= 0) {
      throw Object.assign(new Error('Local video file size is unavailable.'), { permanent: true });
    }
    return { video: await uploadJobChunked(job, actualSize) };
  }
  return { video: await uploadJobLegacyDirectMultipartForWebOnly(job) };
}

async function cleanupJobFiles(job: QueuedVideoUploadJob) {
  for (const uri of [job.localFileUri, job.thumbnailUri].filter(Boolean) as string[]) {
    if (Platform.OS === 'web') continue;
    try {
      const dir = queueDir();
      if (dir && uri.startsWith(dir)) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // best-effort cleanup
    }
  }
}

export async function enqueueVideoUpload(input: EnqueueVideoUploadInput): Promise<QueuedVideoUploadJob> {
  const ownerUserId = currentExecutionActor();
  if (!ownerUserId) throw new Error('Sign in before attaching Session video.');
  const createdAt = nowIso();
  const id = `mvu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const copiedFile = await copyIntoQueue(input.localFileUri, input.filename, input.mimeType);
  const copiedThumbnail = await copyThumbnailIntoQueue(input.thumbnailUri);
  if (!executionActorOwns(ownerUserId)) throw new Error('Account changed while preparing video.');
  const job: QueuedVideoUploadJob = {
    ownerUserId,
    id,
    status: 'pending',
    localFileUri: copiedFile,
    thumbnailUri: copiedThumbnail,
    setLogId: input.setLogId,
    workoutId: input.workoutId ?? null,
    filename: input.filename || 'set-video.mp4',
    mimeType: input.mimeType || 'video/mp4',
    fileSizeBytes: input.fileSizeBytes ?? null,
    videoAngle: input.videoAngle || 'unknown',
    submitForReview: input.submitForReview !== false,
    uploadIntent: input.uploadIntent || (input.submitForReview === false ? 'archive_only' : 'submitted'),
    retryCount: 0,
    lastError: null,
    createdAt,
    updatedAt: createdAt,
    nextAttemptAt: createdAt,
  };
  await mutateJobs(jobs => ({ jobs: [job, ...jobs], result: job }));
  void processVideoUploadQueue();
  return job;
}

export async function processVideoUploadQueue() {
  if (processing || !currentExecutionActor()) return;
  processing = true;
  processingDone = new Promise(resolve => { finishProcessing = resolve; });
  setUpdateBlocker('video_upload', true);
  try {
    const jobs = await loadJobs();
    const job = jobs
      .filter((candidate) => executionActorOwns(candidate.ownerUserId) && !isTerminal(candidate.status))
      .find((candidate) => candidate.status === 'pending' || (candidate.status === 'failed_retryable' && isDue(candidate)) || (candidate.status === 'uploading' && isDue(candidate)));
    if (!job) return;
    activeJobId = job.id;

    await updateJob(job.id, (current) => ({
      ...current,
      status: 'uploading',
      updatedAt: nowIso(),
      nextAttemptAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }));

    try {
      let result;
      if (job.phase === 'processing' && job.uploadSessionId) {
        const status = await ownedVideoFetch(job.ownerUserId, `${API_BASE}/video-review/mobile/video-uploads/${job.uploadSessionId}`, { method: 'GET', auth: true });
        if (!status.ok) throw Object.assign(new Error(status.json?.error || 'Could not confirm video preparation.'), { httpStatus: status.status });
        if (status.json?.upload?.status === 'rejected' || status.json?.upload?.status === 'cancelled') throw Object.assign(new Error(status.json.upload.error || 'Video preparation did not complete.'), { permanent: true });
        result = status.json?.upload?.status === 'completed' ? { video: status.json.upload.video } : { processing: true };
      } else result = await uploadJob(job);
      if (result.processing) {
        await updateJob(job.id, current => ({ ...current, status: 'uploading', phase: 'processing',
          nextAttemptAt: new Date(Date.now() + 5000).toISOString(), updatedAt: nowIso() }), job.ownerUserId);
        return;
      }
      const attachmentId = requireUploadedSetVideo(result.video, job.setLogId);
      const updated = await updateJob(job.id, (current) => {
        if (current.status === 'cancelled') return current;
        return {
          ...current,
          status: 'uploaded',
          serverAttachmentId: attachmentId,
          lastError: null,
          updatedAt: nowIso(),
          nextAttemptAt: null,
        };
      }, job.ownerUserId);
      if (updated) await cleanupJobFiles(updated);
    } catch (err: any) {
      const message = String(err?.message || 'Video upload failed.');
      const retryCount = (job.retryCount || 0) + 1;
      const permanent = err?.permanent === true || retryCount >= MAX_RETRY_COUNT || statusFromFailure(Number(err?.httpStatus || 0), message) === 'failed_permanent';
      await updateJob(job.id, (current) => {
        if (current.status === 'cancelled') return current;
        return {
          ...current,
          status: permanent ? 'failed_permanent' : 'failed_retryable',
          retryCount,
          lastError: message,
          updatedAt: nowIso(),
          nextAttemptAt: permanent ? null : new Date(Date.now() + backoffMs(retryCount)).toISOString(),
        };
      }, job.ownerUserId);
    }
  } finally {
    processing = false;
    activeJobId = null;
    finishProcessing?.();
    finishProcessing = null;
    setUpdateBlocker('video_upload', false);
    const jobs = await loadJobs();
    const waiting = jobs.filter(job => executionActorOwns(job.ownerUserId) && !isTerminal(job.status) && !job.cancelRequested);
    if (waiting.length) {
      const next = Math.min(...waiting.map(job => job.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : Date.now()));
      setTimeout(() => void processVideoUploadQueue(), Math.min(30000, Math.max(1000, next - Date.now())));
    }
  }
}

export function startVideoUploadQueue() {
  if (started) return;
  started = true;
  void mutateJobs(jobs => ({ jobs: jobs.map(job => executionActorOwns(job.ownerUserId) && job.status === 'uploading'
    ? { ...job, status: 'pending', nextAttemptAt: nowIso() } : job), result: null })).then(() => processVideoUploadQueue());
  interval = setInterval(() => void processVideoUploadQueue(), 30 * 1000);
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void processVideoUploadQueue();
  });
}

export async function retryVideoUploadJob(jobId: string) {
  const owner = currentExecutionActor();
  if (!owner) return;
  await updateJob(jobId, (job) => ({
    ...job,
    status: 'pending',
    retryCount: 0,
    cancelRequested: false,
    lastError: null,
    updatedAt: nowIso(),
    nextAttemptAt: nowIso(),
  }), owner);
  void processVideoUploadQueue();
}

export async function cancelVideoUploadJob(jobId: string) {
  const owner = currentExecutionActor();
  if (!owner) return;
  let requested = await updateJob(jobId, current => ({ ...current, cancelRequested: true }), owner);
  if (!requested || requested.status === 'uploaded') return;
  if (!requested.uploadSessionId && activeJobId === jobId) {
    await processingDone;
    requested = (await loadJobs()).find(job => job.id === jobId) || null;
    if (!requested || requested.status === 'uploaded') return;
  }
  if (activeJobId === jobId && requested.uploadSessionId) await activeTransfer?.cancelAsync();
  if (requested.uploadSessionId) {
    const result = await ownedVideoFetch(owner, `${API_BASE}/video-review/mobile/video-uploads/${requested.uploadSessionId}/cancel`, { method: 'POST', auth: true });
    if (!result.ok) throw new Error(result.json?.error || 'Cancellation could not be confirmed. Your video is preserved.');
    if (result.json?.upload?.status === 'completed') {
      const attachmentId = requireUploadedSetVideo(result.json.upload.video, requested.setLogId);
      const done = await updateJob(jobId, current => ({ ...current, status: 'uploaded', serverAttachmentId: attachmentId, cancelRequested: false }), owner);
      if (done) await cleanupJobFiles(done);
      return;
    }
  }
  const job = await updateJob(jobId, (current) => ({
    ...current,
    status: 'cancelled',
    updatedAt: nowIso(),
    nextAttemptAt: null,
  }), owner);
  if (job) await cleanupJobFiles(job);
}

export async function getVideoUploadJobs() {
  return (await loadJobs()).filter(job => executionActorOwns(job.ownerUserId));
}

export function subscribeVideoUploadQueue(listener: (jobs: QueuedVideoUploadJob[]) => void) {
  listeners.add(listener);
  void getVideoUploadJobs().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function stopVideoUploadQueue() {
  if (interval) clearInterval(interval);
  interval = null;
  appStateSubscription?.remove?.();
  appStateSubscription = null;
  started = false;
}

export const stopVideoUploadQueueForTests = stopVideoUploadQueue;

subscribeExecutionActor(() => { void activeTransfer?.cancelAsync(); notify(); if (started) void processVideoUploadQueue(); });
