import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const data = read('lib/ledger-data.ts');
const identity = read('lib/strength-standard-identity.ts');
const rewards = read('lib/ledger-rewards.ts');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const strength = read('components/ledger/experiences.tsx');
const index = read('components/ledger/index-experience.tsx');
const liveData = read('components/ledger/use-ledger-live-data.ts');
const certification = read('app/dev-strength-tier-certification.tsx');
const fixture = read('dev-mocks/fixtures/strength-tier.ts');

assert.match(data, /strength_standard\?: StrengthStandardProjection/, 'progression payload must carry the governed standard');
assert.match(data, /strength_standing\?: StrengthStandingProjection/, 'current-best payload must carry the server-owned standing');
assert.match(identity, /normalized === 'competition_squat'/);
assert.match(identity, /normalized === 'competition_bench'/);
assert.match(identity, /normalized === 'competition_deadlift'/);

assert.match(rewards, /opl_2026_09_04_b8b9bf6e_v1/, 'the active standard version must be explicit');
assert.match(rewards, /STRENGTH_KG_TO_LB = 2\.2046226218/, 'display conversion must use the governed constant');
assert.match(rewards, /canonicalCompetitionLiftKey\(item\.core_movement_key\)/, 'tier evidence must use exact governed IDs');
assert.doesNotMatch(rewards, /movement_label/, 'tier evidence must never fall back to a display label');
assert.match(rewards, /lifts\.reduce\(\(sum, lift\) => sum \+ lift\.weightKg/, 'Total must sum canonical kg without a lb round trip');
assert.match(rewards, /candidate\.sex !== 'M' && candidate\.sex !== 'F'/, 'unknown sex must fail closed');
assert.match(rewards, /tier\.threshold_kg <= currentKg/, 'all tier comparisons must happen in canonical kg');
assert.match(rewards, /projectedStrengthTierState/, 'clients must consume the server-owned tier state');
assert.doesNotMatch(rewards, /TOTAL_CLUB_THRESHOLDS|CORE_LIFT_MILESTONE_THRESHOLDS/, 'legacy arbitrary ladders must not remain active');

for (const [surface, source] of [['Strength', strength], ['Ledger index', index]]) {
  assert.match(source, /supportedStrengthStandard/, `${surface} must reject unsupported standard projections`);
}
assert.match(achievements, /resolveLedgerClubsRuntimeState\(/, 'Achievements must resolve the governed live Clubs projection');
assert.match(rewards, /projectedStrengthTierState\(standing\?\.metrics\[key\]/, 'per-lift achievement rows must prefer the server projection');
assert.match(rewards, /projectedStrengthTierState\(standing\?\.metrics\.total/, 'Total trophies must prefer the server projection');
assert.match(achievements, /strengthTierRoman\(tier\.tier\)/, 'achievement cards must show Tier I–VII names');
assert.match(achievements, /OpenPowerlifting reference cohort/, 'Clubs must explain the competitive percentile cohort');
assert.match(achievements, /actual_percentile/, 'achievement details must explain cohort position');
assert.match(achievements, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.6\} style=\{styles\.heroTierTitle\}/, 'long Tier VII titles must remain on one line so the current total stays visible');
assert.match(achievements, /numberOfLines=\{nextTotalTier \? 1 : 2\}/, 'the terminal Tier VII completion label must be allowed to wrap instead of truncating');
assert.match(achievements, /Highest tier reached/, 'terminal status copy must fit the compact next-tier column');
assert.match(strength, /CURRENT STRENGTH TIER/);
assert.match(strength, /exact governed competition-lift Weight PR/);
assert.match(strength, /will not guess/, 'unsupported athlete identity must be explained rather than inferred');
assert.match(liveData, /const fixture = __DEV__ \? options\.fixture : undefined/, 'visual evidence injection must remain DEV-only');
assert.match(liveData, /setStrengthStanding\(nextCurrentBests\.strengthStanding\)/, 'live data must retain the server-owned standing');
assert.match(certification, /<AchievementsExperience devFixture=\{fixture\}/, 'DEV certification must render the real Achievements surface');
assert.match(certification, /if \(!__DEV__\) return null/, 'certification route must fail closed outside DEV');
assert.match(certification, /scenario === 'below' \|\| scenario === 'tier7'/, 'certification must expose below-Tier-I and Tier-VII states');
assert.match(fixture, /below: \[140, 90, 170\]/, 'male below-Tier-I visual evidence must be deterministic');
assert.match(fixture, /tier7: \[190, 110, 210\]/, 'female Tier-VII visual evidence must be deterministic');

console.log('[data-driven strength tiers] governed payload, exact evidence, canonical kg resolver, fail-closed identity, and mobile surfaces passed');
