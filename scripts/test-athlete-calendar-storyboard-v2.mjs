import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [storyboard, route, model] = await Promise.all([
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/AthleteCalendarExperience.tsx', import.meta.url), 'utf8'),
]);

assert.match(storyboard, /<FlatList[\s\S]*?maintainVisibleContentPosition/, 'Calendar virtualizes a stable month timeline');
assert.match(storyboard, /createCalendarBoundaryGuard/, 'Calendar pagination is gated by deliberate scroll gestures');
assert.doesNotMatch(storyboard, /onStartReached=|onEndReached=/, 'Calendar never auto-paginates merely because an edge mounted');
assert.match(storyboard, /initialNumToRender=\{CALENDAR_INITIAL_MONTHS\}/, 'Calendar limits the initial native mount transaction');
assert.match(storyboard, /maxToRenderPerBatch=\{CALENDAR_RENDER_BATCH\}/, 'Calendar mounts one month batch at a time');
assert.match(storyboard, /windowSize=\{CALENDAR_WINDOW_SIZE\}/, 'Calendar keeps a bounded native render window');
assert.match(storyboard, /getItemLayout=/, 'Calendar has deterministic month geometry for Fabric scrolling');
assert.doesNotMatch(storyboard, /onScrollToIndexFailed/, 'Calendar has no unbounded scroll-to-index retry loop');
assert.match(storyboard, /length: 42/, 'Every month uses a fixed six-week grid');
assert.match(storyboard, /lensVisible \? \([\s\S]*?<DayLens/, 'Day Lens content mounts only when requested');
assert.match(storyboard, /onOpenSummary=\{\(\) => setSummaryMonth\(item\)\}/, 'month headers open summaries on demand');
assert.match(storyboard, /<MonthSummarySheet/, 'month summary is a dedicated contextual surface');
assert.match(storyboard, /setLensVisible\(true\)[\s\S]*?lensVisible \? \(/, 'tap-to-open day lens is the primary detail interaction');
assert.doesNotMatch(storyboard, /PULL UP FOR DAY DETAIL|TRAINING JOURNEY|AUGUST SUMMARY/, 'rejected month-page architecture is absent');
assert.match(storyboard, /detail\.isToday[\s\S]*?type: 'daily-readiness'/, 'today recovery state exposes the optional canonical readiness action');
assert.doesNotMatch(storyboard, /RecoveryLens[\s\S]*?Begin Session/, 'recovery lens never exposes Begin Session');
assert.match(storyboard, /View Session Recap[\s\S]*?type: 'session'/, 'completed state routes to the canonical Session surface');
assert.match(storyboard, /Open Session[\s\S]*?type: 'session'/, 'assigned state routes to the canonical Session surface');
assert.match(storyboard, /Resume Session/, 'in-progress state retains Resume language');
assert.match(storyboard, /data\.monthSummaries/, 'month insights consume backend-projected canonical evidence');
assert.match(storyboard, /reportedBodyweight[\s\S]*?startKg[\s\S]*?latestKg/, 'reported bodyweight uses stored month observations without interpolation');
assert.match(storyboard, /TRAINING_ART[\s\S]*?gym_vibe\.jpg/, 'training day uses approved non-human Strength Ledger artwork');
assert.match(storyboard, /RECOVERY_ART[\s\S]*?gym_vibe\.jpg/, 'recovery day uses an existing non-human environment asset');
assert.match(storyboard, /root:\s*\{\s*flex: 1,\s*width: '100%'/, 'Calendar remains edge-to-edge without page-level horizontal padding');
assert.match(storyboard, /<FilterSheet/, 'filters live in a secondary dedicated surface');
assert.match(storyboard, /<JumpSheet/, 'compact date jump coexists with continuous scrolling');
assert.match(storyboard, /searchResults/, 'compact search locates real Calendar evidence');

assert.match(route, /previousCalendarRange/, 'route incrementally loads historical pages');
assert.match(route, /nextCalendarRange/, 'route incrementally loads future pages');
assert.match(route, /method: 'POST'[\s\S]*?athletes\/mobile\/readiness\/daily|athletes\/mobile\/readiness\/daily[\s\S]*?method: 'POST'/, 'recovery check-in persists through the canonical daily endpoint');
assert.match(route, /<ReadinessModal[\s\S]*?context="daily"/, 'Calendar reuses the canonical readiness survey');
assert.match(route, /month_summaries/, 'route maps backend month summaries');
assert.match(route, /\{visiblePayload \? <AthleteCalendarStoryboardV2/, 'the full Calendar tree does not mount before its canonical payload');
assert.match(model, /workoutId\?: number \| null/, 'readiness continues to model nullable Session association');
assert.match(model, /type: 'daily-readiness'/, 'Calendar action contract models recovery readiness explicitly');

console.log('Athlete Calendar storyboard V2 architecture and recovery/session-state contracts passed.');
