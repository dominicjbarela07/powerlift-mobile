import assert from 'node:assert/strict';
import fs from 'node:fs';

import { REP_MAX_VALIDATION_FIXTURES, recognitionScenario } from '../dev-mocks/animation-library/mock-data.ts';
import { ANIMATION_LIBRARY } from '../dev-mocks/animation-library/registry.ts';
import { recognitionPresentation, selectCelebrationEvents } from '../lib/logger-feedback.ts';

const entries = new Map(ANIMATION_LIBRARY.map((entry) => [entry.id, entry]));
assert.ok(entries.has('rep-max-pr'), 'the parameterized Rep-Max animation family must remain');
assert.equal(entries.has('combined-recognition'), false, 'routing permutations must not appear as animation families');
for (const id of ['rep-max-established', 'rep-max-equal', 'rep-max-seven', 'rep-max-with-weight', 'rep-max-reduced']) {
  assert.equal(entries.has(id), false, `${id} belongs in fixtures/tests rather than the Animation Library`);
}
assert.equal(entries.has('same-weight-rep-pr'), false);
assert.equal(REP_MAX_VALIDATION_FIXTURES.equalBest.result, 'no-recognition');

const replacement = recognitionScenario('rep', 7001);
const presentation = recognitionPresentation(replacement, 'kg');
assert.equal(replacement.event_type, 'CORE_REP_MAX_PR');
assert.equal(replacement.evidence.rep_count, 5);
assert.equal(presentation.eyebrow, 'NEW 5 REP MAX');
assert.equal(presentation.value, '205 kg');
assert.equal(presentation.progression, '200 kg → 205 kg');
assert.equal(presentation.delta, '+5 kg');

const established = recognitionScenario('rep-established', 7002);
assert.equal(recognitionPresentation(established, 'kg').eyebrow, '5 REP MAX ESTABLISHED');
assert.deepEqual(selectCelebrationEvents([established]).map((event) => event.id), [7002]);

const collisionPrimary = recognitionScenario('weight', 7003);
const collisionRepMax = { ...replacement, id: 7004, source_set_log_id: collisionPrimary.source_set_log_id };
const selected = selectCelebrationEvents([collisionRepMax, collisionPrimary]);
assert.equal(selected.length, 1);
assert.equal(selected[0].event_type, 'CORE_WEIGHT_PR');
assert.equal(selected[0].secondary_highlight_count, 1);

const previewSource = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');
const canonicalSource = fs.readFileSync(new URL('../components/workout-logger/canonical-record-recognition.tsx', import.meta.url), 'utf8');
assert.match(previewSource, /category = isRepMax \? `\$\{Math\.max\(1, Number\(repCount\) \|\| 1\)\} REP MAX`/);
assert.match(previewSource, /formerLabel=\{`FORMER \$\{category\}`\}/);
assert.match(previewSource, /newLabel=\{`NEW \$\{category\}`\}/);
assert.match(previewSource, /evidenceLabel=\{category\}/);
assert.match(canonicalSource, /adjustsFontSizeToFit[\s\S]*style=\{styles\.winningValue\}/);
assert.match(canonicalSource, /adjustsFontSizeToFit[\s\S]*style=\{\[styles\.comparisonNew/);
assert.match(previewSource, />PREVIOUS</);
assert.match(previewSource, />NEW</);
assert.match(previewSource, />REPS</);
assert.match(previewSource, /\[.*playKey.*\]/s);
assert.doesNotMatch(previewSource, /fixed=\{\{ movement:/);
assert.match(canonicalSource, /<SLTrophy size=\{24\}/);
assert.match(canonicalSource, /<SLTrophy size=\{54\}/);
assert.match(previewSource, /variant === 'reduced'[\s\S]*reducedFamily[\s\S]*reduceMotion = settings\.reduceMotion \|\| variant === 'reduced'/s);

const sharedPresentationSource = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');
assert.match(sharedPresentationSource, /`\$\{repCount\} REP MAX`/);
assert.match(sharedPresentationSource, /FORMER \$\{recordCategory\}/);
assert.match(sharedPresentationSource, /NEW \$\{recordCategory\}/);
assert.match(sharedPresentationSource, /recordCategory=\{recordCategory\}/);
assert.match(sharedPresentationSource, /\+\{secondaryHighlightCount\} more highlight/, 'secondary recognitions must remain compact supporting evidence on the primary surface');

const tenRepReplacement = {
  ...replacement,
  id: 7010,
  comparison_bucket: 'reps:10',
  evidence: { ...replacement.evidence, actual_reps: 10, rep_count: 10 },
};
assert.equal(recognitionPresentation(tenRepReplacement, 'kg').eyebrow, 'NEW 10 REP MAX');
assert.equal(tenRepReplacement.event_type, 'CORE_REP_MAX_PR');
assert.equal(recognitionPresentation(recognitionScenario('weight', 7011), 'kg').eyebrow, 'New weight PR');

const repMaxRegistryCopy = [...entries.values()]
  .filter((entry) => entry.id.startsWith('rep-max'))
  .map((entry) => `${entry.title} ${entry.description} ${entry.reducedMotion}`)
  .join(' ');
assert.doesNotMatch(repMaxRegistryCopy, /\b(?:5|7)RM\b/);

console.log('[rep-max-recognition] domain presentation, priority, deterministic previews, trophy, and reduced motion passed');
