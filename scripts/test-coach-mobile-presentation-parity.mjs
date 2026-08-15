import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [shell, ui, home, hubSheet, roster, hub, detail] = await Promise.all([
  read('app/(tabs)/_layout.tsx'),
  read('components/coach-mobile/coach-mobile-v2-ui.tsx'),
  read('components/coach-mobile/CoachHomeV2.tsx'),
  read('components/coach-mobile/CoachAthleteHubSheet.tsx'),
  read('components/coach-mobile/CoachRosterV2.tsx'),
  read('components/coach-mobile/CoachAthleteHubV2.tsx'),
  read('components/coach-mobile/CoachAttentionDetailV2.tsx'),
]);

assert.match(shell, /tabScene:[\s\S]*paddingHorizontal: SLLayout\.screenGutter/);
for (const screen of [home, roster, hub, detail]) {
  assert.doesNotMatch(screen, /content:\s*\{[^}]*paddingHorizontal/s, 'The shared shell must remain the only page-gutter owner.');
  assert.match(screen, /backgroundColor: COACH_V2\.black/, 'Coach V2 screens must retain OLED black.');
  assert.doesNotMatch(screen, /BlurView|glassmorphism/i);
}

for (const color of ['#000000', '#9D5CFF', '#FF4767', '#F3B83E', '#55D68A', '#48C7FF']) {
  assert.match(ui, new RegExp(color));
}
assert.match(ui, /plate-stack-studio-v2\/mobile-hero-240x160@3x\/squat-405\.png/);
assert.match(home, /size=\{43\}/);
assert.match(home, /width: 155/);
assert.match(roster, /size=\{48\}/);
assert.match(hub, /size=\{70\}/);
assert.match(home, /Your Athletes at a Glance/);
assert.match(home, /Today’s Sessions/);
assert.match(home, /Recent Activity Feed/);
assert.match(home, /horizontal showsHorizontalScrollIndicator=\{false\}/);
assert.match(home, /<CoachAthleteHubSheet[\s\S]*?athlete=\{selectedAthlete\}/);
assert.match(roster, /title="All Athletes"/);
assert.match(roster, /router\.canGoBack\(\)[\s\S]*router\.back\(\)/);
assert.match(hub, /label: 'Message'[\s\S]*label: 'Program'[\s\S]*label: 'Review'[\s\S]*label: 'More'/);
assert.match(hubSheet, /size=\{82\}/);
assert.match(hubSheet, /style=\{styles\.hero\}[\s\S]*?dragResponder\.panHandlers/);
assert.doesNotMatch(hubSheet, /dragArea/);
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
assert.match(shell, /name="coach-calendar"[\s\S]*?\/\(tabs\)\/coach-calendar/);

const hierarchy = ['What Needs You', 'Current Training', 'Recent Signals', 'Recent Training'];
for (let index = 1; index < hierarchy.length; index += 1) {
  assert.ok(hub.indexOf(hierarchy[index - 1]) < hub.indexOf(hierarchy[index]), `${hierarchy[index - 1]} must precede ${hierarchy[index]}.`);
}

console.log('Coach mobile athlete-first V2 presentation parity checks passed.');
