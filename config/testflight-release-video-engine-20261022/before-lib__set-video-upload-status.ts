export type SetVideoDraft = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | null;
  videoAngle?: string | null;
  thumbnailUri?: string | null;
  submitForReview?: boolean;
};

/** HTTP success alone does not confirm an attachment to the intended saved Set. */
export function requireUploadedSetVideo(video: any, setLogId: number): number {
  const id = Number(video?.id);
  if (!Number.isInteger(id) || id <= 0 || video?.upload_status !== 'uploaded'
    || Number(video?.set_log_id) !== Number(setLogId)) {
    throw new Error('The server has not confirmed this video. Your set is saved; retry the video upload.');
  }
  return id;
}

export function videoUploadPresentation(job: {
  status: string; serverAttachmentId?: number | null; uploadedBytes?: number; totalBytes?: number;
}) {
  if (job.status === 'uploaded' && Number(job.serverAttachmentId) > 0) return { label: 'Video uploaded', tone: 'success' as const, action: 'View' };
  if (job.status === 'failed_retryable' || job.status === 'failed_permanent' || job.status === 'uploaded') {
    return { label: 'Video not uploaded · Set saved', tone: 'error' as const, action: job.status === 'failed_retryable' ? 'Retry' : null };
  }
  if (job.status === 'uploading') {
    const percent = job.totalBytes ? Math.min(99, Math.floor((job.uploadedBytes || 0) * 100 / job.totalBytes)) : null;
    return { label: percent == null ? 'Uploading video…' : `Uploading video · ${percent}%`, tone: 'pending' as const, action: null };
  }
  return { label: 'Video queued · Set saved', tone: 'pending' as const, action: null };
}
