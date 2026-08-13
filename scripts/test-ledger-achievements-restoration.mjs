import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const achievements = read('components/ledger/AchievementsExperience.tsx');
const rewards = read('lib/ledger-rewards.ts');
const data = read('lib/ledger-data.ts');
const route = read('components/ledger/route-screen.tsx');
const index = read('components/ledger/v2/index-screen.tsx');
const journey = read('components/ledger/v2/journey-screen.tsx');
const strength = read('components/ledger/v2/strength-screen.tsx');
const archive = read('components/ledger/v2/archive-screen.tsx');

for (const section of ['hub', 'milestones', 'clubs', 'trophies', 'medallions', 'volume', 'prs', 'streaks']) {
  assert.match(achievements, new RegExp(`${section}:`), `${section} remains a first-class Achievements section`);
}

for (const marker of [
  'ledger-achievements-hub',
  'ledger-total-clubs',
  'ledger-trophy-cabinet',
  'ledger-medallion-gallery',
  'ledger-pr-history',
  'VolumeAchievementExperience',
  'resolvePlateStackRender',
  'resolveMilestoneRenderAsset',
  'SL_TOTAL_TROPHY_ASSETS',
  'majorVolumeMedallionAsset',
]) assert.match(achievements, new RegExp(marker));

assert.match(route, /screen === 'achievements'[\s\S]*LedgerAchievementsRoom/);
assert.match(route, /<AchievementsExperience/);
assert.match(route, /LedgerJourneyV2Screen/);
assert.match(route, /LedgerStrengthV2Screen/);
assert.match(route, /LedgerArchiveV2Screen/);
assert.doesNotMatch(route, /accessory-picker|custom-accessory|muscle-first/i);

assert.match(data, /fetchLedgerAccomplishmentHistory[\s\S]*fetchLedgerAccomplishmentPage\(50, cursor\)/);
assert.match(rewards, /event\.evidence\?\.\[key\]/, 'medallions use stored accomplishment evidence');
assert.match(rewards, /isMajorVolumeMedallionThresholdLb/, 'unknown medallion thresholds are rejected');
assert.match(rewards, /lifts\.length === 3/, 'Total Club state requires all canonical lift PRs');
assert.doesNotMatch(rewards, /Date\.now|new Date\(\)/, 'reward projection does not manufacture chronology');

assert.match(index, /Achievements[\s\S]*\/\(tabs\)\/ledger\/achievements/);
assert.match(journey, /\/\(tabs\)\/ledger\/archive\/set/);
assert.match(strength, /\/\(tabs\)\/ledger\/achievements\//);
assert.match(strength, /\/\(tabs\)\/ledger\/archive\/set/);
assert.match(archive, /ledger-v2-archive-detail/);

for (const assetPath of [
  'assets/images/lift-icons/achievement-material-v2/squat.png',
  'assets/images/lift-icons/achievement-material-v2/bench.png',
  'assets/images/lift-icons/achievement-material-v2/deadlift.png',
  'assets/images/total-tier-obsidian.png',
  'assets/images/major-volume-medallions/total/total-1m.png',
  'assets/images/milestone-renders/plate-club-material-v2/squat-405.png',
  'assets/images/plate-stack-catalog/blender-cycles-catalog-v1/lb/400.png',
  'assets/images/volume-achievements/1m-international-space-station.webp',
]) assert.ok(exists(assetPath), `release asset exists: ${assetPath}`);

assert.match(achievements, /legacyTab === 'streaks'/, 'legacy streak deep links remain supported');
assert.match(achievements, /legacyTab === 'milestones'/, 'legacy milestone deep links remain supported');
assert.doesNotMatch(achievements, /earnedAt:|earned_at:\s*new|occurred_at:\s*new/, 'UI does not fabricate earned dates');

console.log('[ledger achievements release] restored families, V2 cross-links, canonical evidence, assets, and isolation passed');
