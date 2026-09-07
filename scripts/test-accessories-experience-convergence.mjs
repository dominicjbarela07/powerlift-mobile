import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const experience = read('components/ledger/AccessoriesExperience.tsx');
const route = read('components/ledger/route-screen.tsx');
const exploration = read('components/ledger/exploration-experiences.tsx');
const client = read('lib/ledger-exploration.ts');
const archive = read('components/ledger/archive-foundation.tsx');
const movementHistory = read('components/movement-history/CanonicalMovementHistoryScreen.tsx');
const backend = read('../app/services/ledger_archive.py');
const engineeringDirective = read('../AGENTS.md');

assert.match(route, /screen === 'accessories'[\s\S]*<AccessoriesExperience/,
  'The shipping Accessories route must use the dedicated continuous experience.');
assert.doesNotMatch(experience, /Overview[\s|/]+By Muscle[\s|/]+History|<SLCompactTabRail|function Tabs/,
  'Accessories must not restore the retired Overview / By Muscle / History POC tabs.');
for (const marker of [
  'accessory-development-hero',
  'accessory-work-snapshot',
  'accessory-volume-trend',
  'accessory-working-set-trend',
  'movements-making-progress',
  'recent-accessory-bests',
  'accessories-your-movements',
  'accessory-history-preview',
  'view-full-accessory-history',
]) assert.match(experience, new RegExp(`testID="${marker}"`), `${marker} must remain part of the continuous story.`);

assert.match(experience, /function WorkSnapshot[\s\S]*styles\.evidenceBand[\s\S]*testID="accessory-work-snapshot"/,
  'The work snapshot must remain one intentionally composed evidence band.');
assert.doesNotMatch(experience, /snapshotMetric|flexWrap:\s*'wrap'/,
  'The rejected generic 2x2 metric-card grid must not return.');
assert.equal((experience.match(/<AnalyticalTimeSeriesChart/g) || []).length, 1,
  'Working sets must remain a compact companion signal instead of a second full analytics card.');
assert.match(experience, /story\.muscle_groups\.slice\(0, 5\)/,
  'The phone hero must preserve a disciplined five-row top-muscle hierarchy.');
assert.match(experience, /progressCard:\s*\{\s*width:\s*232,\s*minHeight:\s*286/,
  'Movement progress cards must retain the corrected phone-scale composition.');
assert.match(engineeringDirective, /## Visual Convergence Handoff Gate[\s\S]*identify the three weakest visual areas[\s\S]*second screenshot pass/,
  'The standing engineering directive must require a two-pass visual-quality handoff gate.');

assert.match(experience, /SLAtmosphericContextHeader[\s\S]*ledger-chapter-accessories-v1/,
  'Accessories must use premium atmospheric page identity.');
assert.match(experience, /MuscleMap[\s\S]*\(\['front', 'rear'\] as const\)\.map[\s\S]*accessories-anatomy-view-\$\{view\}/,
  'Governed front and rear anatomy must remain the primary muscle navigation.');
assert.match(experience, /normalizeAnatomyExposure[\s\S]*exposure=\{exposure\}[\s\S]*mode="exposure"/,
  'Accessories anatomy must render an actual relative exposure heatmap from performed evidence.');
assert.match(experience, /muscle\.set_count[\s\S]*anatomyExposureColor\(intensity\)/,
  'Muscle rows must use the same performed-set intensity and visual ramp as the body.');
assert.match(experience, /openMuscle[\s\S]*muscle-groups/,
  'Anatomy evidence must drill into the athlete\'s performed muscle record.');
assert.match(exploration, /data\.accessories\.movements[\s\S]*period_set_count/,
  'Muscle drill-down must use performed canonical accessory movements, not generic catalog inventory.');

assert.match(experience, /CanonicalMovementArtwork/,
  'Every primary movement surface must use the governed individual-movement artwork resolver.');
assert.doesNotMatch(experience, /\?['"`]|question-mark|help-circle/,
  'The primary Accessories experience may never render a visible question-mark placeholder.');
assert.doesNotMatch(movementHistory, /name="help-outline"/,
  'Accessory drill-down may never use a visible question-mark icon for unknown historical equipment.');
assert.match(client, /evidence_policy: 'exact_movement_then_exact_equipment'/,
  'The client contract must document movement-first, equipment-scoped evidence.');
assert.match(client, /muscle_exposure_policy: 'performed_accessory_working_sets_by_governed_primary_muscle'/,
  'The client contract must document the exact performed-set exposure metric.');
assert.match(backend, /resolve_exact_history_identity[\s\S]*identity\.key[\s\S]*comparison_allowed/,
  'The backend projection must resolve immutable movement identity before comparison.');
assert.match(backend, /"muscle_exposure_policy": "performed_accessory_working_sets_by_governed_primary_muscle"/,
  'The backend must declare that each completed accessory working set is credited to its governed primary muscle.');
assert.match(backend, /identity_trend[\s\S]*"trend": identity_trend/,
  'Each progress card sparkline must remain scoped to the exact movement/equipment identity being compared.');
assert.match(backend, /compare_performance[\s\S]*is_assistance_load[\s\S]*performance_rank/,
  'Progress cards must use governed load, rep, effort, and assistance semantics.');
assert.match(backend, /BODYWEIGHT_ONLY_LOAD_CONVENTIONS[\s\S]*_accessory_volume_kg[\s\S]*is_assistance_load/,
  'Accessory volume must exclude assistance and bodyweight-only numeric loads.');
assert.match(experience, /equipmentContextDefinitionId/,
  'Movement detail must open in the exact equipment context when one exists.');
assert.match(experience, /classification: 'accessory'/);
assert.match(archive, /initialClassification[\s\S]*classification: initialClassification/,
  'Full Accessory History must arrive as a real filtered historical view.');
assert.doesNotMatch(experience, /be proud|feel proud|amazing|incredible|you should feel|motivational/i,
  'Athlete evidence—not prescribed emotion—must provide the payoff.');

const fontSizes = [...experience.matchAll(/fontSize:\s*([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
assert.ok(fontSizes.length > 0);
assert.ok(Math.min(...fontSizes) >= 10, `Accessories typography dropped below 10pt: ${Math.min(...fontSizes)}`);

console.log('[accessories-convergence] continuous anatomy-led evidence, exact comparison semantics, history routing, artwork, and readable typography passed');
