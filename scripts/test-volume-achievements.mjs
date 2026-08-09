import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VOLUME_ACHIEVEMENT_MILESTONES,
  VOLUME_ACHIEVEMENT_THRESHOLDS_LB,
  deriveVolumeAchievement,
  deriveVolumeComparisonPresentation,
  formatCompactVolumeLb,
  poundsToDisplayValue,
  safeVolumeLb,
  volumeComparisonForContext,
  volumeSharePercent,
} from '../lib/volume-achievements.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screen = readFileSync(resolve(root, 'app/(tabs)/dev-mocks/milestones.tsx'), 'utf8');
const experience = readFileSync(resolve(root, 'components/volume-achievements/VolumeAchievementExperience.tsx'), 'utf8');
const assetRegistry = readFileSync(resolve(root, 'lib/volume-achievement-assets.ts'), 'utf8');
const assetRoot = resolve(root, 'assets/images/volume-achievements');
const sourceManifest = JSON.parse(readFileSync(resolve(assetRoot, 'source-manifest.json'), 'utf8'));

assert.deepEqual(VOLUME_ACHIEVEMENT_THRESHOLDS_LB, [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000]);
assert.equal(new Set(VOLUME_ACHIEVEMENT_THRESHOLDS_LB).size, 7, 'thresholds must be unique');
assert.ok(VOLUME_ACHIEVEMENT_THRESHOLDS_LB.every((value, index, values) => index === 0 || value > values[index - 1]), 'thresholds must be strictly ascending');
assert.deepEqual(VOLUME_ACHIEVEMENT_MILESTONES.map(({ importance }) => importance), ['foundational', 'foundational', 'major', 'major', 'elite', 'elite', 'elite']);

for (const milestone of VOLUME_ACHIEVEMENT_MILESTONES) {
  assert.equal(milestone.comparisons.length, 4, `${milestone.compactLabel} needs one comparison for every product context`);
  assert.equal(new Set(milestone.comparisons.map(({ id }) => id)).size, milestone.comparisons.length, `${milestone.compactLabel} candidate ids must be unique`);
  assert.equal(new Set(milestone.comparisons.map(({ title }) => title)).size, 4, `${milestone.compactLabel} context titles must be distinct`);
  const contextComparisons = ['total', 'squat', 'bench', 'deadlift'].map((contextId) => volumeComparisonForContext(milestone, contextId));
  assert.equal(new Set(contextComparisons.map(({ id }) => id)).size, 4, `${milestone.compactLabel} must never repeat an object across contexts`);
  for (const comparison of milestone.comparisons) {
    assert.ok(comparison.photoId, `${comparison.id} needs a local photo`);
    assert.ok(comparison.funFact, `${comparison.id} needs a verified fun fact`);
    const factWords = comparison.funFact.text.trim().split(/\s+/).length;
    assert.ok(factWords >= 8 && factWords <= 30, `${comparison.id} fun fact must stay concise`);
    assert.match(comparison.funFact.source.url, /^https:\/\//, `${comparison.id} fun fact needs an authoritative source`);
    assert.ok(comparison.funFact.source.reference.length > 20, `${comparison.id} fun fact needs a source review note`);
    if (comparison.funFact.alternate) {
      assert.ok(comparison.funFact.alternate.text.trim().split(/\s+/).length <= 30, `${comparison.id} alternate fact must stay concise`);
      assert.match(comparison.funFact.alternate.source.url, /^https:\/\//, `${comparison.id} alternate fact needs a source`);
    }
    assert.ok(comparison.title.length > 3, `${comparison.id} needs a comparison title`);
    assert.ok(comparison.approximateWeightLb > 0, `${comparison.id} needs an approximate weight`);
    assert.match(comparison.recommendedCopy, /About|More than|Nearly|Roughly|range|Approach/i, `${comparison.id} must avoid false precision`);
    assert.ok(comparison.weightConfiguration.length > 12, `${comparison.id} needs a weight configuration`);
    assert.ok(comparison.whyItMaps.length > 12, `${comparison.id} needs mapping rationale`);
    assert.ok(comparison.targetCopy.length > 12, `${comparison.id} needs target copy`);
    assert.match(comparison.source.url, /^https:\/\//, `${comparison.id} needs internal source metadata`);
    assert.ok(comparison.source.reference.length > 10, `${comparison.id} needs a source reference note`);
  }
}

assert.equal(sourceManifest.schemaVersion, 1);
assert.equal(sourceManifest.assets.length, 28, 'every tier/context comparison needs one bundled photo and manifest entry');
assert.equal(new Set(sourceManifest.assets.map(({ localFilename }) => localFilename)).size, 28, 'photo filenames must be unique');
for (const thresholdLb of VOLUME_ACHIEVEMENT_THRESHOLDS_LB) {
  assert.equal(sourceManifest.assets.filter((asset) => asset.thresholdLb === thresholdLb).length, 4, `${thresholdLb} needs four photo assets`);
}
for (const asset of sourceManifest.assets) {
  const localPath = resolve(assetRoot, asset.localFilename);
  assert.ok(existsSync(localPath), `${asset.localFilename} must exist locally`);
  const bytes = readFileSync(localPath);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${asset.localFilename} must be a WebP RIFF file`);
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `${asset.localFilename} must be WebP`);
  assert.ok(statSync(localPath).size > 20_000 && statSync(localPath).size < 250_000, `${asset.localFilename} must be mobile-sized`);
  assert.match(asset.sourcePage, /^https:\/\/commons\.wikimedia\.org\//, `${asset.localFilename} needs a verifiable source page`);
  assert.ok(asset.license.length > 10, `${asset.localFilename} needs a license`);
  assert.ok(asset.requiredAttribution.length > 10, `${asset.localFilename} needs attribution guidance`);
  assert.match(asset.processing, /1200x675/, `${asset.localFilename} needs processing provenance`);
}
assert.equal((assetRegistry.match(/require\('@\/assets\/images\/volume-achievements\//g) ?? []).length, 28, 'all photo requires must be centralized');
assert.equal((assetRegistry.match(/^\s*'[^']+': \{ fitMode:/gm) ?? []).length, 28, 'every photo needs centralized subject-aware treatment metadata');
assert.doesNotMatch(experience, /Math\.random|random\(/, 'context comparison selection must remain deterministic');
assert.match(experience, /deriveVolumeComparisonPresentation\(milestone, contextId, progress\.currentLb\)/, 'the ladder must use centralized unlock presentation state');
assert.doesNotMatch(experience, /https?:\/\//, 'the rendered experience must not fetch or embed remote images');
assert.match(experience, /Image as ExpoImage/, 'photographs must use the local image component');
assert.match(experience, /VolumeComparisonPhoto/, 'total, per-lift, and detail views must share one photo treatment');
assert.doesNotMatch(experience, /LinearGradient|gradient/i, 'the entire lifetime-volume experience must remain gradient-free');
assert.match(experience, /detailPhotoScrim: \{ opacity: 0\.24 \}/, 'the detail image must use a flat legibility scrim');
assert.match(experience, /case: \{[^}]*backgroundColor: 'transparent'/, 'all lifetime-volume card shells must match the transparent Strength PR card surface');
assert.match(experience, /totalCase: \{ paddingBottom: SLSpacing\.md, backgroundColor: 'transparent' \}/, 'the total lifetime-volume card must remain transparent');
assert.match(experience, /liftCase: \{ minHeight: 270, paddingTop: SLSpacing\.sm, paddingBottom: SLSpacing\.sm, backgroundColor: 'transparent' \}/, 'per-lift lifetime-volume cards must remain transparent');
assert.match(experience, /heroPhotoScrim: \{ opacity: 0\.62 \}/, 'the total comparison image must use a flat legibility scrim');
assert.match(experience, /earnedPhotoScrim: \{ opacity: 0\.54 \}/, 'earned comparison images must use a flat legibility scrim');
assert.match(experience, /contentFit=\{photo\.fitMode\} contentPosition=\{photo\.focalPosition\}/, 'photo crop behavior must come from centralized asset metadata');
assert.match(experience, /fadeDirection="hero" style=\{styles\.totalBackdrop\}/, 'the total comparison photo must use the large editorial backdrop treatment');
assert.match(experience, /totalBackdrop: \{ \.\.\.StyleSheet\.absoluteFillObject \}/, 'the total comparison image must fill the entire hero above the progression ladder');
assert.match(experience, /fadeDirection="earned" style=\{styles\.earnedComparisonPhoto\}/, 'per-lift earned photos must fill their integrated reward surfaces');
assert.match(experience, /earnedLandmark: \{ flex: 2, flexBasis: 0, minWidth: 0,/, 'the earned comparison must occupy two-thirds of the comparison row without intrinsic-content expansion');
assert.match(experience, /landmarkTarget: \{ flex: 1, flexBasis: 0, minWidth: 0,/, 'the locked next target must occupy one-third of the comparison row without intrinsic-content expansion');
assert.match(experience, /testID=\{`\$\{entry\.id\}-earned-next-row`\}/, 'each per-lift comparison row needs a stable visual-test target');
assert.match(experience, /CircularProgress progress=\{progress\.segmentProgress\}/, 'the total card must expose circular progress toward the next milestone');
assert.match(experience, /progressRing: \{ position: 'absolute', top: 4, right: 4,[^}]*opacity: 0\.76 \}/, 'the total progress circle must sit transparently in the upper-right corner');
assert.doesNotMatch(experience, /styles\.nextMilestoneStrip/, 'the total accumulation card must not render a duplicate next-milestone card');
assert.doesNotMatch(experience, /storyArrow|liftProgress|ProgressTrack/, 'compact lift cards must not reintroduce arrows or redundant progress bars');
assert.doesNotMatch(experience, /VolumeComparisonGlyph|detailGlyphMark/, 'decorative comparison SVGs must not appear in achievement surfaces');
assert.doesNotMatch(experience, /nextComparison|nextOrEarnedComparison|compactComparisonPhoto/, 'future comparison content must not be constructed by the UI');
assert.match(experience, /disabled=\{!presentation\.visibleDetailAccess\}/, 'locked ladder stops must not open details');
assert.doesNotMatch(experience, /Comparison locked/i, 'the lock icon and threshold must replace redundant locked copy');
assert.match(experience, /\$\{stateLabel\(presentation\.state\)\}, \$\{formatVolumeLb\(Math\.max\(0, milestone\.thresholdLb - progress\.currentLb\), unit\)\} remaining/, 'locked accessibility must announce remaining volume without object metadata');
assert.match(experience, /if \(!presentation\.visibleDetailAccess \|\| !comparison\) return null/, 'the detail sheet must reject locked presentation state');
assert.match(experience, /accessibilityLabel=\{factRevealed \? `Fun fact revealed/, 'the reveal must expose its state accessibly');
assert.match(experience, /accessibilityState=\{\{ expanded: factRevealed, disabled: factRevealed \}\}/, 'expanded state must not rely on animation');
assert.match(experience, /announceForAccessibility\(`Fun fact\./, 'the revealed fact must be announced');
assert.match(experience, /if \(reduceMotion\) \{\s*factRevealProgress\.setValue\(1\)/, 'reduced motion must reveal immediately');
assert.match(experience, /duration: 180/, 'the standard reveal must remain brief');
assert.doesNotMatch(screen, /FUN FACT|funFact|factRevealed/, 'fun facts must not clutter the main screen');

assert.match(experience, /fontFamily: SLFontFamilies\.numeric/, 'numeric displays must use the shared Michroma family');
assert.match(experience, /fontFamily: SLFontFamilies\.bodySemiBold/, 'important word labels must use a real Exo 2 semibold face');
assert.match(experience, /fontFamily: SLFontFamilies\.bodyMedium/, 'supporting word labels must use a real Exo 2 medium face');
assert.match(experience, /fontFamily: SLFontFamilies\.body,/, 'body copy must use Exo 2 regular');
assert.doesNotMatch(experience, /SLTypography\.(?:hero|title|cardTitle|sectionTitle|label|utilityLabel|micro|buttonLabel)/, 'the experience must not inherit Michroma word roles');
assert.match(screen, /typographyRole="bodyStrong" style=\{styles\.sectionTitle\}/, 'milestone section headings must use the Exo 2 word role');
assert.match(screen, /typographyRole="bodyStrong" style=\{\[styles\.headerSelectorText/, 'milestone navigation labels must use the Exo 2 word role');

assert.match(experience, /styles\.progressNumeric\}>\{stepPercent\}%<\/ThemedText>[\s\S]*styles\.progressWords\}>OF STEP<\/ThemedText>/, 'step progress must split numeric and word typography');
assert.match(experience, /styles\.remainingNumeric\}>\{remainingValue\}<\/ThemedText>[\s\S]*styles\.remainingWords\}>\{unit\.toUpperCase\(\)\} TO GO<\/ThemedText>/, 'remaining volume must split numeric and word typography');
assert.match(experience, /styles\.totalRemainingValue\}>\{remainingValue\}<\/ThemedText>[\s\S]*styles\.totalRemainingLabel\}>\{unit\.toUpperCase\(\)\} TO UNLOCK<\/ThemedText>/, 'total remaining volume must split numeric and word typography');
assert.match(experience, /ladderStop: \{ flex: 1, flexBasis: 0, minWidth: 0/, 'each of the seven milestones must own one equal-width bounded cell');
assert.match(experience, /progress\.milestones\.map\(\(milestone\) =>/, 'all seven milestone labels must render from the canonical milestone list');
assert.doesNotMatch(experience, /join\(['"]['"]\)|100K250K500K/, 'timeline labels must never be concatenated into one string');
assert.match(experience, /sharePill: \{ minWidth: 50,[^}]*paddingHorizontal: 6, paddingVertical: 4 \}/, 'the per-lift share badge must remain compact');
assert.match(experience, /experience: \{ gap: SLSpacing\.md, paddingBottom: SLSpacing\.xxxl \+ SLSpacing\.xxl \}/, 'the final card needs tokenized bottom clearance from floating controls');

const zero = deriveVolumeAchievement(0);
assert.equal(zero.achieved, null);
assert.equal(zero.next?.thresholdLb, 100_000);
assert.equal(zero.remainingLb, 100_000);
assert.equal(zero.segmentProgress, 0);
assert.deepEqual(zero.milestones.map(({ state }) => state), ['current', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);

const belowFirst = deriveVolumeAchievement(72_500);
assert.equal(belowFirst.achieved, null);
assert.equal(belowFirst.next?.thresholdLb, 100_000);
assert.equal(belowFirst.remainingLb, 27_500);
assert.equal(belowFirst.segmentProgress, 0.725);

const exact = deriveVolumeAchievement(250_000);
assert.equal(exact.achieved?.thresholdLb, 250_000, 'an exact threshold must be achieved');
assert.equal(exact.next?.thresholdLb, 500_000, 'the following threshold must become current');
assert.equal(exact.remainingLb, 250_000);
assert.equal(exact.segmentProgress, 0);
assert.deepEqual(exact.milestones.map(({ state }) => state), ['achieved', 'achieved', 'current', 'locked', 'locked', 'locked', 'locked']);

const milestone250 = VOLUME_ACHIEVEMENT_MILESTONES.find(({ thresholdLb }) => thresholdLb === 250_000);
const milestone500 = VOLUME_ACHIEVEMENT_MILESTONES.find(({ thresholdLb }) => thresholdLb === 500_000);
assert.ok(milestone250 && milestone500);

const justBelowPresentation = deriveVolumeComparisonPresentation(milestone250, 'bench', 249_999);
assert.equal(justBelowPresentation.isUnlocked, false, 'just below a threshold must remain locked');
assert.equal(justBelowPresentation.isCurrentTarget, true);
assert.equal(justBelowPresentation.visibleTitle, null);
assert.equal(justBelowPresentation.visibleImage, null);
assert.equal(justBelowPresentation.visibleFunFact, null);
assert.equal(justBelowPresentation.visibleDetailAccess, false);
assert.equal(justBelowPresentation.comparison, null, 'locked metadata must not enter the visible model');

const exactPresentation = deriveVolumeComparisonPresentation(milestone250, 'bench', 250_000);
assert.equal(exactPresentation.isUnlocked, true, 'exact threshold must reveal the comparison');
assert.equal(exactPresentation.isLatestAchieved, true);
assert.equal(exactPresentation.visibleTitle, 'C-17 Globemaster III');
assert.equal(exactPresentation.visibleImage, 'c17-globemaster');
assert.ok(exactPresentation.visibleFunFact);
assert.equal(exactPresentation.visibleDetailAccess, true);
assert.ok(exactPresentation.comparison);

const justAbovePresentation = deriveVolumeComparisonPresentation(milestone250, 'bench', 250_001);
assert.equal(justAbovePresentation.isUnlocked, true, 'just above a threshold must stay revealed');
assert.equal(justAbovePresentation.isLatestAchieved, true);

const futurePresentation = deriveVolumeComparisonPresentation(milestone500, 'bench', 250_000);
assert.equal(futurePresentation.isUnlocked, false);
assert.equal(futurePresentation.isCurrentTarget, true);
assert.equal(futurePresentation.isFutureLocked, false);
assert.equal(futurePresentation.visibleTitle, null);
assert.equal(futurePresentation.visibleImage, null);
assert.equal(futurePresentation.visibleFunFact, null);
assert.equal(futurePresentation.visibleDetailAccess, false);

const fartherFuturePresentation = deriveVolumeComparisonPresentation(VOLUME_ACHIEVEMENT_MILESTONES[3], 'bench', 250_000);
assert.equal(fartherFuturePresentation.isFutureLocked, true);
assert.equal(fartherFuturePresentation.comparison, null);

const mockTotal = deriveVolumeAchievement(742_380);
assert.equal(mockTotal.achieved?.thresholdLb, 500_000);
assert.equal(mockTotal.next?.thresholdLb, 1_000_000);
assert.equal(mockTotal.remainingLb, 257_620);
assert.equal(Math.round(mockTotal.segmentProgress * 100), 48);

const exactMaximum = deriveVolumeAchievement(10_000_000);
assert.equal(exactMaximum.achieved?.thresholdLb, 10_000_000);
assert.equal(exactMaximum.next, null);
assert.equal(exactMaximum.remainingLb, 0);
assert.equal(exactMaximum.segmentProgress, 1);
assert.ok(exactMaximum.milestones.every(({ state }) => state === 'achieved'));

const aboveMaximum = deriveVolumeAchievement(15_000_000);
assert.equal(aboveMaximum.currentLb, 15_000_000);
assert.equal(aboveMaximum.next, null);
assert.equal(aboveMaximum.remainingLb, 0);

for (const missing of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, -10]) {
  assert.equal(safeVolumeLb(missing), 0, `invalid volume ${String(missing)} must fail safely`);
  assert.equal(deriveVolumeAchievement(missing).currentLb, 0);
}

assert.equal(volumeSharePercent(289_450, 742_380), 39);
assert.equal(volumeSharePercent(176_220, 742_380), 24);
assert.equal(volumeSharePercent(276_710, 742_380), 37);
assert.equal(volumeSharePercent(undefined, 742_380), 0);
assert.equal(volumeSharePercent(10, 0), 0);
assert.equal(poundsToDisplayValue(100_000, 'kg'), 45_359);
assert.equal(formatCompactVolumeLb(1_000_000, 'kg'), '454K');
assert.equal(formatCompactVolumeLb(5_000_000, 'kg'), '2.27M');

assert.match(screen, /<VolumeAchievementExperience data=\{VOLUME_ACHIEVEMENT_MOCK\} unit=\{unit\}/, 'the DEV mock must feed reusable volume components');
assert.doesNotMatch(screen, /const ACCUMULATION|VolumeProgressionRail|VolumeArtifact/, 'volume metadata and UI must not remain duplicated in the screen');
assert.doesNotMatch(experience, /<ScrollView|horizontal/, 'the achievement ladder must not require horizontal hunting');
assert.match(experience, /const accessibilityLabel = isAchieved && comparison/, 'threshold accessibility must branch on unlock state');
assert.match(experience, /accessibilityHint=\{presentation\.visibleDetailAccess \? 'Shows the earned physical scale comparison' : undefined\}/, 'only earned milestones should advertise detail interaction');
assert.match(experience, /useSLReducedMotion/, 'detail motion must honor reduced-motion preference');
assert.match(experience, /animationType=\{reduceMotion \? 'none' : 'fade'\}/, 'reduced motion must disable modal animation');
assert.match(experience, /minHeight: 46/, 'the primary sheet action must retain a usable touch target');
console.log('volume achievement experience regression guards passed');
