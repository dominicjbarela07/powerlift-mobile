import type { ImageSourcePropType } from 'react-native';

export type SessionRecapHighlightKind = 'pr' | 'prescription' | 'streak';

const HIGHLIGHT_ASSETS: Readonly<Record<SessionRecapHighlightKind, ImageSourcePropType>> = {
  pr: require('@/assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png'),
  prescription: require('@/assets/images/ledger-index-v2/ledger-career-sets-counter-v1.png'),
  streak: require('@/assets/images/session-recap/session-streak-medallion-v1.png'),
};

const VIDEO_FIXTURE_ASSETS: Readonly<Record<string, ImageSourcePropType>> = {
  'competition-squat': require('@/assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png'),
  hinge: require('@/assets/images/gym_vibe.jpg'),
  machine: require('@/assets/images/gym_vibe.jpg'),
};

export const SESSION_RECAP_ARCHIVE_ART = require('@/assets/images/post-session-ledger-concept-v1.png') as ImageSourcePropType;
export const SESSION_PR_CREST_ART = require('@/assets/images/session-recap/session-pr-crest-v1.png') as ImageSourcePropType;

export function sessionRecapHighlightAsset(kind: SessionRecapHighlightKind): ImageSourcePropType {
  return HIGHLIGHT_ASSETS[kind];
}

export function sessionRecapVideoFixtureAsset(uri?: string | null): ImageSourcePropType | null {
  const key = String(uri || '').trim().replace(/^sl-fixture:\/\/session-review\//, '');
  return VIDEO_FIXTURE_ASSETS[key] || null;
}
