import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  roster: 'app/(tabs)/coach-roster.tsx',
  athlete: 'app/(tabs)/coach-athlete/[athleteId].tsx',
  brief: 'app/coach-team-brief.tsx',
  rootLayout: 'app/_layout.tsx',
  legacyToday: 'app/(tabs)/coach-dashboard.tsx',
  layout: 'app/(tabs)/_layout.tsx',
  index: 'app/index.tsx',
  login: 'app/login.tsx',
  settings: 'app/(tabs)/settings.tsx',
  contract: 'lib/coach-mobile.ts',
  shippingNavigation: 'lib/shipping-navigation.ts',
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [
      key,
      await readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
    ]),
  ),
);

function versionAtLeast(rawVersion, minimumVersion) {
  const parse = (value) => String(value || '').split('.').map((part) => Number(part));
  const version = parse(rawVersion);
  const minimum = parse(minimumVersion);
  if (version.some((part) => !Number.isInteger(part)) || minimum.some((part) => !Number.isInteger(part))) return false;
  for (let index = 0; index < Math.max(version.length, minimum.length); index += 1) {
    const left = version[index] || 0;
    const right = minimum[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const backendMain = await readFile(new URL('../../app/blueprints/main.py', import.meta.url), 'utf8');
const minimumRosterVersion = backendMain.match(/COACH_ROSTER_OPERATING_MODEL_MIN_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
assert(minimumRosterVersion, 'Backend coach Roster minimum app version must remain explicit.');
assert(
  versionAtLeast(appConfig.expo?.version, minimumRosterVersion),
  `Mobile app ${appConfig.expo?.version || 'unknown'} cannot consume the coach Roster contract gated at ${minimumRosterVersion}.`,
);

for (const name of ['roster', 'athlete', 'brief', 'legacyToday', 'contract']) {
  const value = source[name];
  assert(
    !value.includes("from '@/dev-mocks") && !value.includes('from "@/dev-mocks'),
    `${name} must not import DEV fixture data.`,
  );
}

assert(source.roster.includes("fetchJson('/coach/mobile/roster'"));
assert(source.roster.includes('<FlatList'));
assert(source.roster.includes('initialNumToRender={12}'));
assert(source.roster.includes('windowSize={9}'));
assert(source.roster.includes('accountKeyRef.current === requestAccountKey'));
assert(source.roster.includes('requestSequenceRef.current === requestSequence'));
assert(source.roster.includes('useFocusEffect'));
assert(source.roster.includes("AppState.addEventListener('change'"));
assert(source.roster.includes('onLongPress'));
assert(source.roster.includes('<Swipeable'));
assert(source.roster.includes('accessibilityLabel={`More actions for ${athlete.name}`}'));
assert(source.roster.includes("fetchJson('/coach-utility-dock/notes'"));
assert(source.roster.includes("pathname: '/(tabs)/coach-athlete/[athleteId]'"));
assert(source.roster.includes("pathname: '/(tabs)/messages/[threadId]'"));
assert(source.roster.includes("pathname: '/(tabs)/coach-videos'"));
assert(source.roster.includes("pathname: '/(tabs)/workout'"));
assert(source.roster.includes("pathname: '/(tabs)/workout/[workoutId]'"));
assert(source.roster.includes("pathname: '/(tabs)/check-ins'"));
assert(source.roster.includes("filter === 'all'"));
assert(source.roster.includes('stable_sort_key.localeCompare'));
assert(source.roster.includes("'Remaining Athletes'"));
assert(source.roster.includes('!workingSetIds.has(athlete.id)'));
assert(source.roster.includes("filter !== 'all' || visibleRoster.length > 0"));
assert(source.roster.includes("!error && filter !== 'all'"));
assert.deepEqual(
  [...source.roster.matchAll(/key: '(all|needs_attention|programming|reviews|messages|check_ins)'/g)]
    .map((match) => match[1]),
  ['all', 'needs_attention', 'programming', 'reviews', 'messages', 'check_ins'],
);

assert(source.athlete.includes('fetchJson<AthleteCommandSummary>(`/coach/mobile/athletes/${athleteId}/summary`'));
assert(source.athlete.includes('title="Active Coaching Queue"'));
assert(source.athlete.includes('title="Coaching Tools"'));
assert(source.athlete.includes('title="Athlete Context"'));
assert(
  source.athlete.indexOf('title="Active Coaching Queue"')
    < source.athlete.indexOf('title="Coaching Tools"'),
);
assert(
  source.athlete.indexOf('title="Coaching Tools"')
    < source.athlete.indexOf('title="Athlete Context"'),
);
assert(source.athlete.includes('accountKeyRef.current === requestAccountKey'));
assert(source.athlete.includes('useFocusEffect'));
assert(source.athlete.includes("(reason.reason_type || '').includes('readiness')"));
assert(source.athlete.includes('Array.isArray(payload.operational_status?.reasons)'));
assert(source.athlete.includes('Array.isArray(payload.pending_session_reviews?.items)'));

assert(source.brief.includes("fetchJson<CoachTeamBriefResponse>('/coach/mobile/team-brief'"));
assert(source.brief.includes('openCoachDestination(router, item.destination)'));
assert(source.brief.includes('accountKeyRef.current === requestAccountKey'));
assert(source.brief.includes('useFocusEffect'));
assert(source.brief.includes('router.canGoBack()'));
assert(source.brief.includes('router.back()'));
assert(source.brief.includes("router.replace('/(tabs)/coach-roster')"));
assert(source.rootLayout.includes("presentation: 'fullScreenModal'"));
assert(source.rootLayout.includes('name="coach-team-brief"'));
assert(source.layout.includes("router.push('/coach-team-brief' as any)"));
assert(!source.layout.includes('name="coach-team-brief"'));

assert(source.legacyToday.includes('<Redirect href="/(tabs)/coach-roster"'));
assert(!source.legacyToday.includes('fetchJson'));

for (const entry of ['index', 'login', 'settings']) {
  assert(
    source[entry].includes('/(tabs)/coach-roster'),
    `${entry} must route coach entry to Roster.`,
  );
}

for (const expected of [
  "'coach-roster': { label: 'Roster'",
  "'coach-calendar': { label: 'Calendar'",
  "'coach-videos': { label: 'Videos'",
  "'messages/index': { label: 'Messages'",
]) {
  assert(source.shippingNavigation.includes(expected), `Missing coach shipping navigation contract: ${expected}`);
}

for (const expected of [
  'name="coach-dashboard"',
  'href: null',
]) {
  assert(source.layout.includes(expected), `Missing coach navigation contract: ${expected}`);
}

assert(source.contract.includes('export type CoachAttentionReason'));
assert(source.contract.includes('resolution_policy: string'));
assert(source.contract.includes('export function openCoachDestination'));

console.log('coach mobile live contract: PASS');
