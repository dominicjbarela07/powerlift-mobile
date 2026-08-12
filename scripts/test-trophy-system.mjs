import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const assets = [
  'assets/images/total-tier-steel-cutout.png',
  'assets/images/total-tier-bronze-cutout.png',
  'assets/images/total-tier-silver-cutout.png',
  'assets/images/total-tier-gold-cutout.png',
  'assets/images/total-tier-platinum-cutout.png',
  'assets/images/total-tier-diamond-cutout.png',
  'assets/images/total-tier-obsidian.png',
];

for (const relative of assets) {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${relative} must remain a valid PNG`);
  assert.equal(bytes[25], 6, `${relative} must retain RGBA transparency`);
  assert.ok(bytes.length > 10_000, `${relative} must retain render-quality image data`);
}

const registry = read('lib/trophy-assets.ts');
const component = read('components/ui/sl-trophy.tsx');
const milestones = read('app/(tabs)/dev-mocks/milestones.tsx');
const feedback = read('components/workout-logger/logger-feedback.tsx');
const animationPreview = read('dev-mocks/animation-library/preview-card.tsx');
const canonicalRecordRecognition = read('components/workout-logger/canonical-record-recognition.tsx');

for (const relative of assets) assert.match(registry, new RegExp(relative.split('/').at(-1).replaceAll('.', '\\.')));
assert.match(registry, /steel[\s\S]*bronze[\s\S]*silver[\s\S]*gold[\s\S]*platinum[\s\S]*diamond[\s\S]*obsidian/, 'the shared registry must expose the complete Total trophy family');
assert.match(component, /SL_TROPHY_ASSETS\[tier\]/, 'the shared component must resolve its image from the canonical registry');
assert.match(milestones, /SL_TOTAL_TROPHY_ASSETS/, 'Total Milestones must consume the shared canonical registry');
assert.doesNotMatch(milestones, /require\(['"]@\/assets\/images\/total-tier-/, 'Total Milestones must not duplicate trophy asset references');
assert.match(feedback, /<SLTrophy size=\{72\}/, 'recognition intro must let the canonical trophy stand as the focal object');
assert.match(feedback, /RecordReplacementHero[\s\S]*CanonicalRecordRecognition/, 'Weight PR replacement must delegate to the canonical recognition primitive');
assert.match(canonicalRecordRecognition, /<SLTrophy size=\{24\}[\s\S]*<SLTrophy size=\{54\}/, 'the canonical recognition primitive must render both approved trophy moments');
assert.doesNotMatch(feedback, /<Ionicons[^>]+name=["']trophy/, 'logger feedback must not render a competing vector trophy');
assert.doesNotMatch(feedback, /trophyIntroMark:\s*\{[^}]*borderRadius|trophyMark:\s*\{[^}]*borderRadius/, 'recognition trophies must not be contained in circular badges');
assert.match(animationPreview, /LoggerFeedbackSurface/, 'Animation Library recognition previews must retain the production logger feedback surface');
assert.match(animationPreview, /WeightPrRecognitionPreview[\s\S]*<CanonicalRecordRecognition/, 'the DEV Weight PR wrapper must use the canonical production choreography');

console.log(`[trophy-system] ${assets.length} transparent tier assets and canonical recognition surfaces passed reference checks`);
