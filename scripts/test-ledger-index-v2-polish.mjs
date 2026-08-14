import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = await readFile(path.join(root, 'components/ledger/index-experience.tsx'), 'utf8');
const assets = await readFile(path.join(root, 'lib/ledger-index-assets.ts'), 'utf8');

for (const marker of [
  "normalized.includes('squat')",
  "normalized.includes('bench')",
  "normalized.includes('deadlift')",
  'LEDGER_INDEX_ASSETS.coreLift.squat',
  'LEDGER_INDEX_ASSETS.coreLift.bench',
  'LEDGER_INDEX_ASSETS.coreLift.deadlift',
]) assert.match(assets, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing semantic core-lift asset marker: ${marker}`);

assert.doesNotMatch(index, /resolvePlateStackRender|plateArtwork|fallbackPlate/, 'Index concepts must not resolve through load-only artwork');
assert.match(index, /liftArtworkFallback[\s\S]*barbell-outline/, 'a genuinely unknown core family retains a safe neutral fallback');
assert.match(index, /careerSets/, 'Sets uses purpose-built logged-work artwork');
assert.match(index, /careerPr/, 'PR count uses purpose-built record artwork');
assert.match(index, /SL_TOTAL_TROPHY_ASSETS/, 'Achievements retain the approved trophy system');

assert.match(index, /eventReps[\s\S]*actual_reps[\s\S]*rep_count/, 'performed reps come from structured canonical evidence');
assert.match(index, /source_set_log_id \? `set:\$\{event\.source_set_log_id\}`/, 'same-performance PR evidence is grouped by source SetLog');
assert.match(index, /PR_SIGNIFICANCE[\s\S]*comparePrEvents/, 'PR hero ordering uses explicit canonical significance');
assert.match(index, /<RecentPrCard hero/, 'Recent PRs have one prominent hero');
assert.match(index, /No personal records yet\./, 'no-PR state is deliberate');
assert.match(index, /source_set_log_id \? router\.push\(`\/\(tabs\)\/ledger\/archive\/set\//, 'PRs navigate to source evidence');
assert.match(index, /typeof event\.prior_value === 'number'[\s\S]*priorValue != null && delta != null/, 'comparisons require canonical prior evidence and numeric deltas');
assert.match(index, /NEW PERSONAL RECORD|BLOCK BEST/, 'missing comparisons use truthful non-comparative language');

assert.match(index, /LatestEntryArtwork[\s\S]*accessoryMuscleRegionAsset/, 'Latest Entry uses governed movement-region anatomy');
assert.match(index, /entry\?\.movement\?\.family[\s\S]*accessoryMuscleRegion/, 'Latest Entry retains Journey-family semantics when exploration matching is unavailable');
assert.match(index, /coreLift === 'squat' \? 'quads'[\s\S]*coreLift === 'bench' \? 'chest'[\s\S]*coreLift === 'deadlift' \? 'hamstrings'/, 'core Latest Entries resolve to their semantic muscle-region family before generic fallbacks');
assert.match(index, /fallbackEvent\?\.movement_label[\s\S]*fallbackEvent\?\.core_movement_key/, 'Latest Entry retains accomplishment identity when the Journey projection is unavailable');
assert.match(index, /loadConvention === 'assistance_load'/, 'assisted loads are labeled from canonical semantics');
for (const forbidden of ['stable movement identity', 'canonical identity', 'reconciliation', 'movement session completed', 'prescription completed', 'identity snapshot', 'source definition']) {
  assert.doesNotMatch(index, new RegExp(forbidden, 'i'), `athlete-facing Index leaked internal term: ${forbidden}`);
}

for (const marker of [
  'CURRENT BLOCK',
  'VOLUME · COMPLETED WEEK',
  'TRAINING FREQUENCY',
  'REPORTED BODYWEIGHT',
  'READINESS TREND',
  'Last 8 completed weeks',
  'No adjacent-week comparison',
]) assert.match(index, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing truthful context marker: ${marker}`);

assert.match(index, /point\.date < currentMonday/, 'partial current calendar week is excluded from volume comparisons');
assert.match(index, /=== 7 \* 86_400_000/, 'volume deltas require adjacent seven-day buckets');
assert.doesNotMatch(index, /context\?\.bodyweight_kg/, 'profile bodyweight cannot substitute for reported observations');
assert.match(index, /useLedgerLiveData\('1y'/, 'Index accomplishment/progression projection remains bounded');
assert.doesNotMatch(index, /fetchLedgerAccomplishmentHistory/, 'Index cannot download the lifetime accomplishment archive');
assert.match(index, /chart\.some\(\(value\) => value > 0\)/, 'zero-history athletes receive an intentional chart state instead of decorative bars');

for (const storyboardValue of ['385 LB × 3', '18.5K LB', '190', '+8% vs last 7 days']) {
  assert.doesNotMatch(index, new RegExp(storyboardValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `hard-coded storyboard value leaked: ${storyboardValue}`);
}

console.log('[ledger-index-v2-polish] semantic assets, bounded evidence, PR grouping, sparse states, and comparison windows passed');
