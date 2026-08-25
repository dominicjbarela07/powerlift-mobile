import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const swipeRow = fs.readFileSync(path.join(root, 'components/gestures/SwipeActionRow.tsx'), 'utf8');

assert.match(swipeRow, /foregroundStyle\?: StyleProp<ViewStyle>/, 'the shared swipe primitive must support an opaque foreground material');
assert.match(swipeRow, /style=\{\[styles\.foreground, foregroundStyle, animatedStyle\]\}/, 'the foreground must own full-width material above the hidden action tray');
assert.match(swipeRow, /foreground:\s*\{[\s\S]*?width: '100%'/, 'the swipe foreground must retain the complete row width');

assert.match(manager, /const \[openSwipeSessionId, setOpenSwipeSessionId\] = useState<number \| null>\(null\)/, 'one authoritative row ID must own open state');
assert.match(manager, /isOpen=\{openSwipeSessionId === session\.id\}/, 'only the owned Session may render open');
assert.match(manager, /onRequestOpen=\{\(\) => setOpenSwipeSessionId\(session\.id\)\}/, 'opening a row must replace the previous owner');
assert.match(manager, /onScrollBeginDrag=\{\(\) => setOpenSwipeSessionId\(null\)\}/, 'vertical scrolling must close an exposed row');
assert.match(manager, /useEffect\(\(\) => \{\s*setOpenSwipeSessionId\(null\);\s*\}, \[selectedBlock\?\.id, selectedWeekIndex\]\)/, 'Week and Block changes must reset swipe state');

assert.match(manager, /foregroundStyle=\{storyStyles\.sessionSwipeForeground\}/, 'Programming Sessions must paint an opaque foreground above the tray');
assert.match(manager, /style=\{storyStyles\.sessionSwipeFrame\}/, 'each Session must own an independently clipped swipe frame');
assert.match(manager, /sessionSwipeFrame:\s*\{[^\n]*overflow: 'hidden'[^\n]*borderRadius:/, 'revealed actions must be clipped to one rounded Session row');
assert.match(manager, /sessionSwipeForeground:\s*\{[^\n]*width: '100%'[^\n]*backgroundColor: '#0B0D13'/, 'closed rows must reserve no action gutter and fully cover the action tray');
assert.match(manager, /compactWeekSessions:\s*\{[^\n]*gap: 6/, 'independent rows must retain visible separation');

assert.match(manager, />SESSIONS THIS WEEK</, 'the all-Week list must use an honest Week-level heading');
assert.match(manager, /Add target \{formatLongDate\(selectedDay\.date\)\}/, 'the selected day must be described only as the Add Session target');
assert.doesNotMatch(manager, /<Text style=\{storyStyles\.selectedDayLabel\}>\{formatLongDate\(selectedDay\.date\)\}<\/Text>/, 'the Week list must not masquerade as a selected-day-only list');

console.log('Programming Manager swipe interaction hotfix contracts passed.');
