import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../components/home/TodayHomeExperience.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /<View pointerEvents="none" style=\{\[styles\.heroMedia, compact && styles\.heroMediaCompact\]\}>[\s\S]*<ImageBackground[\s\S]*resizeMode="cover"[\s\S]*style=\{StyleSheet\.absoluteFillObject\}/,
  'The training photo must be a non-interactive absolute background using cover.',
);
assert.match(
  source,
  /heroMedia: \{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '54%'/,
  'The default hero image must fill the right half of the atmosphere.',
);
assert.match(
  source,
  /heroMediaCompact: \{ width: '50%' \}/,
  'Narrow screens must retain a stable right-half crop.',
);
assert.doesNotMatch(
  source,
  /heroImage:|imageStyle=\{styles\.heroImage\}/,
  'The image must not retain a separately rounded image-panel treatment.',
);
assert.match(
  source,
  /colors=\{\[[\s\S]*rgba\(5, 5, 10, 1\)[\s\S]*rgba\(3, 3, 8, 0\.10\)[\s\S]*end=\{\{ x: 1, y: 0\.5 \}\}[\s\S]*start=\{\{ x: 0, y: 0\.5 \}\}/,
  'The card material must fade horizontally into the photo.',
);
assert.match(
  source,
  /trainingHero: \{[\s\S]*minHeight: 282,[\s\S]*overflow: 'hidden',[\s\S]*backgroundColor: SLColors\.canvasRaised,[\s\S]*borderColor: SLColors\.borderFocus/,
  'The card must own clipping and use the current OLED-violet surface treatment.',
);
assert.match(
  source,
  /sectionEyebrow: \{ color: SLColors\.accentViolet,/,
  'Home section labels must use the current violet identity color.',
);
assert.doesNotMatch(
  source,
  /goldEyebrow|color: SLColors\.warning/,
  'The retired warm-gold Home label treatment must not return.',
);
assert.match(
  source,
  /heroCopy: \{ zIndex: 2,[\s\S]*heroCopyCompact: \{ width: '74%' \}/,
  'Foreground copy must remain above the image and retain readable narrow-width space.',
);
assert.match(
  source,
  /<View style=\{styles\.heroCta\}>[\s\S]*<SLButton[\s\S]*label=\{actionLabel\}[\s\S]*onPress=\{\(\) => onAction\(today\.primary_action \?\? \{ route: 'workout', workout_id: session\?\.id \}\)\}/,
  'The unchanged primary action must remain in a foreground CTA layer.',
);

console.log('Home training hero layering contract passed.');
