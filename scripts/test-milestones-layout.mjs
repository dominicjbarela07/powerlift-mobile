import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  MILESTONE_CELL_GAP,
  MILESTONE_RAIL_INSET,
  MILESTONE_VISIBLE_CELL_COUNT,
  canRenderGymTotal,
  displayWeightFromCanonicalLb,
  gymTotalToPlateModelTotalLb,
  kgTotalToPlateModelTotalLb,
  milestoneCellWidth,
  milestoneScrollOffset,
  milestoneWindowStart,
  roundToGymWeight,
} from '../lib/milestones-layout.ts';

const root = resolve(import.meta.dirname, '..');
const screen = readFileSync(resolve(root, 'components/ledger/AchievementsExperience.tsx'), 'utf8');
const rewards = readFileSync(resolve(root, 'lib/ledger-rewards.ts'), 'utf8');
const tabs = readFileSync(resolve(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const liftPresentations = screen.slice(screen.indexOf('const LIFT_PRESENTATIONS:'), screen.indexOf('const VOLUME_PRESENTATION'));

assert.equal(MILESTONE_VISIBLE_CELL_COUNT, 4, 'strength PR cards must expose four equal cells');

for (const [device, viewportWidth] of [
  ['compact', 370],
  ['standard', 382],
  ['pro-max', 420],
]) {
  const width = milestoneCellWidth(viewportWidth);
  const occupied = (width * MILESTONE_VISIBLE_CELL_COUNT)
    + (MILESTONE_CELL_GAP * (MILESTONE_VISIBLE_CELL_COUNT - 1))
    + (MILESTONE_RAIL_INSET * 2);
  assert.ok(width > 0, `${device} cells must have positive width`);
  assert.ok(occupied <= viewportWidth, `${device} rightmost cell must remain inside the card`);
  assert.ok(viewportWidth - occupied < MILESTONE_VISIBLE_CELL_COUNT, `${device} width allocation must not waste a full cell`);
}

assert.equal(milestoneWindowStart([150, 175, 195, 215, 240, 275, 315], 240), 3);
assert.equal(milestoneWindowStart([590, 655, 730, 825], 825), 0);
assert.equal(milestoneScrollOffset(4, 90), 376);


assert.deepEqual(
  [60, 50, 40, 30, 25, 22.5].map(kgTotalToPlateModelTotalLb),
  [135, 115, 95, 65, 55, 50],
  '20/15/10/5/2.5/1.25 kg plates must use the 45/35/25/10/5/2.5 lb models',
);
assert.equal(kgTotalToPlateModelTotalLb(80), 185, '80 kg must render one 20 kg and one 10 kg plate per side');
assert.equal(kgTotalToPlateModelTotalLb(340), 765, '340 kg must render eight 20 kg plates per side with the existing 45 lb models');
assert.equal(kgTotalToPlateModelTotalLb(380), 855, 'the extended kg ladder must remain representable by approved captures');
assert.equal(roundToGymWeight(206, 'kg'), 205);
assert.equal(roundToGymWeight(143, 'kg'), 142.5);
assert.equal(roundToGymWeight(727, 'lb'), 725);
assert.equal(roundToGymWeight(728, 'lb'), 730);
assert.equal(canRenderGymTotal(0, 'lb'), false, 'missing pound PRs must not enter the plate renderer');
assert.equal(canRenderGymTotal(0, 'kg'), false, 'missing kilogram PRs must not enter the plate renderer');
assert.equal(canRenderGymTotal(40, 'lb'), false, 'sub-bar pound totals must not enter the plate renderer');
assert.equal(canRenderGymTotal(17.5, 'kg'), false, 'sub-bar kilogram totals must not enter the plate renderer');
assert.equal(canRenderGymTotal(45, 'lb'), true);
assert.equal(canRenderGymTotal(20, 'kg'), true);
assert.equal(displayWeightFromCanonicalLb(725, 'lb'), 725);
assert.equal(displayWeightFromCanonicalLb(725, 'kg'), 330);
assert.equal(displayWeightFromCanonicalLb(315, 'kg'), 142.5);
assert.equal(displayWeightFromCanonicalLb(455, 'kg'), 207.5);
assert.equal(gymTotalToPlateModelTotalLb(205, 'kg'), 465, '205 kg must preserve four 20 kg, one 10 kg, and one 2.5 kg plate per side');
assert.equal(gymTotalToPlateModelTotalLb(142.5, 'kg'), 320, '142.5 kg must preserve three 20 kg and one 1.25 kg plate per side');
assert.equal(gymTotalToPlateModelTotalLb(455, 'lb'), 455, 'valid 5 lb totals must retain their exact pound loading');

assert.doesNotMatch(liftPresentations, /currentLb|current:\s*\{/, 'lift presentation policy must not embed athlete PR values');
assert.match(screen, /LIFT_PRESENTATIONS\.map\(\(lift\): Lift =>/, 'every competition lift must render independently from canonical current-best responses');
assert.match(screen, /resolveLedgerClubsRuntimeState\(/, 'the visible strength cards must use the shared live Clubs projection');
assert.match(rewards, /currentLb: canonicalWeightKg == null \? null :/, 'missing lift evidence must remain a per-lift empty state');
assert.match(screen, /liveLifts\.map\(\(lift\) => <LiftRow/, 'all three competition lift rows must remain visible independently');
assert.match(screen, /section === 'clubs' && hasCompleteStrengthTotal && club \? <View/, 'only the combined strength-total hero may require all three lifts');
assert.match(screen, /VOLUME_PRESENTATION\.lifts\.map/, 'per-lift career volume cards must render independently');
assert.match(screen, /competition_total_volume_kg \?\? pointDerivedCompetitionVolumeKg/, 'competition total volume must accept any available governed lift volume');
assert.match(rewards, /item\.metric === 'weight'/, 'strength tiers must use canonical weight records rather than e1RM estimates');
assert.match(screen, /const tierCurrent = lift\.tierState\?\.current \?\? 0/, 'the active tier display must derive from canonical-kg evidence through the shared unit-aware tier resolver');
assert.match(screen, /<FloatingDisplayUnitRegistration unit=\{unit\} onChange=\{setUnit\} testID="ledger-achievements-unit-toggle" \/>/, 'the governed floating unit control must switch the active derived display unit');
assert.match(screen, /canRenderGymTotal\(current, unit\)/, 'hero plate loading must validate its separately gym-rounded art weight in the active unit');
assert.match(screen, /resolvePlateStackRender\(\{ weight: current, unit \}\)/, 'hero loading must resolve its art-only weight through the shared unit-aware catalog');
assert.doesNotMatch(screen, /resolveHeroRender|canonicalHeroLoading/, 'the hero must not bypass the shared resolver through the legacy lift-specific registry');
assert.match(screen, /testID=\{`\$\{liftKey\}-pr-empty-state`\}/, 'missing PRs must render a bounded empty state instead of crashing');
assert.match(screen, /testID=\{`\$\{liftKey\}-pr-render-unavailable`\}/, 'uncatalogued PR heroes must use a bounded honest fallback');
assert.doesNotMatch(screen, /cameraPreset="hero"/, 'ordinary hero mount must not instantiate live 3D rendering');

assert.match(screen, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.62\} style=\{styles\.liftHeroMetric\}/, 'PR numbers must scale down to preserve every glyph');
assert.match(screen, /proMax && styles\.liftMetricBlockProMax/, 'Pro Max PR values must receive the wider metric lane');
assert.match(screen, /liftMetricBlockProMax: \{ width: 156, minWidth: 156 \}/, 'the Pro Max metric lane must preserve the final PR glyph and unit');
assert.match(screen, /liftHeroMetric: \{ flex: 1, flexShrink: 1, minWidth: 0/, 'PR values must own the available width and shrink instead of clipping');
assert.doesNotMatch(screen, /typographyRole="heroNumeric" numberOfLines=\{1\} ellipsizeMode="clip"/, 'PR values must never use destructive clipping');
assert.doesNotMatch(screen, /liftMetricBlock: \{[^}]*overflow/, 'the PR metric block must not clip numeric values');

assert.match(screen, /const renderedCellWidth = Math\.max\(88, Math\.min\(106, \(windowWidth - 52\) \/ 3\.45\)\)/, 'tier cell width must derive from the rendered device viewport');
assert.match(screen, /style=\{\[styles\.liftMilestoneStop, \{ width: renderedCellWidth \}\]\}/, 'every milestone stop must use the shared equal-cell width');
assert.doesNotMatch(screen, /liftMilestoneStop: \{ width: 104/, 'milestone cells must not retain the Pro Max-only fixed width');
assert.match(screen, /typographyRole="caption" numberOfLines=\{2\} ellipsizeMode="clip"/, 'strength-tier labels must use a two-line Exo 2 word role without tail ellipsis');
assert.match(screen, /\(tierState\?\.tiers \?\? \[\]\)\.map/, 'per-lift thresholds must come from the supported versioned standard rather than an embedded plate ladder');
assert.match(screen, /tier\.actual_percentile\.toFixed\(1\)/, 'each strength tier must expose the empirical percentile represented by its rounded kg threshold');
assert.match(screen, /SL_STRENGTH_TIER_ASSETS\[tierIndex\]/, 'the governed Tier I–VII artwork registry must remain the tier artwork authority');

assert.match(screen, /useFocusEffect\(useCallback/, 'the screen must restore a safe top position whenever it receives focus');
assert.match(screen, /scrollTo\(\{ x: 0, y: 0, animated: false \}\)/, 'focus restoration must begin below the fixed app header');
assert.doesNotMatch(screen, /unitControlStrip/, 'the unit toggle must not be moved into an in-flow strip');
assert.match(screen, /<FloatingControlCoordinator context="tab-screen">/, 'the unit toggle must remain coordinated with the shared floating-control layer');
assert.match(screen, /navButton: \{ width: 44, height: 44,[^}]*borderRadius: 22/, 'the header navigation control must remain circular with a stable touch target');
assert.match(screen, /requestedUnit === 'kg' \|\| requestedUnit === 'lb'/, 'an explicit Achievements route unit must remain a local display override');
assert.match(screen, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)/, 'Achievements must otherwise initialize from the signed-in viewer preference');
assert.match(tabs, /name="ledger"/, 'the canonical Ledger route must be registered in the shipping tab navigator');
assert.match(tabs, /href: viewMode === 'athlete' \|\| isIndividual \? '\/\(tabs\)\/ledger\/home' : null/, 'the canonical Ledger route must be reachable in athlete and individual modes');

assert.doesNotMatch(screen, /LinearGradient|RadialGradient|ConicGradient/, 'the repair must not introduce gradients');
assert.match(screen, /otherCase: \{[^}]*backgroundColor: 'transparent'/, 'other milestone cards must match the transparent Strength PR card surface');
assert.match(screen, /requestState: \{[^}]*backgroundColor: 'transparent'/, 'achievement request-state cards must match the transparent card surface');

console.log('[milestones-layout] compact, standard, Pro Max geometry and regression guards passed');
