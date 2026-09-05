import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const achievements = read('components/ledger/AchievementsExperience.tsx');
const rewards = read('lib/ledger-rewards.ts');
const data = read('lib/ledger-data.ts');
const index = read('components/ledger/index-experience.tsx');
const journey = read('components/ledger/journey-moments.ts');
const strength = read('components/ledger/experiences.tsx');
const routeScreen = read('components/ledger/route-screen.tsx');

for (const section of ['hub', 'milestones', 'clubs', 'trophies', 'medallions', 'volume', 'prs', 'streaks']) {
  assert.match(achievements, new RegExp(`${section}:`), `${section} remains a first-class Achievements section`);
}

assert.match(achievements, /ledger-achievements-hub/);
assert.match(achievements, /ledger-total-clubs/);
assert.match(achievements, /ledger-trophy-cabinet/);
assert.match(achievements, /ledger-medallion-gallery/);
assert.match(achievements, /VolumeAchievementExperience/);
assert.match(achievements, /ledger-pr-history/);
assert.match(achievements, /resolvePlateStackRender/);
assert.match(achievements, /strengthTierState/);
assert.match(achievements, /supportedStrengthStandard/);
assert.match(achievements, /actual_percentile/);
assert.match(achievements, /verified male or female strength standard/);
assert.match(achievements, /SL_TOTAL_TROPHY_ASSETS/);
assert.match(achievements, /majorVolumeMedallionAsset/);

assert.match(data, /fetchLedgerAccomplishmentHistory[\s\S]*fetchLedgerAccomplishmentPage\(50, cursor\)/);
assert.match(rewards, /event\.evidence\?\.\[key\]/, 'medallions use stored accomplishment evidence');
assert.match(rewards, /isMajorVolumeMedallionThresholdLb/, 'unknown medallion thresholds are rejected');
assert.match(rewards, /lifts\.length === 3/, 'Total Club state requires all canonical lift PRs');
assert.match(rewards, /canonicalCompetitionLiftKey\(item\.core_movement_key\)/, 'strength tiers use exact governed competition-lift identity');
assert.match(rewards, /STRENGTH_KG_TO_LB/, 'pounds remain a display projection of canonical kilograms');
assert.doesNotMatch(rewards, /Date\.now|new Date\(\)/, 'reward projection does not manufacture chronology');

assert.match(index, /room: 'achievements'/);
assert.match(index, /chapter\.room === 'achievements'/);
assert.match(index, /LEDGER_INDEX_ASSETS\.careerPr/, 'Index PR count uses its distinct record artifact rather than a volume medallion');
assert.match(index, /openRoom\('achievements'\)/, 'Index still links into the complete restored achievement system');
assert.match(journey, /type: 'volume-milestone'/);
assert.match(journey, /MEDALLIONS_HREF/);
assert.match(strength, /ledger-strength-milestone-link/);
assert.match(strength, /resolvePlateStackRender/);
assert.match(routeScreen, /screen === 'achievements'/);

assert.match(achievements, /legacyTab === 'streaks'/, 'legacy streak deep links remain supported');
assert.match(achievements, /legacyTab === 'milestones'/, 'legacy milestone deep links remain supported');
assert.doesNotMatch(achievements, /earnedAt:|earned_at:\s*new|occurred_at:\s*new/, 'UI does not fabricate earned dates');

console.log('[ledger achievements] hub, approved artifact families, canonical history, cross-links, and legacy deep links passed');
