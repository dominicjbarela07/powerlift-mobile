const PHOTO_URL_FIELDS = [
  'profilePhotoUrl',
  'profile_photo_url',
  'avatarUrl',
  'avatar_url',
  'photoUrl',
  'photo_url',
  'imageUrl',
  'image_url',
] as const;

const PHOTO_VERSION_FIELDS = [
  'profilePhotoVersion',
  'profile_photo_version',
  'avatarUploadedAt',
  'avatar_uploaded_at',
  'updatedAt',
  'updated_at',
] as const;

export type CanonicalProfilePhoto = {
  profilePhotoUrl: string | null;
  profilePhotoVersion: string | null;
  hasProfilePhotoValue: boolean;
};

function firstPresentValue(
  input: Record<string, unknown>,
  fields: readonly string[]
): { present: boolean; value: unknown } {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      return { present: true, value: input[field] };
    }
  }
  return { present: false, value: undefined };
}

function normalizedOptionalString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Profile-photo response aliases are normalized here, at the mobile model
 * boundary. Screens consume only profilePhotoUrl/profilePhotoVersion.
 */
export function normalizeProfilePhotoPayload(input: unknown): CanonicalProfilePhoto {
  const record =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {};
  const photo = firstPresentValue(record, PHOTO_URL_FIELDS);
  const version = firstPresentValue(record, PHOTO_VERSION_FIELDS);

  return {
    profilePhotoUrl: normalizedOptionalString(photo.value),
    profilePhotoVersion: normalizedOptionalString(version.value),
    hasProfilePhotoValue: photo.present,
  };
}

function encodeUrlPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

export function resolveProfilePhotoUrl(
  value: string | null | undefined,
  apiBase = 'https://app.strengthledger.fit'
): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return null;
  }

  try {
    const absolute = raw.startsWith('//')
      ? `https:${raw}`
      : /^https?:\/\//i.test(raw)
      ? raw
      : `${String(apiBase || '').replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
    const url = new URL(absolute);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.pathname = encodeUrlPath(url.pathname);
    return url.toString();
  } catch {
    return null;
  }
}

export function versionProfilePhotoUrl(
  value: string | null | undefined,
  version: string | null | undefined,
  apiBase = 'https://app.strengthledger.fit'
): string | null {
  const resolved = resolveProfilePhotoUrl(value, apiBase);
  if (!resolved) return null;
  const normalizedVersion = normalizedOptionalString(version);
  if (!normalizedVersion) return resolved;

  const url = new URL(resolved);
  url.searchParams.set('sl_avatar_v', normalizedVersion);
  return url.toString();
}

export function profilePhotoNeedsAuth(
  value: string | null | undefined,
  apiBase = 'https://app.strengthledger.fit'
): boolean {
  const resolved = resolveProfilePhotoUrl(value, apiBase);
  if (!resolved) return false;

  try {
    return new URL(resolved).origin === new URL(apiBase).origin;
  } catch {
    return false;
  }
}
