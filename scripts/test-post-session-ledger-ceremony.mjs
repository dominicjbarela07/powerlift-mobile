import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ANIMATION_LIBRARY } from '../dev-mocks/animation-library/registry.ts';

const ceremony = fs.readFileSync(
  new URL('../components/workout-logger/post-session-ledger-ceremony.tsx', import.meta.url),
  'utf8',
);
const impactSummary = fs.readFileSync(
  new URL('../components/workout-logger/stage5-impact-summary.tsx', import.meta.url),
  'utf8',
);
const postSessionSurfaces = fs.readFileSync(
  new URL('../components/workout-logger/post-session-surfaces.tsx', import.meta.url),
  'utf8',
);
const logger = fs.readFileSync(
  new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url),
  'utf8',
);
const assetUrl = new URL('../assets/images/post-session-ledger-concept-v1.png', import.meta.url);

assert.equal(fs.existsSync(assetUrl), true, 'the temporary ledger concept asset must be packaged');
assert.match(
  ceremony,
  /POST_SESSION_LEDGER_ARTWORK = require\('@\/assets\/images\/post-session-ledger-concept-v1\.png'\)/,
  'ledger art must have one explicit, replaceable source boundary',
);
assert.match(ceremony, /Math\.max\(1, Math\.round\(Number\(streak\) \|\| 1\)\)/, 'the displayed streak must never fall below one');
assert.match(ceremony, /SESSION STREAK/, 'the ceremony must name the session streak clearly');
assert.match(ceremony, /TRAINING SESSION COMPLETE/, 'the completion hero must state the completed outcome immediately');
assert.match(ceremony, /SLColors\.black/, 'the ceremony must use a true-black stage');
assert.match(ceremony, /ledgerOpacity[\s\S]*ledgerScale[\s\S]*ledgerLift[\s\S]*streakRise[\s\S]*recapOpacity/, 'the ledger, streak, and digest must have distinct choreography');
assert.doesNotMatch(ceremony, /particle|fragment|confetti|GLTF|GLB|expo-three|pageTurn|pageOpen/i, 'the simplified ceremony must not add particles or 3D/page physics');

assert.match(impactSummary, /PostSessionLedgerCeremony/, 'the production completion panel must render the ledger ceremony');
assert.match(impactSummary, /toValue: 0\.12[\s\S]*toValue: 0\.34[\s\S]*toValue: 0\.56[\s\S]*toValue: 0\.66[\s\S]*toValue: 0\.82[\s\S]*toValue: 1/, 'the production ceremony must preserve the requested phase order');
assert.match(impactSummary, /Animated\.delay\(Math\.round\(holdMs \/ playbackRate\)\)/, 'the streak must receive a calm hold');
assert.match(impactSummary, /if \(!animateEntry \|\| reduceMotion\)[\s\S]*ceremonyProgress\.setValue\(1\)/, 'historical and reduced-motion views must resolve directly to stable evidence');
assert.match(impactSummary, /Today&apos;s highlights/, 'the existing digest heading must remain');
assert.match(impactSummary, /HistoricalAccomplishmentList/, 'existing accomplishment history must remain');
assert.match(impactSummary, /EstimatedStrengthInsights/, 'estimated-strength digest insight must remain');
assert.match(impactSummary, /Complete Training Volume/, 'broad career volume must use the finalized product language');
assert.match(impactSummary, /Training exposure/, 'session exposure must remain');
assert.match(impactSummary, /PostSessionSurface tone="ceremony"/, 'the completion ceremony must own a dedicated OLED material');
assert.match(impactSummary, /PostSessionSurface tone="reflection"/, 'the accomplishment digest must be structurally separate from the hero');

assert.match(postSessionSurfaces, /export function PostSessionSurface/, 'post-session OLED material must be reusable');
assert.match(postSessionSurfaces, /export function PostSessionCoachFeedback/, 'coach feedback must be a reusable post-session surface');
assert.match(postSessionSurfaces, /SLProfileAvatar/, 'coach feedback must show the canonical author avatar');
assert.match(postSessionSurfaces, /authorName/, 'coach feedback must show the canonical author name');
assert.match(postSessionSurfaces, /Self-coached reflection/, 'self-coached feedback must retain the athlete identity');
assert.doesNotMatch(postSessionSurfaces, /rgba\\(18,32,28,0\\.58\\)/, 'post-session feedback must not regress to the flat green utility card');

assert.match(logger, /completion_transitioned === true[\s\S]*setAnimatedCompletionSummaryId/, 'only a canonical fresh completion may arm the ceremony');
assert.match(logger, /<PostSessionCoachFeedback[\s\S]*authorKind=\{sessionNoteAuthor\.kind\}[\s\S]*authorName=\{sessionNoteAuthor\.name\}/, 'post-session feedback must use the canonical coach/self author resolver');
assert.match(logger, /animateEntry=\{animatedCompletionSummaryId === workout\.impact_summary\.summary_id\}/, 'the completed-session view must tie animation to the new summary id');
assert.match(logger, /skipPostSessionAndComplete[\s\S]*await completeWorkout\(\{ skipIncompleteWarning: true \}\)/, 'skipping the survey must still complete before the ceremony');
assert.match(logger, /submitPostSessionAndComplete[\s\S]*post_session_survey[\s\S]*await completeWorkout\(\{ skipIncompleteWarning: true \}\)/, 'submitting the survey must still complete before the ceremony');
assert.match(logger, /if \(completionTransitioned\)[\s\S]*scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/, 'a fresh ceremony must be brought into focus without an extra interaction');

const completionEntries = ANIMATION_LIBRARY.filter((entry) => entry.kind === 'session-completion');
assert.deepEqual(
  completionEntries.map((entry) => entry.id),
  ['post-session-ledger-ceremony'],
  'the DEV Animation Library must expose one completion animation family',
);

console.log('[post-session-ledger-ceremony] asset, choreography, completion gate, digest handoff, and DEV registry passed');
