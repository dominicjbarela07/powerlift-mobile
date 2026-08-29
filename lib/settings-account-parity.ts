import type { MobileViewMode } from '@/lib/mobileViewMode';

export const SETTINGS_CAPABILITY_CLASSIFICATION = {
  sharedAccount: [
    'identity',
    'profile_photo',
    'account_type',
    'account_access',
    'privacy',
    'support',
    'security',
    'account_actions',
  ],
  personalAthlete: [
    'profile_details',
    'preferred_units',
    'training_maxes',
    'training_context',
    'timezone',
    'connected_coach',
  ],
  coachOperational: ['video_submission_notifications'],
  modeNavigation: ['mobile_mode'],
} as const;

export function resolveSettingsIdentityName({
  personalProfileName,
  accountName,
  email,
}: {
  personalProfileName?: string | null;
  accountName?: string | null;
  email?: string | null;
}): string {
  return (
    String(personalProfileName || '').trim() ||
    String(accountName || '').trim() ||
    String(email || '').trim() ||
    'Strength Ledger'
  );
}

export function resolvePersonalTrainingProfileMode({
  activeMode,
  availableModes,
}: {
  activeMode: MobileViewMode;
  availableModes: MobileViewMode[];
}): MobileViewMode | null {
  if (activeMode === 'individual') return 'individual';
  if (activeMode === 'athlete') return 'athlete';
  return availableModes.includes('athlete') ? 'athlete' : null;
}

export function personalTrainingProfileHeaders(mode: MobileViewMode | null): Record<string, string> | undefined {
  if (!mode) return undefined;
  return { 'X-Strength-Ledger-Mobile-Mode': mode };
}
