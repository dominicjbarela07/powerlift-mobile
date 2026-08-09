import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const theme = read('constants/theme.ts');
const motion = read('lib/motion.ts');
const primitives = read('components/ui/sl-motion.tsx');
const button = read('components/ui/sl-button.tsx');
const listRow = read('components/ui/sl-list-row.tsx');
const coreLoggers = read('components/workout-logger/core-loggers.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const floatingNavigationMotion = read('components/navigation/floating-navigation-motion.ts');
const feedback = read('components/workout-logger/logger-feedback.tsx');
const completion = read('components/workout-logger/stage5-impact-summary.tsx');
const readiness = read('components/workout-logger/readiness-modal.tsx');

for (const token of ['immediateMs', 'pressMs', 'stateMs', 'componentMs', 'spatialMs', 'directSpring', 'settleSpring']) {
  assert.match(theme, new RegExp(`\\b${token}\\b`), `motion token ${token} is required`);
}

assert.match(motion, /useSyncExternalStore/, 'Reduced Motion must use one shared observable contract');
assert.match(motion, /reduceMotionChanged/, 'Reduced Motion must respond to live setting changes');
assert.match(motion, /listeners\.size === 0[\s\S]*nativeSubscription\?\.remove/, 'native accessibility subscription must be cleaned up');
assert.match(motion, /return reduceMotion \? 0 : durationMs/, 'Reduced Motion must collapse nonessential durations');

assert.match(primitives, /scale\.stopAnimation\(\)/, 'press feedback must be interruption safe');
assert.match(primitives, /return \(\) => animation\.stop\(\)/, 'entrance and metric animations must clean up');
assert.match(primitives, /pressScale = SLMotion\.pressScale/, 'shared controls must use the motion contract');
assert.match(primitives, /if \(reduceMotion\)/, 'shared primitives must provide a Reduced Motion path');
assert.match(primitives, /const resolvedStyle = typeof style === 'function'/, 'motion pressable must resolve callback styles before passing them to AnimatedPressable');
assert.doesNotMatch(primitives, /<AnimatedPressable[\s\S]*?style=\{\(state\)/, 'AnimatedPressable must not receive callback-valued layout styles');
assert.match(button, /const variantStyles:[\s\S]*primary:[\s\S]*secondary:[\s\S]*ghost:[\s\S]*danger:/, 'shared buttons must retain concrete workspace-system variant surfaces');
assert.doesNotMatch(button, /variantSurface|innerSurface/, 'shared buttons must not reintroduce a duplicate nested surface');
assert.match(listRow, /disabled=\{disabled\}/, 'static informational rows must not inherit disabled opacity');
assert.match(coreLoggers, /return hasPreSessionDetails \? \([\s\S]*?<SLMotionPressable[\s\S]*?: \([\s\S]*?<View/, 'non-expandable movement rows must remain fully legible');

assert.match(tabs, /SLMotionPressable/, 'floating navigation must use shared press feedback');
assert.match(tabs, /Haptics\.selectionAsync/, 'navigation selection should receive restrained tactile feedback');
assert.match(tabs, /useFloatingNavigationMotion/, 'floating navigation must use the shared expansion choreography');
assert.match(floatingNavigationMotion, /expansion\.stopAnimation\(\)/, 'navigation expansion must be interruption safe');
assert.match(floatingNavigationMotion, /return \(\) => animation\.stop\(\)/, 'navigation expansion must clean up pending work');

assert.match(feedback, /Achievement unlocked/, 'earned recognition must begin with a ceremonial cue');
assert.match(feedback, /trophyOpacity/, 'recognition must transition from trophy to evidence');
assert.match(feedback, /recognitionVisibleDuration/, 'recognition dwell remains tied to the established lifecycle');
assert.match(completion, /SessionStreakBadge/, 'completion recap must preserve the streak diamond');
assert.match(completion, /animateEntry \|\| reduceMotion/, 'completion recap must bypass ceremony under Reduced Motion');
assert.match(readiness, /heldScale\.stopAnimation\(\)/, 'readiness direct manipulation must be interruptible');
assert.match(readiness, /crossedReadinessBoundary/, 'readiness haptics must remain boundary based');

console.log('[motion-system] hierarchy, interruption safety, earned recognition, and Reduced Motion checks passed');
