import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  athletesForScenario,
  attentionRoster,
  COACH_ROSTER_FILTERS,
  COACH_ROSTER_SCENARIOS,
  filterRoster,
  remainingRoster,
  resolveReason,
  rosterOrder,
  scenarioById,
} from '../dev-mocks/coach-roster-first/model.ts';
import {
  TEAM_BRIEF_SCENARIO_IDS,
  teamBriefForScenario,
} from '../dev-mocks/coach-roster-first/team-brief-model.ts';

const requiredScenarioIds = [
  'small-quiet',
  'small-issues',
  'large-attention',
  'reviews',
  'programming',
  'messages',
  'empty-filter',
  'one-issue',
  'multiple-issues',
  'row-anatomy',
  'athlete-workspace',
  'athlete-healthy',
  'athlete-programming',
  'athlete-reviews',
  'athlete-readiness',
  'athlete-missed',
  'athlete-multiple-issues',
  'athlete-no-issues',
  'athlete-meet-week',
  'athlete-self-coached',
  'athlete-no-program',
  'athlete-first-week',
  'athlete-final-week',
  'athlete-block-transition',
  'athlete-deload',
  'athlete-unresolved-block',
  'athlete-no-session',
  'swipe',
  'long-press',
  'resolved',
  'team-brief',
  'team-brief-healthy',
  'team-brief-reviews',
  'team-brief-programming',
  'team-brief-meet-prep',
  'team-brief-deload',
  'team-brief-quiet',
  'team-brief-large',
  'team-brief-overloaded',
  'team-brief-new',
  'new-coach',
  'loading',
  'error',
  'offline',
  'reduced-motion',
  'accessible-actions',
  'notification-deep-link',
  'no-history-fallback',
];

assert.deepEqual(
  [...COACH_ROSTER_SCENARIOS.map((scenario) => scenario.id)].sort(),
  [...requiredScenarioIds].sort(),
  'The sandbox must retain every required deterministic state.',
);

assert.deepEqual(
  COACH_ROSTER_FILTERS.map((filter) => filter.id),
  ['all', 'needs', 'programming', 'reviews', 'messages', 'check-ins'],
  'The approved overlapping queue set changed.',
);

const largeScenario = scenarioById('large-attention');
const largeRoster = athletesForScenario(largeScenario);
assert.equal(largeRoster.length, 54, 'The large-roster scenario must exercise 50+ athletes.');

const allRoster = filterRoster(largeRoster, 'all');
assert.deepEqual(
  allRoster.map((athlete) => athlete.name),
  allRoster.map((athlete) => athlete.name).sort((a, b) => a.localeCompare(b)),
  'The authoritative roster must use stable alphabetical ordering.',
);

const boundedAttention = attentionRoster(largeRoster, largeScenario.attentionLimit);
assert.equal(boundedAttention.length, 6, 'The default attention queue must remain bounded.');
assert.equal(boundedAttention[0]?.id, 'marcus-rivera', 'Critical programming expiry should rank first.');
const remainingLargeRoster = remainingRoster(largeRoster, boundedAttention);
assert.equal(remainingLargeRoster.length, 48, 'A 54-athlete roster with a six-athlete working set must show 48 remaining athletes.');
assert.deepEqual(
  remainingLargeRoster.map((athlete) => athlete.name),
  remainingLargeRoster.map((athlete) => athlete.name).sort((a, b) => a.localeCompare(b)),
  'Remaining Athletes must retain stable alphabetical ordering.',
);
assert.equal(
  boundedAttention.filter((athlete) => remainingLargeRoster.some((remaining) => remaining.id === athlete.id)).length,
  0,
  'Working-set athletes must never be duplicated in Remaining Athletes.',
);
assert.equal(
  new Set([...boundedAttention, ...remainingLargeRoster].map((athlete) => athlete.id)).size,
  largeRoster.length,
  'Working Set and Remaining Athletes must partition the authoritative roster without loss or duplication.',
);

const marcus = largeRoster.find((athlete) => athlete.id === 'marcus-rivera');
assert(marcus, 'Marcus fixture is required.');
assert(filterRoster(largeRoster, 'needs').some((athlete) => athlete.id === marcus.id));
assert(filterRoster(largeRoster, 'programming').some((athlete) => athlete.id === marcus.id));
assert(filterRoster(largeRoster, 'messages').some((athlete) => athlete.id === marcus.id));
const marcusSearchWorkingSet = attentionRoster(largeRoster, largeScenario.attentionLimit, 'Marcus');
const marcusSearchRemaining = remainingRoster(largeRoster, marcusSearchWorkingSet, 'Marcus');
assert.deepEqual(marcusSearchWorkingSet.map((athlete) => athlete.id), [marcus.id], 'Search must surface the attention version of a matching working-set athlete.');
assert.equal(marcusSearchRemaining.length, 0, 'Search must never duplicate a working-set athlete in Remaining Athletes.');

const orderBeforeResolution = rosterOrder(largeRoster);
const resolvedRoster = resolveReason(largeRoster, marcus.id, 'marcus-program');
const orderAfterResolution = rosterOrder(resolvedRoster);
assert.deepEqual(orderAfterResolution, orderBeforeResolution, 'Resolving work must not reorder the authoritative roster.');
assert(filterRoster(resolvedRoster, 'all').some((athlete) => athlete.id === marcus.id), 'Resolved athletes must remain in the authoritative roster.');
assert(!filterRoster(resolvedRoster, 'programming').some((athlete) => athlete.id === marcus.id), 'Resolved reasons must leave their focused queue.');
assert(filterRoster(resolvedRoster, 'messages').some((athlete) => athlete.id === marcus.id), 'Resolving one reason must preserve overlapping reasons.');

const fullyResolvedRoster = marcus.reasons.reduce(
  (currentRoster, reason) => resolveReason(currentRoster, marcus.id, reason.id),
  largeRoster,
);
const workingSetAfterResolution = attentionRoster(fullyResolvedRoster, largeScenario.attentionLimit);
const remainingAfterResolution = remainingRoster(fullyResolvedRoster, workingSetAfterResolution);
assert(!workingSetAfterResolution.some((athlete) => athlete.id === marcus.id), 'An athlete must leave the working set after every attention reason resolves.');
assert(remainingAfterResolution.some((athlete) => athlete.id === marcus.id), 'A fully resolved athlete must return to Remaining Athletes.');
assert.deepEqual(
  remainingAfterResolution.map((athlete) => athlete.name),
  remainingAfterResolution.map((athlete) => athlete.name).sort((a, b) => a.localeCompare(b)),
  'Resolution must preserve Remaining Athletes alphabetical order.',
);

const allAttentionRoster = largeRoster.filter((athlete) => athlete.reasons.length > 0).slice(0, 3);
const allAttentionWorkingSet = attentionRoster(allAttentionRoster, allAttentionRoster.length);
assert.equal(
  remainingRoster(allAttentionRoster, allAttentionWorkingSet).length,
  0,
  'The Remaining Athletes section must be omitted when every athlete is surfaced in Needs Attention.',
);

const emptyScenario = scenarioById('empty-filter');
assert.equal(
  filterRoster(athletesForScenario(emptyScenario), emptyScenario.initialFilter, '', emptyScenario.forceEmptyFilter).length,
  0,
  'The focused empty-queue state must remain deterministic.',
);
assert.equal(athletesForScenario(scenarioById('new-coach')).length, 0, 'The new-coach state must not fabricate roster members.');

const workspaceScenarioIds = [
  'athlete-healthy',
  'athlete-programming',
  'athlete-reviews',
  'athlete-multiple-issues',
  'athlete-no-issues',
  'athlete-meet-week',
  'athlete-self-coached',
  'athlete-no-program',
  'athlete-first-week',
  'athlete-final-week',
  'athlete-block-transition',
  'athlete-deload',
  'athlete-unresolved-block',
  'athlete-no-session',
];
for (const scenarioId of workspaceScenarioIds) {
  const workspaceScenario = scenarioById(scenarioId);
  const workspaceAthlete = athletesForScenario(workspaceScenario).find((athlete) => athlete.id === workspaceScenario.initialAthleteId);
  assert(workspaceAthlete, `${scenarioId} must open a deterministic athlete workspace.`);
}
assert(
  athletesForScenario(scenarioById('athlete-multiple-issues')).find((athlete) => athlete.id === 'marcus-rivera')?.reasons.length >= 2,
  'The multiple-issues workspace must expose independently resolvable work.',
);
assert.equal(
  athletesForScenario(scenarioById('athlete-no-issues')).find((athlete) => athlete.id === 'benjamin-okafor')?.reasons.length,
  0,
  'The no-issues workspace must not invent urgency.',
);
assert.equal(
  athletesForScenario(scenarioById('athlete-self-coached')).find((athlete) => athlete.id === 'ava-thompson')?.coachingMode,
  'self_coached',
  'The self-coached workspace must establish the correct relationship context.',
);
assert(
  athletesForScenario(scenarioById('athlete-meet-week')).find((athlete) => athlete.id === 'mia-rodriguez')?.reasons.some((item) => item.id === 'mia-attempt-plan'),
  'The meet-week workspace must expose the time-sensitive attempt decision.',
);

const firstWeekTraining = athletesForScenario(scenarioById('athlete-first-week'))
  .find((athlete) => athlete.id === 'ava-thompson')?.currentTraining;
assert.equal(firstWeekTraining?.status, 'active', 'The first-week scenario must resolve active training.');
assert.equal(firstWeekTraining?.status === 'active' ? firstWeekTraining.weekIndex : null, 1, 'The first-week scenario must explicitly resolve week 1.');

const finalWeekTraining = athletesForScenario(scenarioById('athlete-final-week'))
  .find((athlete) => athlete.id === 'noah-williams')?.currentTraining;
assert.equal(finalWeekTraining?.status, 'active', 'The final-week scenario must resolve active training.');
assert.equal(
  finalWeekTraining?.status === 'active' ? finalWeekTraining.weekIndex : null,
  finalWeekTraining?.status === 'active' ? finalWeekTraining.totalBlockWeeks : null,
  'The final-week scenario must place the athlete in the last week of the block.',
);

const transitionTraining = athletesForScenario(scenarioById('athlete-block-transition'))
  .find((athlete) => athlete.id === 'marcus-rivera')?.currentTraining;
assert(
  transitionTraining?.status === 'active' && transitionTraining.transitionLabel === 'Progression Block starts next week',
  'The block-transition scenario must preserve current position and identify the upcoming transition.',
);

const deloadTraining = athletesForScenario(scenarioById('athlete-deload'))
  .find((athlete) => athlete.id === 'marcus-rivera')?.currentTraining;
assert(
  deloadTraining?.status === 'active' && deloadTraining.blockTag === 'Deload',
  'The tagged-week scenario must expose a quiet Deload tag.',
);

assert.equal(
  athletesForScenario(scenarioById('athlete-no-program'))
    .find((athlete) => athlete.id === 'generated-7')?.currentTraining.status,
  'no_active_program',
  'The no-program scenario must not fabricate training position.',
);
assert.equal(
  athletesForScenario(scenarioById('athlete-unresolved-block'))
    .find((athlete) => athlete.id === 'marcus-rivera')?.currentTraining.status,
  'position_unavailable',
  'The unresolved-block scenario must retain the known program without fabricating block position.',
);
const noSessionTraining = athletesForScenario(scenarioById('athlete-no-session'))
  .find((athlete) => athlete.id === 'ethan-walker')?.currentTraining;
assert(
  noSessionTraining?.status === 'active'
    && noSessionTraining.sessionIndex === null
    && noSessionTraining.sessionsThisWeek === 0,
  'The no-Session scenario must not fabricate a day position.',
);

assert.equal(TEAM_BRIEF_SCENARIO_IDS.length, 8, 'Team Brief must expose all eight requested deterministic states.');
for (const scenarioId of TEAM_BRIEF_SCENARIO_IDS) {
  const scenarioBrief = teamBriefForScenario(scenarioId);
  assert.equal(scenarioBrief.sections.length, 4, `${scenarioId} must retain the four-part executive summary.`);
  assert.deepEqual(
    scenarioBrief.sections.map((briefSection) => briefSection.id),
    ['needs-attention', 'coming-up', 'team-health', 'blind-spots'],
    `${scenarioId} must preserve the approved Team Brief scan order.`,
  );
  assert(
    scenarioBrief.sections.every((briefSection) => briefSection.items.length > 0),
    `${scenarioId} must give every executive-summary section useful content.`,
  );
  assert(
    scenarioBrief.sections.every((briefSection) => briefSection.items.every((item) => (
      item.headline.length <= 24
      && item.supportingLine.length <= 40
      && !item.headline.includes('\n')
      && !item.supportingLine.includes('\n')
      && item.action.label === 'Open'
    ))),
    `${scenarioId} must keep every intelligence item to a headline, one concise line, and one action.`,
  );
}
assert(
  teamBriefForScenario('team-brief-reviews').sections.some((briefSection) => briefSection.items.some((item) => item.action.filter === 'reviews')),
  'The review-heavy brief must route into the exact action queue.',
);
assert(
  teamBriefForScenario('team-brief-programming').sections.some((briefSection) => briefSection.items.some((item) => item.action.filter === 'programming')),
  'The programming-heavy brief must route into the exact action queue.',
);
assert.equal(athletesForScenario(scenarioById('team-brief-large')).length, 54, 'Large-team Team Brief must exercise a 50-plus-athlete roster.');
assert.equal(athletesForScenario(scenarioById('team-brief-new')).length, 0, 'New-coach Team Brief must be empty.');

for (const queueId of ['reviews', 'programming', 'messages']) {
  const queueScenario = scenarioById(queueId);
  assert(
    filterRoster(athletesForScenario(queueScenario), queueScenario.initialFilter).length >= 5,
    `${queueId} must pressure-test a non-trivial work queue.`,
  );
}

const sourceFiles = [
  'dev-mocks/coach-roster-first/model.ts',
  'dev-mocks/coach-roster-first/experience.tsx',
  'app/(tabs)/dev-mocks/coach-roster-first.tsx',
  'dev-mocks/library.ts',
  'dev-mocks/live-screen-registry.ts',
  'dev-mocks/coach-roster-first/material.tsx',
  'components/coach-mobile/coach-material-layer.tsx',
  'dev-mocks/coach-roster-first/team-brief-model.ts',
  'dev-mocks/coach-roster-first/team-brief-view.tsx',
];
const sources = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])),
);
const experience = sources['dev-mocks/coach-roster-first/experience.tsx'];
const route = sources['app/(tabs)/dev-mocks/coach-roster-first.tsx'];
const library = sources['dev-mocks/library.ts'];
const registry = sources['dev-mocks/live-screen-registry.ts'];
const material = `${sources['dev-mocks/coach-roster-first/material.tsx']}
${sources['components/coach-mobile/coach-material-layer.tsx']}`;
const teamBriefModel = sources['dev-mocks/coach-roster-first/team-brief-model.ts'];
const teamBriefView = sources['dev-mocks/coach-roster-first/team-brief-view.tsx'];

for (const expected of [
  'PanResponder.create',
  'onLongPress',
  'More actions for',
  'RefreshControl',
  'AccessibilityInfo.isReduceMotionEnabled',
  'contentOffset={{ x: 0, y: scrollOffset }}',
  'contextualPopoverTop',
  'event.nativeEvent.pageY',
  'Open athlete workspace',
  'Team Brief',
  'Roster',
  'Calendar',
  'Videos',
  'Messages',
]) {
  assert(experience.includes(expected), `Missing interaction/accessibility contract: ${expected}`);
}

assert(!/\bfetch(Json)?\b|\baxios\b|\bapiRequest\b/.test(experience), 'The DEV sandbox must not call live APIs.');
assert(experience.includes('const rosterScrollOffset = React.useRef(0)'), 'Scroll restoration must not trigger list-wide rerenders.');
assert(!experience.includes('setRosterScrollOffset'), 'Scroll offset must not be controlled through React state.');
assert(experience.includes('coach-roster-avatar-atlas.png'), 'The roster sandbox must use the local fictional-athlete avatar atlas.');
assert(experience.includes('seededAvatarIndex(name)'), 'Fake-athlete portraits must resolve deterministically from the athlete name.');
assert.equal((experience.match(/<SeededRosterAvatar/g) || []).length, 3, 'Roster, athlete action popout, and command sheet must share seeded athlete portraits.');
assert(experience.includes("hot: '#FF2C9D'"), 'The canonical roster mock must retain the neon-accent visual language.');
assert(experience.includes('CoachMaterialLayer'), 'Roster controls and athlete rows must use the shared coach material primitive.');
assert(experience.includes('function athleteMaterial'), 'Athlete urgency must resolve through one explicit material hierarchy.');
assert(experience.includes('athleteRowPriority'), 'The highest-priority athlete must receive a deliberate hierarchy treatment.');
assert(experience.includes("colors={['#17101F', '#28143A', '#351126']}"), 'Swipe actions must share one integrated material tray.');
assert(!experience.includes("borderColor: 'rgba(255, 44, 157, 0.46)'"), 'Athlete rows must not regress to colored outline rails.');
assert(!experience.includes("rgba(255, 44, 157, 0.10)"), 'Athlete rows must not regress to a full-row magenta wash.');
assert(experience.includes('function FloatingRosterAction'), 'The compact roster shell must keep its floating primary action.');
assert(experience.includes("minHeight: 76"), 'Athlete rows must retain the compact, high-density spec.');
const commandHeroIndex = experience.indexOf('styles.commandHero');
const commandQueueIndex = experience.indexOf('title="Active Coaching Queue"');
const commandToolsIndex = experience.indexOf('>Coaching Tools</Text>');
const athleteContextIndex = experience.indexOf('>Athlete Context</Text>');
assert(
  commandHeroIndex >= 0
    && commandQueueIndex > commandHeroIndex
    && commandToolsIndex > commandQueueIndex
    && athleteContextIndex > commandToolsIndex,
  'The command sheet must render Identity → Active Coaching Queue → Coaching Tools → Athlete Context.',
);
assert(experience.includes('function CoachingTool'), 'The command sheet must use a compact reusable coaching-tool dock.');
assert(experience.includes('function AthleteContextRow'), 'Athlete reference information must use the shared context-row primitive.');
assert(experience.includes('function CurrentTrainingRow'), 'Current Training must use one structured compact context surface.');
assert(experience.includes('<CurrentTrainingRow training={athlete.currentTraining} fallbackProgram={athlete.program} />'), 'The command sheet must render structured scenario data with a backward-safe legacy fallback.');
assert(experience.includes('training?: CurrentTrainingContext'), 'Stale DEV fixture objects must not crash the Current Training renderer.');
assert(experience.includes('if (!training)'), 'Missing structured context must render an honest fallback.');
assert(!experience.includes('label="Training position"'), 'The vague Training Position row must not return.');
const currentTrainingIndex = experience.indexOf('<CurrentTrainingRow training={athlete.currentTraining} fallbackProgram={athlete.program} />');
const readinessIndex = experience.indexOf('label="Readiness"');
const lastSessionIndex = experience.indexOf('label="Last Training Session"');
const upcomingSessionIndex = experience.indexOf('label="Upcoming Training Session"');
const coachContextIndex = experience.indexOf('>COACH CONTEXT</Text>');
assert(
  currentTrainingIndex >= 0
    && readinessIndex > currentTrainingIndex
    && lastSessionIndex > readinessIndex
    && upcomingSessionIndex > lastSessionIndex
    && coachContextIndex > upcomingSessionIndex,
  'Athlete Context must render Current Training → Readiness → Last Training Session → Upcoming Training Session → Coach Context.',
);
for (const requiredTrainingCopy of [
  'No active Training Program',
  'Training position unavailable',
  'No Training Session assigned this week',
  'Day ${training.sessionIndex} of ${training.sessionsThisWeek}',
]) {
  assert(experience.includes(requiredTrainingCopy), `Missing Current Training fallback or explicit position: ${requiredTrainingCopy}`);
}
assert(experience.includes('Mark ${item.title} complete'), 'Every queue item must expose a visible accessible completion action.');
assert(!experience.includes('commandQuickGrid'), 'Oversized utility tiles must not return ahead of the active queue.');
assert(!experience.includes('commandMetricGrid'), 'Athlete context must not regress to a dashboard metric grid.');
assert(!experience.includes('<ScenarioPicker'), 'The visual-authority roster surface must not be displaced by a large DEV scenario panel.');
assert(experience.includes('styles.athletePopover'), 'Athlete actions must use the compact contextual popout.');
assert(!experience.includes('style={styles.actionSheet}'), 'Athlete actions must not regress to a full-width bottom sheet.');
assert(!experience.includes('paddingTop: 104'), 'Athlete actions must not regress to a fixed top-screen position.');
assert(experience.includes('anchorY: number'), 'Athlete action popouts must retain their tapped-row anchor.');
assert(!experience.includes('>Cancel</Text>'), 'The contextual popout should dismiss outside or through its close control.');
assert(route.includes('if (!__DEV__) return null'), 'The route must be guarded outside DEV.');
assert.equal((library.match(/category: 'Coach Mobile — Roster First'/g) || []).length, 26, 'The library must expose the core surfaces, athlete workspaces, training-context states, and Team Brief scenarios.');
for (const scenarioId of workspaceScenarioIds) {
  assert(library.includes(`scenario=${scenarioId}`), `The UI Mock Library must expose ${scenarioId}.`);
}
assert(registry.includes("app/(tabs)/dev-mocks/coach-roster-first.tsx"), 'The route registry must classify the visual exploration explicitly.');
assert(material.includes('SLMovementCardMaterial.face'), 'Coach materials must inherit the canonical logger face construction.');
assert(material.includes('SLMovementCardMaterial.neutralBorder'), 'Coach materials must use a neutral precision border.');
assert(material.includes('SLMovementCardMaterial.innerBevel'), 'Coach materials must preserve the canonical inner-bevel depth cue.');
assert(!material.includes('repeating-linear-gradient'), 'Coach materials must not procedurally fake metal with repeated streaks.');
for (const removedDashboardConcept of ['Recent Team Activity', 'briefMetrics', 'Reviews Waiting', 'Upcoming · Next 7 Days']) {
  assert(!teamBriefView.includes(removedDashboardConcept), `Team Brief regressed to dashboard/feed content: ${removedDashboardConcept}`);
}
for (const requiredSummarySection of ['Needs Attention', 'Coming Up', 'Team Health', 'Blind Spots']) {
  assert(teamBriefModel.includes(requiredSummarySection), `Missing Team Brief executive-summary section: ${requiredSummarySection}`);
}
for (const removedReportLanguage of [
  'COACHING IMPLICATION',
  'Synthesized implications',
  'Start with Marcus',
  'Protect Friday',
  'orientation',
  'implication',
  'synthesis',
]) {
  assert(
    !`${teamBriefModel}\n${teamBriefView}`.includes(removedReportLanguage),
    `Team Brief regressed to report-style explanation: ${removedReportLanguage}`,
  );
}
assert(teamBriefView.includes('accessibilityRole="button"'), 'Every Team Brief item must remain accessible without gestures.');
assert(teamBriefView.includes('accessibilityLabel={`${item.headline}. ${item.supportingLine}. Open`}'), 'Accessible item labels must include the decision and action.');
assert(!/\bfetch(Json)?\b|\baxios\b|\bapiRequest\b/.test(`${teamBriefModel}\n${teamBriefView}`), 'Team Brief scenarios must remain deterministic and local.');

for (const path of [
  'dev-mocks/coach-roster-first/model.ts',
  'dev-mocks/coach-roster-first/experience.tsx',
  'app/(tabs)/dev-mocks/coach-roster-first.tsx',
  'dev-mocks/coach-roster-first/team-brief-model.ts',
  'dev-mocks/coach-roster-first/team-brief-view.tsx',
]) {
  assert(!/\bworkouts?\b/i.test(sources[path]), `${path} leaks disallowed user-facing legacy terminology.`);
}

console.log('Coach roster-first sandbox regression checks passed.');
