import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  canonicalCalendarRangeForMonth,
  createCalendarBoundaryGuard,
  createCalendarRangeRequestManager,
  MAX_CALENDAR_API_RANGE_DAYS,
  nextCalendarRange,
  previousCalendarRange,
} from '../lib/calendar-range-pagination.ts';
import { selectFeaturedCalendarEventKey } from '../lib/calendar-presentation.ts';
import { resolveCalendarSessionStatus } from '../lib/calendar-session-status.ts';
import {
  calendarProgramIntersectsMonth,
  calendarProgramStartsInMonth,
  calendarTrainingRangeForDate,
  calendarTrainingRangesForMonth,
  formatCalendarStructureDate,
  formatCalendarStructureRange,
} from '../lib/calendar-training-structure.ts';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

assert.deepEqual(nextCalendarRange('2026-07-31'), { start: '2026-07-31', end: '2026-09-11' });
assert.deepEqual(previousCalendarRange('2026-08-01'), { start: '2026-06-20', end: '2026-08-01' });
assert.deepEqual(
  canonicalCalendarRangeForMonth(new Date(2026, 6, 1)),
  { start: '2026-06-14', end: '2026-08-23' },
  'July uses the canonical fixed-length API window',
);
assert.deepEqual(
  canonicalCalendarRangeForMonth(new Date(2026, 7, 1)),
  { start: '2026-07-12', end: '2026-09-20' },
  'August must not exceed the backend range limit',
);
assert.equal(MAX_CALENDAR_API_RANGE_DAYS, 70, 'the mobile range limit matches the backend calendar contract');

{
  const blocks = [
    { id: 1, label: 'Base', start: '2026-07-27', end: '2026-08-23' },
    { id: 2, label: 'Progression', start: '2026-08-24', end: '2026-09-20' },
  ];
  assert.deepEqual(
    calendarTrainingRangesForMonth(blocks, new Date(2026, 7, 1)).map((block) => block.label),
    ['Base', 'Progression'],
    'a transition month exposes every intersecting Training Block in chronological order',
  );
  assert.equal(
    calendarTrainingRangeForDate(blocks, '2026-08-23')?.label,
    'Base',
    'the final day remains inside its Training Block',
  );
  assert.equal(
    calendarTrainingRangeForDate(blocks, '2026-08-24')?.label,
    'Progression',
    'the next day transitions to the next Training Block',
  );
  assert.equal(
    calendarProgramIntersectsMonth(
      { id: 10, name: 'Offseason', start: '2026-07-27', end: '2026-11-21' },
      new Date(2026, 9, 1),
    ),
    true,
    'Program context spans every month within the live Program range',
  );
  assert.equal(
    calendarProgramStartsInMonth(
      { id: 10, name: 'Offseason', start: '2026-07-27', end: '2026-11-21' },
      new Date(2026, 6, 1),
    ),
    true,
    'the Program chapter marker appears in the Program start month',
  );
  assert.equal(
    calendarProgramStartsInMonth(
      { id: 10, name: 'Offseason', start: '2026-07-27', end: '2026-11-21' },
      new Date(2026, 7, 1),
    ),
    false,
    'the Program chapter marker does not repeat in later months',
  );
  assert.equal(
    formatCalendarStructureDate('2026-07-27'),
    'Jul 27, 2026',
    'Program chapter dates remain compact and explicit',
  );
  assert.equal(
    formatCalendarStructureRange('2026-07-27', '2026-11-21'),
    'Jul 27 – Nov 21, 2026',
    'structural date ranges are compact but explicit',
  );
}

assert.deepEqual(resolveCalendarSessionStatus('assigned'), { lifecycle: 'not_started', label: 'Not Started', tone: 'gold' });
assert.deepEqual(resolveCalendarSessionStatus('in_progress'), { lifecycle: 'in_progress', label: 'In Progress', tone: 'violet' });
assert.deepEqual(resolveCalendarSessionStatus('logged'), { lifecycle: 'completed', label: 'Completed', tone: 'green' });
assert.deepEqual(resolveCalendarSessionStatus('completed'), { lifecycle: 'completed', label: 'Completed', tone: 'green' });
assert.deepEqual(resolveCalendarSessionStatus('missed'), { lifecycle: 'missed', label: 'Missed', tone: 'red' });
assert.deepEqual(resolveCalendarSessionStatus('cancelled'), { lifecycle: 'canceled', label: 'Canceled', tone: 'red' });

{
  const days = [
    { date: '2026-07-21', sessions: [{ id: 1 }], personalEvents: [] },
    { date: '2026-07-22', isToday: true, sessions: [{ id: 2 }, { id: 3 }], personalEvents: [{ id: 4 }] },
    { date: '2026-07-23', sessions: [{ id: 5 }], personalEvents: [] },
  ];
  assert.equal(selectFeaturedCalendarEventKey(days, '2026-07-22'), 'session:2', 'exactly one ordinary item expands on today');
  assert.equal(
    selectFeaturedCalendarEventKey(days.map((day) => ({ ...day, isToday: false })), '2026-07-20'),
    'session:1',
    'the nearest future item expands when today has no item',
  );
  assert.equal(selectFeaturedCalendarEventKey([], '2026-07-22'), null, 'an empty Calendar has no artificial featured item');
}

{
  const guard = createCalendarBoundaryGuard({ threshold: 240, hysteresis: 120, minimumMovement: 8 });
  guard.begin(100);
  assert.equal(guard.update({ offsetY: 100, remaining: 120 }), false, 'touch-and-hold must not fetch');
  assert.equal(guard.update({ offsetY: 104, remaining: 116 }), false, 'sub-threshold jitter must not fetch');
  assert.equal(guard.update({ offsetY: 116, remaining: 104 }), true, 'a deliberate downward boundary crossing fetches once');
  assert.equal(guard.update({ offsetY: 140, remaining: 80 }), false, 'remaining near the edge must not auto-chain');
  guard.end();

  guard.begin(140);
  assert.equal(guard.update({ offsetY: 155, remaining: 65 }), false, 'a new gesture does not bypass boundary hysteresis');
  assert.equal(guard.update({ offsetY: 20, remaining: 500 }), false, 'leaving the boundary rearms without fetching');
  assert.equal(guard.update({ offsetY: 300, remaining: 180 }), true, 're-entering after leaving allows one new page');
  guard.end();
}

{
  let requestCount = 0;
  const manager = createCalendarRangeRequestManager(async (range, signal) => {
    requestCount += 1;
    await wait(10);
    if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    return { days: [], range };
  });
  const range = { start: '2026-07-01', end: '2026-08-11' };

  const [first, duplicate] = await Promise.all([
    manager.request(range),
    manager.request(range),
  ]);
  assert.equal(requestCount, 1, 'concurrent requests for one range must dedupe');
  assert.deepEqual(first.value, duplicate.value);
  assert.equal(duplicate.source, 'inflight');

  const cached = await manager.request(range);
  assert.equal(cached.source, 'cache');
  assert.equal(requestCount, 1, 'revisiting a cached range must not hit the network');

  await manager.request(range, { force: true });
  assert.equal(requestCount, 2, 'explicit refresh may refetch exactly once');
}

{
  let call = 0;
  const manager = createCalendarRangeRequestManager((range, signal) => new Promise((resolve, reject) => {
    call += 1;
    const revision = call;
    const timer = setTimeout(() => resolve({ range, revision }), revision === 1 ? 40 : 5);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  }));
  const range = { start: '2026-07-01', end: '2026-08-11' };
  const stale = manager.request(range);
  await wait(2);
  const refreshed = manager.request(range, { force: true });
  await assert.rejects(stale, (error) => error?.name === 'AbortError');
  assert.equal((await refreshed).value.revision, 2, 'forced revalidation replaces an in-flight stale response');
}

{
  const range = { start: '2026-07-01', end: '2026-08-11' };
  const athleteOne = createCalendarRangeRequestManager(async () => ({ athlete: 1 }), { cacheScope: 'athlete:1' });
  const athleteTwo = createCalendarRangeRequestManager(async () => ({ athlete: 2 }), { cacheScope: 'athlete:2' });
  assert.notEqual(
    (await athleteOne.request(range)).key,
    (await athleteTwo.request(range)).key,
    'calendar cache keys are isolated by authenticated athlete/account scope',
  );
}

{
  const calls = [];
  const manager = createCalendarRangeRequestManager((range, signal) => new Promise((resolve, reject) => {
    calls.push(range);
    const timer = setTimeout(() => resolve(range), 30);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  }));
  const stale = manager.request({ start: '2026-07-01', end: '2026-08-11' });
  await wait(2);
  const current = manager.request({ start: '2026-08-01', end: '2026-09-11' }, { cancelStale: true });
  await assert.rejects(stale, (error) => error?.name === 'AbortError');
  assert.deepEqual((await current).value, { start: '2026-08-01', end: '2026-09-11' });
  assert.equal(calls.length, 2);
  assert.equal(manager.inflightCount(), 0);
}

{
  const modalSource = await readFile(new URL('../components/calendar/CalendarEventSheet.tsx', import.meta.url), 'utf8');
  const screenSource = await readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8');
  const experienceSource = await readFile(new URL('../components/calendar/AthleteCalendarExperience.tsx', import.meta.url), 'utf8');
  const tabLayoutSource = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const tabRowControlSource = await readFile(
    new URL('../components/navigation/sl-tab-row-control.tsx', import.meta.url),
    'utf8',
  );
  const idealStateSource = await readFile(
    new URL('../dev-mocks/production-ideal-state.ts', import.meta.url),
    'utf8',
  );
  assert.match(modalSource, /presentationStyle="pageSheet"/, 'Calendar editor uses one supported sheet presentation');
  assert.doesNotMatch(modalSource, /<Modal[^>]*\btransparent(?:=|\s|>)/, 'pageSheet must not request transparent presentation');
  assert.equal((screenSource.match(/<CalendarEventSheet\b/g) || []).length, 1, 'Calendar owns one screen-level event editor');
  assert.ok(
    screenSource.includes('useFocusEffect(useCallback(() => { void load(true, false); }'),
    'returning to Calendar forces live revalidation',
  );
  assert.ok(screenSource.includes("AppState.addEventListener('change'"), 'foregrounding the app revalidates Calendar');
  assert.ok(screenSource.includes("cache: 'no-store'"), 'Calendar network requests bypass HTTP response caches');
  assert.ok(screenSource.includes('calendarIdentityScope'), 'Calendar cache state is scoped to the authenticated athlete/account');
  assert.ok(
    screenSource.includes('if (force) requestManagerRef.current!.clear()'),
    'foreground, focus, pull-to-refresh, and mutation revalidation clear every cached Calendar page',
  );
  assert.ok(
    screenSource.includes('payloadOwnerScope === calendarIdentityScope ? payload : null'),
    'Calendar never renders payload owned by a previous athlete/account scope',
  );
  assert.ok(screenSource.includes('setPayload(null)'), 'account/program identity changes clear stale Calendar payload before replacement data renders');
  assert.ok(
    idealStateSource.includes('if (!isProductionIdealStateActive()) return null;'),
    'fabricated Ideal State data remains explicitly gated and cannot enter the live Calendar',
  );
  assert.match(experienceSource, /initialView = 'month'/, 'Calendar opens directly into the canonical month experience');
  assert.doesNotMatch(screenSource, /\binitialView=/, 'the production route must not override the canonical month entry');
  assert.doesNotMatch(
    experienceSource,
    /AsyncStorage|DISPLAY_MODE_KEY|CalendarDisplayMode|ViewMenu|ListView|initialMode|persistDisplayMode/,
    'retired view preference, picker, and alternate renderers must not remain',
  );
  assert.doesNotMatch(
    experienceSource,
    /<Text style=\{styles\.monthHeading\}>Schedule<\/Text>/,
    'the retired Schedule/List screen must not remain',
  );
  assert.doesNotMatch(
    experienceSource,
    /accessibilityLabel="Calendar view"|label: 'Compact'|label: 'Stacked'|label: 'Details'|label: 'List'/,
    'the Calendar view picker and its mode choices must not remain',
  );
  assert.match(
    experienceSource,
    /signals\.slice\(0, 2\)\.map[\s\S]*?<Text numberOfLines=\{1\} style=\{styles\.signalText\}>\{signal\.title\}<\/Text>/,
    'month cells always render the canonical Details event pills',
  );
  assert.match(
    experienceSource,
    /date\.getFullYear\(\) === month\.getFullYear\(\) && date\.getMonth\(\) === month\.getMonth\(\)[\s\S]*?if \(!inMonth\) \{[\s\S]*?return <View[^>]*style=\{styles\.dayCell\}/,
    'adjacent-month grid positions remain blank instead of duplicating dates and events across month sections',
  );
  assert.match(
    experienceSource,
    /const hasTrainingSession = Boolean\(day\?\.sessions\.length\)[\s\S]*?<LinearGradient[\s\S]*?SLMovementCardMaterial\.stateAccent\.in_progress[\s\S]*?style=\{styles\.sessionDayUnderglow\}/,
    'days containing a Training Session reuse the Training Hub gold underglow treatment',
  );
  assert.match(experienceSource, /dayCell:.*overflow:\s*'hidden'.*/, 'the Training Session glow is clipped inside its day cell');
  assert.match(
    experienceSource,
    /sessionDayUnderglow:\s*\{[^}]*position:\s*'absolute'[^}]*bottom:\s*0/,
    'the Training Session glow rises from the day-cell boundary',
  );
  assert.ok(
    experienceSource.includes('calendarTrainingRangesForMonth')
      && experienceSource.includes('calendarTrainingRangeForDate')
      && experienceSource.includes('calendarProgramStartsInMonth'),
    'month rendering consumes canonical Training Block and Program date ranges',
  );
  assert.match(
    experienceSource,
    /isCurrent \? 'CURRENT BLOCK' : 'TRAINING BLOCK'[\s\S]*?formatCalendarStructureRange\(block\.start, block\.end\)/,
    'the current Training Block identity and date range are exposed above its month grid',
  );
  assert.match(
    experienceSource,
    /showProgramChapter && data\.programContext[\s\S]*?<ProgramChapterDivider program=\{data\.programContext\}/,
    'the parent Program becomes a single chapter marker in its start month',
  );
  assert.match(
    experienceSource,
    /NEW TRAINING PROGRAM[\s\S]*?program\.name \|\| 'Training Program'[\s\S]*?formatCalendarStructureDate\(program\.start\)/,
    'the Program chapter marker includes identity and its start date',
  );
  assert.doesNotMatch(
    experienceSource,
    /PROGRAM · \{formatCalendarStructureRange\(data\.programContext\.start, data\.programContext\.end\)\}/,
    'Program context must not repeat as month-level metadata',
  );
  assert.match(
    experienceSource,
    /blockDayAtmosphere:.*absoluteFillObject/,
    'Training Block atmosphere stays behind the existing date and event layers',
  );
  assert.match(
    experienceSource,
    /backgroundColor: colorWithAlpha\(blockAccent, isCurrentBlock \? 0\.045 : 0\.025\)/,
    'Training Block atmosphere remains within the restrained 2–5% opacity range',
  );
  assert.doesNotMatch(
    experienceSource,
    /blockBoundary(?:Start|End)?/,
    'Training Blocks must not introduce explicit start/end divider rails',
  );
  assert.match(
    experienceSource,
    /toolbar:\s*\{[^}]*position:\s*'absolute'[^}]*zIndex:\s*30/,
    'Calendar year, search, and add controls remain a pinned floating overlay',
  );
  assert.match(
    experienceSource,
    /bottomControls:\s*\{[^}]*position:\s*'absolute'[^}]*zIndex:\s*20/,
    'Today and Calendar mode controls remain a pinned floating overlay',
  );
  assert.match(
    experienceSource,
    /<View pointerEvents="box-none" style=\{styles\.toolbar\}>/,
    'the floating toolbar does not block Calendar interaction between controls',
  );
  assert.match(
    experienceSource,
    /onPress=\{\(\) => onSelectDate\(ymd\)\}/,
    'date selection remains wired from the month grid',
  );
  assert.match(
    experienceSource,
    /const normalized = query\.trim\(\)\.toLowerCase\(\)[\s\S]*?values\.some\(\(value\) => value\.toLowerCase\(\)\.includes\(normalized\)\)/,
    'search continues filtering the canonical Details calendar data',
  );
  assert.match(
    experienceSource,
    /const target = onToday\(\) \|\| data\.today;[\s\S]*?setSelectedDate\(target\)/,
    'Today continues selecting the canonical current date',
  );
  assert.match(
    experienceSource,
    /day\.sessions\.map[\s\S]*?type: 'session'[\s\S]*?day\.personalEvents[\s\S]*?type: 'edit-event'/,
    'training and personal events remain rendered and actionable through Details pills',
  );
  assert.match(experienceSource, /accessibilityLabel="Next year"/, 'month toolbar exposes forward year navigation');
  assert.match(experienceSource, /addMonths\(anchorMonth, 12\)/, 'forward year navigation advances exactly twelve months');
  assert.doesNotMatch(experienceSource, /file-tray-outline/, 'bottom Calendar controls do not render the archive tray');
  assert.match(
    experienceSource,
    /from '@\/components\/navigation\/sl-tab-row-control'/,
    'Calendar imports the actual shared tab-row control system',
  );
  assert.equal(
    (experienceSource.match(/<SLTabRowControlShell density="utility">/g) || []).length,
    4,
    'all four Calendar control areas use the shared utility-scale tab-row shell',
  );
  assert.match(
    experienceSource,
    /accessibilityLabel="Search Calendar"[\s\S]*?onPress=\{onSearch\}/,
    'the shared search segment preserves its Calendar action',
  );
  assert.match(
    experienceSource,
    /accessibilityLabel="Add event"[\s\S]*?onPress=\{\(\) => onAction\(\{ type: 'add-event', date: selectedDate \}\)\}/,
    'the shared add segment preserves its Calendar action',
  );
  assert.match(
    experienceSource,
    /accessibilityLabel="Today"[\s\S]*?onPress=\{onToday\}/,
    'the shared Today control preserves its Calendar action',
  );
  assert.match(
    experienceSource,
    /accessibilityLabel=\{view === 'day' \? 'Month view' : 'Day view'\}[\s\S]*?onPress=\{onView\}/,
    'the shared day drill-in control preserves its Calendar action',
  );
  assert.match(
    experienceSource,
    /Gesture\.Pan\(\)[\s\S]*?activeOffsetX\(\[-24, 24\]\)[\s\S]*?onUpdate\(\(\{ translationX \}\)[\s\S]*?weekTranslateX\.setValue[\s\S]*?transitionWeek\(translationX < 0 \? 1 : -1\)/,
    'agenda mode supports deliberate left/right gestures for next and previous week navigation',
  );
  assert.match(
    experienceSource,
    /Animated\.timing\(weekTranslateX,[\s\S]*?toValue: outgoingX[\s\S]*?commitDate\(\)[\s\S]*?weekTranslateX\.setValue\(incomingX\)[\s\S]*?Animated\.timing\(weekTranslateX,[\s\S]*?toValue: 0/,
    'committed agenda swipes animate the old week out and the new week in from the opposite edge',
  );
  assert.match(
    experienceSource,
    /<Animated\.View[\s\S]*?agendaWeekRow[\s\S]*?transform: \[\{ translateX: weekTranslateX \}\][\s\S]*?styles\.weekHeader[\s\S]*?styles\.weekStrip[\s\S]*?<\/Animated\.View>[\s\S]*?<Text style=\{styles\.dayTitle\}>/,
    'only the weekday/date row consumes the directional swipe animation',
  );
  assert.doesNotMatch(
    experienceSource,
    /<Animated\.View(?:(?!<\/Animated\.View>)[\s\S])*<ScrollView ref=\{scrollRef\}/,
    'the date title and agenda contents must remain outside the animated week row',
  );
  assert.match(
    experienceSource,
    /if \(reduceMotion\) \{[\s\S]*?commitDate\(\)[\s\S]*?weekTranslateX\.setValue\(0\)/,
    'agenda navigation respects the system Reduced Motion preference',
  );
  assert.match(
    experienceSource,
    /accessibilityHint="Swipe left or right to change weeks"/,
    'agenda week navigation exposes the swipe behavior to assistive technology',
  );
  assert.match(
    experienceSource,
    /toolbarPeriodLabel:\s*\{\s*paddingHorizontal:\s*SLSpacing\.xs\s*\}/,
    'the compact month label receives explicit side padding inside its shared control shell',
  );
  assert.doesNotMatch(
    experienceSource,
    /toolbarControlGroup|toolbarControlSurface|backPill|yearArrow|toolbarIcon|bottomHitArea|bottomPill|todayPill|modePill|SLControlSize|SLIconSize/,
    'Calendar-specific mini-control shells and sizing constants must not return',
  );
  assert.match(
    experienceSource,
    /bottomControls:\s*\{[^}]*position:\s*['"]absolute['"]/,
    'bottom Calendar controls float above Calendar content without consuming layout height',
  );
  assert.doesNotMatch(
    experienceSource,
    /marginBottom:\s*66 \+ bottomInset/,
    'floating Calendar controls must not reserve an in-flow bottom clearance block',
  );
  assert.match(
    experienceSource,
    /bottomControls:\s*\{[^}]*right:\s*0[^}]*alignItems:\s*'flex-end'[^}]*gap:\s*SLSpacing\.sm/,
    'Today is stacked on the right directly above the day/month selector',
  );
  assert.match(
    experienceSource,
    /style=\{\[styles\.bottomControls,\s*\{\s*bottom:\s*66 \+ bottomInset\s*\}\]\}/,
    'floating Calendar controls clear the collapsed global tab row without changing page layout',
  );
  assert.match(
    experienceSource,
    /toolbar:\s*\{[^}]*paddingHorizontal:\s*SLLayout\.screenGutter/,
    'Calendar toolbar controls align to the canonical header and tab-row screen gutter',
  );
  assert.match(
    experienceSource,
    /bottomControls:\s*\{[^}]*paddingRight:\s*SLLayout\.screenGutter/,
    'Today and the day/month selector align to the canonical tab-row screen gutter',
  );
  assert.match(
    tabLayoutSource,
    /normalizedPathname\.endsWith\('\/athlete-calendar'\)[\s\S]*?normalizedPathname\.includes\('\/dev-mocks\/calendar-'\)/,
    'live and DEV Calendar routes opt out of the global page gutter',
  );
  assert.match(
    tabLayoutSource,
    /fullBleedTabScene:\s*\{[\s\S]*?paddingHorizontal:\s*0/,
    'the Calendar scene removes page-level horizontal padding',
  );
  assert.match(
    tabLayoutSource,
    /SL_TAB_ROW_CONTROL[\s\S]*SL_TAB_ROW_FALLBACK_SHEEN[\s\S]*SL_TAB_ROW_SELECTED_LENS/,
    'the production tab row consumes the same shared token source as Calendar',
  );
  assert.match(tabRowControlSource, /shellHeight:\s*48/, 'the approved tab-row shell height remains centralized');
  assert.match(tabRowControlSource, /itemSize:\s*40/, 'the approved tab-row item size remains centralized');
  assert.match(
    tabRowControlSource,
    /utilityShell:\s*\{[\s\S]*height:\s*SL_TAB_ROW_CONTROL\.itemSize[\s\S]*borderRadius:\s*SL_TAB_ROW_CONTROL\.itemRadius[\s\S]*padding:\s*0/,
    'Calendar utility shells derive their compact footprint from the real tab segment instead of new dimensions',
  );
  assert.match(tabRowControlSource, /indicatorSize:\s*38/, 'the approved selected-lens size remains centralized');
  assert.match(tabRowControlSource, /iconSize:\s*24/, 'the approved tab-row icon size remains centralized');
  assert.match(
    tabRowControlSource,
    /hitSlop:\s*4[\s\S]*hitSlop=\{SL_TAB_ROW_CONTROL\.hitSlop\}/,
    '40px visual segments retain a 48px effective accessibility target',
  );
  assert.match(experienceSource, /resolveCalendarSessionStatus\(session\.status\)/, 'Calendar rows derive presentation from payload status');
  assert.doesNotMatch(experienceSource, /\bfetchJson\b/, 'Calendar presentation must not fetch status per row');
}

console.log('Calendar pagination state machine checks passed.');
