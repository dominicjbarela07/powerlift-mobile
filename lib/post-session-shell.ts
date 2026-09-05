export type PostSessionTabKey = 'overview' | 'performed' | 'personal_bests' | 'plan' | 'coach';

export type PostSessionTab = {
  key: PostSessionTabKey;
  label: string;
};

export function buildPostSessionTabs({
  viewerMode,
  hasPersonalBests,
}: {
  viewerMode: 'athlete' | 'coach';
  hasPersonalBests: boolean;
}): PostSessionTab[] {
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'performed', label: 'Performed' },
    { key: 'plan', label: 'Plan / Compare' },
    ...(hasPersonalBests ? [{ key: 'personal_bests' as const, label: 'Personal Bests' }] : []),
    ...(viewerMode === 'coach' ? [{ key: 'coach' as const, label: 'Coach' }] : []),
  ];
}
