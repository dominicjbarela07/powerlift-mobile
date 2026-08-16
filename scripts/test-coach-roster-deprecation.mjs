import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { filterCoachRosterV2 } from '../lib/coach-mobile-v2.ts';
import { normalizeCoachDestination } from '../lib/coach-mobile.ts';
import { SHIPPING_COACH_TAB_ROUTES } from '../lib/shipping-navigation.ts';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const home = read('components/coach-mobile/CoachHomeV2.tsx');
const compatibilityRoute = read('app/(tabs)/coach-roster.tsx');
const invite = read('app/(tabs)/coach-invite-athlete.tsx');
const teamBrief = read('app/coach-team-brief.tsx');
const tabs = read('app/(tabs)/_layout.tsx');

assert.deepEqual(
  SHIPPING_COACH_TAB_ROUTES,
  ['coach-dashboard', 'coach-calendar', 'messages/index', 'coach-more'],
  'Coach navigation must remain Home, Calendar, Messages, More.',
);
assert.match(tabs, /name="coach-roster"[\s\S]*?href: null/);
assert.doesNotMatch(tabs, /title: 'All Athletes'/);

assert.match(compatibilityRoute, /<Redirect/);
assert.match(compatibilityRoute, /pathname: '\/\(tabs\)\/coach-dashboard'/);
assert.match(compatibilityRoute, /roster: '1'/);
assert.doesNotMatch(compatibilityRoute, /CoachRosterV2|All Athletes/);
assert.equal(existsSync(resolve(root, 'components/coach-mobile/CoachRosterV2.tsx')), false);

assert.match(home, /function CoachRosterDiscoverySheet/);
assert.match(home, /Find an Athlete/);
assert.match(home, /Search your athletes/);
assert.match(home, /<FlatList/);
assert.match(home, /initialNumToRender=\{12\}/);
assert.match(home, /windowSize=\{7\}/);
assert.match(home, /action="Find athlete"/);
assert.match(home, /<CoachAthleteHubSheet[\s\S]*?athlete=\{selectedAthlete\}/);
assert.match(home, /router\.push\('\/\(tabs\)\/coach-invite-athlete'/);
assert.doesNotMatch(home, /router\.(?:push|replace)\([^\n]*coach-roster/);

assert.match(invite, /Back to Coach Home/);
assert.match(invite, /pathname: '\/\(tabs\)\/coach-dashboard'[\s\S]*?roster: '1'/);
assert.doesNotMatch(teamBrief, /pathname: '\/\(tabs\)\/coach-roster'/);

assert.deepEqual(
  normalizeCoachDestination({
    route: '/(tabs)/coach-roster',
    params: { filter: 'programming' },
  }),
  {
    route: '/(tabs)/coach-dashboard',
    params: { filter: 'programming' },
  },
  'Backend and notification-era roster destinations must resolve into Coach Home.',
);

const roster = Array.from({ length: 35 }, (_, index) => ({
  id: index + 1,
  name: index === 34 ? 'Target Athlete' : `Athlete ${String(index + 1).padStart(2, '0')}`,
  status: { classification: index % 5 === 0 ? 'needs_attention' : 'on_track' },
  queue_membership: index % 5 === 0 ? ['all', 'needs_attention'] : ['all'],
  current_training: { status: index % 2 === 0 ? 'active' : 'no_active_program' },
}));
assert.equal(filterCoachRosterV2(roster, 'all').length, 35);
assert.equal(filterCoachRosterV2(roster, 'all', 'target').length, 1);
assert.ok(filterCoachRosterV2(roster, 'needs_attention').length > 0);

console.log('Coach roster deprecation, compatibility redirect, and large-roster discovery checks passed.');
