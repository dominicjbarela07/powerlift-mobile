export type SessionNoteProfile = {
  name: string;
  profilePhotoUrl: string | null;
  profilePhotoVersion: string | null;
  kind: 'coach' | 'self';
};

type CoachIdentity = {
  name?: string | null;
  avatar_url?: string | null;
  avatar_uploaded_at?: string | null;
} | null | undefined;

type AthleteIdentity = {
  name?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
} | null | undefined;

type SelfUserIdentity = {
  user_name?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
} | null | undefined;

export function resolveSessionNoteAuthor({
  isSelfCoached,
  coach,
  athlete,
  selfUser,
}: {
  isSelfCoached: boolean;
  coach?: CoachIdentity;
  athlete?: AthleteIdentity;
  selfUser?: SelfUserIdentity;
}): SessionNoteProfile {
  if (isSelfCoached) {
    return {
      kind: 'self',
      name: String(selfUser?.user_name || athlete?.name || 'Athlete'),
      profilePhotoUrl: selfUser?.profilePhotoUrl || athlete?.profilePhotoUrl || null,
      profilePhotoVersion: selfUser?.profilePhotoVersion || athlete?.profilePhotoVersion || null,
    };
  }

  return {
    kind: 'coach',
    name: String(coach?.name || 'Coach'),
    profilePhotoUrl: coach?.avatar_url || null,
    profilePhotoVersion: coach?.avatar_uploaded_at || null,
  };
}
