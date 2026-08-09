import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  STREAK_PLATFORM_BASE_HEIGHT,
  STREAK_PLATFORM_RISE,
  streakPlatformBaseHeightForWidth,
  streakPlatformDeckHeight,
  streakPlatformHeight,
  streakPlatformRiseForWidth,
} from '../lib/streak-path-layout.ts';

const root = resolve(import.meta.dirname, '..');
const screen = readFileSync(resolve(root, 'app/(tabs)/dev-mocks/milestones.tsx'), 'utf8');
const streakStart = screen.indexOf('const STREAK_PRESENTATIONS =');
const streakEnd = screen.indexOf('const LB_TOTAL_TROPHY_TIERS');
const streakData = screen.slice(streakStart, streakEnd);
const streakComponentStart = screen.indexOf('function StreakRow');
const streakComponentEnd = screen.indexOf('export default function MilestonesMockScreen');
const streakComponent = screen.slice(streakComponentStart, streakComponentEnd);

assert.deepEqual(STREAK_PLATFORM_RISE, { compact: 5, standard: 6, proMax: 7 });
assert.deepEqual(STREAK_PLATFORM_BASE_HEIGHT, { compact: 24, standard: 26, proMax: 28 });
assert.equal(streakPlatformRiseForWidth(370), 5);
assert.equal(streakPlatformRiseForWidth(390), 6);
assert.equal(streakPlatformRiseForWidth(430), 7);
assert.equal(streakPlatformBaseHeightForWidth(370), 24);
assert.equal(streakPlatformBaseHeightForWidth(390), 26);
assert.equal(streakPlatformBaseHeightForWidth(430), 28);
assert.deepEqual([0, 1, 2, 3, 4].map((index) => streakPlatformHeight(index, 5, 26, 6)), [26, 32, 38, 44, 50]);
assert.equal(streakPlatformDeckHeight(6, 28, 7), 63);

for (const category of ['Longest Session Streak', 'Longest Weekly Streak', 'Highest Weekly Compliance', 'Perfect Weeks']) {
  assert.match(streakData, new RegExp(`title: '${category}'`), `${category} must remain in the canonical-data presentation policy`);
}
assert.equal((streakData.match(/title: '/g) ?? []).length, 4, 'only streak families derivable from canonical progression may render');
assert.doesNotMatch(streakData, /value:/, 'streak presentation policy must not embed athlete values');
assert.match(screen, /const liveStreaks = STREAK_PRESENTATIONS\.flatMap/, 'streak values must derive from canonical consistency evidence');
assert.match(streakData, /thresholds: \[5, 10, 15, 25, 50, 75\]/, 'session ladder must match the supplied reference');
assert.match(streakData, /thresholds: \[4, 8, 12, 16, 20, 26\]/, 'weekly ladder must match the supplied reference');
assert.match(streakData, /thresholds: \[50, 60, 70, 80, 90, 100\]/, 'compliance ladder must match the supplied reference');
assert.match(streakData, /thresholds: \[1, 5, 10, 25, 50, 100\]/, 'perfect-week thresholds must remain unchanged');

assert.match(streakComponent, /streakPlatformHeight\(index, item\.thresholds\.length, platformBaseHeight, platformRise\)/, 'each platform must rise above the preceding platform');
assert.match(streakComponent, /threshold === bestThreshold/, 'the current marker must remain the highest earned threshold');
assert.match(streakComponent, /styles\.streakPlatform/, 'the path must use the reference-style stepped platforms');
assert.doesNotMatch(streakComponent, /streakConnectorIncoming|streakConnectorRise|streakCircle/, 'the rejected circle-and-rail treatment must not remain');
assert.match(streakComponent, /state === 'locked' \? <Ionicons name="lock-closed"/, 'future steps must remain visibly locked');
assert.match(streakComponent, /numberOfLines=\{1\} style=\{\[styles\.streakPlatformValue/, 'threshold labels must use the compact fixed reference scale');
assert.match(streakComponent, /★ CAREER BEST/, 'one compact career-best stamp must remain');
assert.match(streakComponent, />BEST</, 'the reference best-value box must remain in the upper-right');
assert.doesNotMatch(streakComponent, /Every step is earned\.|Consistency compounds/, 'the removed footer card must not return');
assert.doesNotMatch(streakComponent, /StreakEvidence|Completed session strip|Completed week blocks|Weekly compliance progression|Perfect week checks|Completed block stack/, 'invented evidence widgets must be removed');
assert.doesNotMatch(streakComponent, /LinearGradient|RadialGradient|ConicGradient/, 'Streaks must not add gradients');

assert.match(screen, /\{tab === 'milestones' \? <Pressable[\s\S]*?style=\{\[styles\.navButton, styles\.unitControl\]\}/, 'the LB/KG control must be limited to the Milestones tab');
assert.match(screen, /streakValue: \{[\s\S]*?fontFamily: SLFontFamilies\.numeric/, 'streak values must use the numeric family');
assert.match(screen, /streakTitle: \{[\s\S]*?\.\.\.SLTypography\.bodyStrong/, 'streak titles must use the shared strong-body family');
assert.match(screen, /careerBestLabel: \{[\s\S]*?\.\.\.SLTypography\.micro/, 'career-best words must use the shared micro label family');
assert.match(screen, /streakContent: \{ gap: 18,/, 'cards must retain the approved expanded vertical separation');
assert.match(screen, /streakCard: \{[\s\S]*?paddingTop: 16, paddingBottom: 12,/, 'cards must retain top and bottom breathing room');
assert.match(screen, /streakCard: \{[^}]*backgroundColor: 'transparent'/, 'streak card shells must match the transparent Strength PR card surface');
assert.match(screen, /streakPlatformDeck: \{[\s\S]*?marginTop: 7, marginHorizontal: 16,/, 'the stair path must remain separated and inset from card edges');
assert.match(screen, /streakBest: \{[\s\S]*?marginLeft: 4,/, 'the BEST box must remain separated from the title block');

console.log('[streak-achievements] reference-style stepped platforms, canonical values, responsive geometry, typography, and composition guards passed');
