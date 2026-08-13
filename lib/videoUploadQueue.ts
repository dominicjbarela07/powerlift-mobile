import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, Platform } from 'react-native';

import { API_BASE, fetchJson } from '@/lib/api';
import { setUpdateBlocker } from '@/lib/updateSafety';

export type QueuedVideoUploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'cancelled';

export type QueuedVideoUploadJob = {
  id: string;
  status: QueuedVideoUploadStatus;
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
  retryCount: number;
  lastError?: string | null;
  serverAttachmentId?: number | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string | null;
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
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveJobs(jobs: QueuedVideoUploadJob[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  notify(jobs);
}

function notify(jobs?: QueuedVideoUploadJob[]) {
  if (jobs) {
    listeners.forEach((listener) => listener(jobs));
    return;
  }
  void loadJobs().then((loaded) => {
    listeners.forEach((listener) => listener(loaded));
  });
}

async function updateJob(id: string, updater: (job: QueuedVideoUploadJob) => QueuedVideoUploadJob) {
  const jobs = await loadJobs();
  const next = jobs.map((job) => (job.id === id ? updater(job) : job));
  await saveJobs(next);
  return next.find((job) => job.id === id) || null;
}

function statusFromFailure(status: number, message: string): QueuedVideoUploadStatus {
  if (/video file required/i.test(message)) {
    return 'failed_retryable';
  }
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 413 || /unsupported|too large|forbidden|not available/i.test(message)) {
    return 'failed_permanent';
  }
  return 'failed_retryable';
}

async function uploadChunkWithRetry(setLogId: number, payload: any) {
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
    const { ok, status, json, raw } = await fetchJson(
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
  const init = await fetchJson(
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
  const chunkSize = Number(init.json.chunk_size || 1024 * 1024);
  const totalChunks = Number(init.json.total_chunks || Math.ceil(actualSize / chunkSize));

  for (let index = 0; index < totalChunks; index += 1) {
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
    });
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

  const complete = await fetchJson(
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

  const { ok, status, json, raw } = await fetchJson(
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
  const info = await FileSystem.getInfoAsync(job.localFileUri, { size: true } as any);
  if (!info.exists) {
    throw Object.assign(new Error('Local video file is no longer available.'), { permanent: true });
  }
  const actualSize = Number((info as any)?.size || job.fileSizeBytes || 0);
  if (shouldUseChunkedUpload(job, actualSize)) {
    if (!actualSize || actualSize <= 0) {
      throw Object.assign(new Error('Local video file size is unavailable.'), { permanent: true });
    }
    return uploadJobChunked(job, actualSize);
  }
  return uploadJobLegacyDirectMultipartForWebOnly(job);
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
  const createdAt = nowIso();
  const id = `mvu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const copiedFile = await copyIntoQueue(input.localFileUri, input.filename, input.mimeType);
  const copiedThumbnail = await copyThumbnailIntoQueue(input.thumbnailUri);
  const job: QueuedVideoUploadJob = {
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
  const jobs = await loadJobs();
  await saveJobs([job, ...jobs]);
  void processVideoUploadQueue();
  return job;
}

export async function processVideoUploadQueue() {
  if (processing) return;
  processing = true;
  setUpdateBlocker('video_upload', true);
  try {
    const jobs = await loadJobs();
    const job = jobs
      .filter((candidate) => !isTerminal(candidate.status))
      .find((candidate) => candidate.status === 'pending' || (candidate.status === 'failed_retryable' && isDue(candidate)) || (candidate.status === 'uploading' && isDue(candidate)));
    if (!job) return;

    await updateJob(job.id, (current) => ({
      ...current,
      status: 'uploading',
      updatedAt: nowIso(),
      nextAttemptAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }));

    try {
      const video = await uploadJob(job);
      const updated = await updateJob(job.id, (current) => {
        if (current.status === 'cancelled') return current;
        return {
          ...current,
          status: 'uploaded',
          serverAttachmentId: video?.id ?? current.serverAttachmentId ?? null,
          lastError: null,
          updatedAt: nowIso(),
          nextAttemptAt: null,
        };
      });
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
      });
    }
  } finally {
    processing = false;
    setUpdateBlocker('video_upload', false);
    const remaining = (await loadJobs()).some((job) => !isTerminal(job.status) && isDue(job));
    if (remaining) {
      setTimeout(() => void processVideoUploadQueue(), 1000);
    }
  }
}

export function startVideoUploadQueue() {
  if (started) return;
  started = true;
  void processVideoUploadQueue();
  interval = setInterval(() => void processVideoUploadQueue(), 30 * 1000);
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void processVideoUploadQueue();
  });
}

export async function retryVideoUploadJob(jobId: string) {
  await updateJob(jobId, (job) => ({
    ...job,
    status: 'pending',
    retryCount: 0,
    lastError: null,
    updatedAt: nowIso(),
    nextAttemptAt: nowIso(),
  }));
  void processVideoUploadQueue();
}

export async function cancelVideoUploadJob(jobId: string) {
  const job = await updateJob(jobId, (current) => ({
    ...current,
    status: 'cancelled',
    updatedAt: nowIso(),
    nextAttemptAt: null,
  }));
  if (job) await cleanupJobFiles(job);
}

export async function getVideoUploadJobs() {
  return loadJobs();
}

export function subscribeVideoUploadQueue(listener: (jobs: QueuedVideoUploadJob[]) => void) {
  listeners.add(listener);
  void loadJobs().then(listener);
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
