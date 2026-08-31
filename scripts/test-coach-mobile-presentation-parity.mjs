import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [shell, appHeader, ui, home, hubSheet, rosterRoute, hub, detail] = await Promise.all([
  read('app/(tabs)/_layout.tsx'),
  read('components/navigation/StrengthLedgerAppHeader.tsx'),
  read('components/coach-mobile/coach-mobile-v2-ui.tsx'),
  read('components/coach-mobile/CoachHomeV2.tsx'),
  read('components/coach-mobile/CoachAthleteHubSheet.tsx'),
  read('app/(tabs)/coach-roster.tsx'),
  read('components/coach-mobile/CoachAthleteHubV2.tsx'),
  read('components/coach-mobile/CoachAttentionDetailV2.tsx'),
]);

const tabScene = shell.match(/tabScene:\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(tabScene, /(?:margin|padding)(?:Horizontal|Left|Right|Start|End)?\s*:/, 'The tab scene must provide a full-width page canvas.');
assert.match(shell, /<StrengthLedgerAppHeader/);
assert.match(appHeader, /contentHeight: 42/);
assert.match(appHeader, /controlSize: 40/);
assert.match(appHeader, /brandWidth: 110/);
assert.match(appHeader, /brandHeight: 22/);
assert.match(appHeader, /paddingTop: Math\.max\(0, topInset\)/);
const coachDashboardOptions = shell.match(/name="coach-dashboard"[\s\S]*?<Tabs\.Screen/)?.[0] || '';
assert.doesNotMatch(coachDashboardOptions, /headerShown:\s*false/, 'Coach Home must use the same compact Tabs header as Coach Calendar.');
assert.match(shell, /rightAction=\{viewMode === 'coach' \? \{[\s\S]*accessibilityLabel: 'Open Team Brief'[\s\S]*icon: 'reader-outline'[\s\S]*router\.push\('\/coach-team-brief'/);
assert.doesNotMatch(shell, /isCoachHomePath|accessibilityLabel: 'Open Coach Calendar'/, 'Coach mode must never replace Team Brief with a route-specific header action.');
assert.match(home, /<SLScreen edges="none"/);
assert.doesNotMatch(home, /CoachBrandHeader/);
assert.doesNotMatch(ui, /CoachBrandHeader/);
for (const screen of [home, hub, detail]) {
  assert.doesNotMatch(screen, /content:\s*\{[^}]*paddingHorizontal/s, 'Coach screen roots must remain full width.');
  assert.match(screen, /backgroundColor: COACH_V2\.black/, 'Coach V2 screens must retain OLED black.');
  assert.doesNotMatch(screen, /BlurView|glassmorphism/i);
}

for (const color of ['#000000', '#9D5CFF', '#FF4767', '#F3B83E', '#55D68A', '#48C7FF']) {
  assert.match(ui, new RegExp(color));
}
assert.match(ui, /plate-stack-studio-v2\/mobile-hero-240x160@3x\/squat-405\.png/);
assert.match(home, /size=\{43\}/);
assert.match(home, /width: 155/);
assert.match(hub, /size=\{70\}/);
assert.match(home, /Your Athletes at a Glance/);
assert.match(home, /Today’s Sessions/);
assert.match(home, /Recent Activity Feed/);
assert.match(home, /horizontal showsHorizontalScrollIndicator=\{false\}/);
assert.match(home, /<CoachAthleteHubSheet[\s\S]*?athlete=\{selectedAthlete\}/);
assert.match(home, /<CoachRosterDiscoverySheet/);
assert.match(home, /Find an Athlete/);
assert.match(home, /Search your athletes/);
assert.match(rosterRoute, /<Redirect/);
assert.doesNotMatch(rosterRoute, /CoachRosterV2|All Athletes/);
assert.match(hub, /label: 'Message'[\s\S]*label: 'Program'[\s\S]*label: 'Review'[\s\S]*label: 'More'/);
assert.match(hubSheet, /size=\{82\}/);
assert.match(hubSheet, /<StrengthLedgerBottomSheet accessibilityLabel="Athlete Hub" onDismiss=\{closeSheet\} visible>/);
assert.match(hubSheet, /style=\{styles\.hero\}/);
assert.doesNotMatch(hubSheet, /dragResponder|PanResponder|dragArea/, 'Athlete Hub must use the canonical shared bottom-sheet dismissal owner.');
assert.match(hubSheet, /Current Status/);
assert.match(hubSheet, /Last Session/);
assert.match(hubSheet, /Upcoming Sessions/);
assert.match(hubSheet, /Recent Activity/);
assert.match(hubSheet, /Recent Highlights/);
assert.match(hubSheet, /Notes & Next Steps/);
assert.match(hubSheet, /performed_movements/);
assert.doesNotMatch(hubSheet, /@\/dev-mocks\//);
assert.match(detail, /styles\.primaryButton/);
assert.match(detail, /styles\.secondaryButton/);
assert.match(shell, /forceExpandedCoachNavigation/);
assert.match(shell, /name="coach-roster"[\s\S]*?href: null/);
assert.doesNotMatch(shell, /title: 'All Athletes'/);
assert.match(shell, /name="coach-calendar"[\s\S]*?\/\(tabs\)\/coach-calendar/);

const hierarchy = ['What Needs You', 'Current Training', 'Recent Signals', 'Recent Training'];
for (let index = 1; index < hierarchy.length; index += 1) {
  assert.ok(hub.indexOf(hierarchy[index - 1]) < hub.indexOf(hierarchy[index]), `${hierarchy[index - 1]} must precede ${hierarchy[index]}.`);
}

console.log('Coach mobile athlete-first V2 presentation parity checks passed.');
