import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';

import {
  API_BASE,
  MessengerAttachment,
  getAttachmentDownloadUrl,
  requestAttachmentUploadUrl,
} from '@/lib/api';

export type SelectedMessagingAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const BLOCKED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm']);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function fileExtension(filename?: string | null) {
  const parts = String(filename || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export function formatAttachmentSize(bytes?: number | null) {
  const size = Number(bytes || 0);
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function mimeTypeForAttachment(filename?: string | null, mimeType?: string | null) {
  const normalized = String(mimeType || '').toLowerCase();
  return normalized || MIME_BY_EXTENSION[fileExtension(filename)] || '';
}

export function attachmentIsImage(attachment?: MessengerAttachment | SelectedMessagingAttachment | null) {
  const mimeType = 'mimeType' in (attachment || {})
    ? (attachment as SelectedMessagingAttachment).mimeType
    : (attachment as MessengerAttachment | null | undefined)?.mime_type;
  const filename = 'name' in (attachment || {})
    ? (attachment as SelectedMessagingAttachment).name
    : (attachment as MessengerAttachment | null | undefined)?.filename;
  return mimeTypeForAttachment(filename, mimeType).startsWith('image/');
}

export function validateMessagingAttachment(input: {
  name?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}) {
  const name = input.name || 'Attachment';
  const ext = fileExtension(name);
  const mimeType = mimeTypeForAttachment(name, input.mimeType);
  const sizeBytes = Number(input.sizeBytes || 0);

  if (String(mimeType).startsWith('video/') || BLOCKED_VIDEO_EXTENSIONS.has(ext)) {
    return 'Video attachments are not supported in messages.';
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return 'Choose an image, PDF, Word document, or text file.';
  }

  if (!sizeBytes || sizeBytes <= 0) {
    return 'Attachment size is missing.';
  }

  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return `Attachments must be ${formatAttachmentSize(MAX_ATTACHMENT_BYTES)} or smaller.`;
  }

  return '';
}

async function fileSizeForUri(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return Number(blob.size || 0);
  } catch {
    return 0;
  }
}

export function messageAttachments(message?: { attachment?: MessengerAttachment | null; attachments?: MessengerAttachment[] } | null) {
  const list = Array.isArray(message?.attachments) ? message.attachments.filter(Boolean) : [];
  if (list.length) return list;
  return message?.attachment?.filename ? [message.attachment] : [];
}

export async function pickMessagingAttachment(): Promise<{
  attachment?: SelectedMessagingAttachment;
  error?: string;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return {};

  const asset = result.assets?.[0];
  if (!asset?.uri) return { error: 'Attachment could not be selected.' };

  const attachment = {
    uri: asset.uri,
    name: asset.name || 'attachment',
    mimeType: mimeTypeForAttachment(asset.name, asset.mimeType),
    sizeBytes: Number(asset.size || 0),
  };

  const error = validateMessagingAttachment(attachment);
  if (error) return { error };

  return { attachment };
}

export async function pickPhotoMessagingAttachment(): Promise<{
  attachment?: SelectedMessagingAttachment;
  error?: string;
}> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { error: 'Photo library permission is required to choose a photo.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled) return {};

  const asset = result.assets?.[0];
  if (!asset?.uri) return { error: 'Photo could not be selected.' };
  if (asset.type && asset.type !== 'image') {
    return { error: 'Video attachments are not supported in messages.' };
  }

  const ext = fileExtension(asset.fileName) || 'jpg';
  const attachment = {
    uri: asset.uri,
    name: asset.fileName || `photo.${ext}`,
    mimeType: mimeTypeForAttachment(asset.fileName || `photo.${ext}`, asset.mimeType),
    sizeBytes: Number(asset.fileSize || 0) || await fileSizeForUri(asset.uri),
  };

  const error = validateMessagingAttachment(attachment);
  if (error) return { error };

  return { attachment };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token =
    (await SecureStore.getItemAsync('auth_token')) ||
    (await SecureStore.getItemAsync('token')) ||
    (await SecureStore.getItemAsync('pl_token')) ||
    (await SecureStore.getItemAsync('powerlift_token'));

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadMessagingAttachment(threadId: number, attachment: SelectedMessagingAttachment) {
  const uploadRes = await requestAttachmentUploadUrl({
    threadId,
    filename: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  });

  if (!uploadRes.ok || !uploadRes.upload) {
    throw new Error(uploadRes.error || 'Attachment upload could not start.');
  }

  const uploadUrl = uploadRes.upload.upload_url.startsWith('http')
    ? uploadRes.upload.upload_url
    : `${API_BASE}${uploadRes.upload.upload_url}`;
  const fileResponse = await fetch(attachment.uri);
  const fileBody = await fileResponse.blob();
  const contentType =
    uploadRes.upload.headers?.['Content-Type'] ||
    uploadRes.upload.headers?.['content-type'] ||
    attachment.mimeType ||
    'application/octet-stream';
  const headers = uploadRes.upload.provider === 'local'
    ? {
        ...(uploadRes.upload.headers || {}),
        'Content-Type': contentType,
        ...await authHeaders(),
      }
    : {
        'Content-Type': contentType,
      };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: fileBody as any,
  });

  if (!putRes.ok) {
    throw new Error(`Attachment upload failed (${putRes.status}).`);
  }

  return uploadRes.upload;
}

export async function openMessageAttachment(attachment: MessengerAttachment) {
  if (!attachment.id) throw new Error('Attachment is not ready to open.');

  const res = await getAttachmentDownloadUrl(Number(attachment.id));
  if (!res.ok || !res.download_url) {
    throw new Error(res.error || 'Attachment could not be opened.');
  }

  await Linking.openURL(res.download_url);
}
