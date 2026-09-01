import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'components/workout-logger/core-loggers.tsx'),
  'utf8',
);
const compactTimelineSource = fs.readFileSync(
  path.join(root, 'components/workout-logger/compact-set-timeline.tsx'),
  'utf8',
);
const loggerScreenSource = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

function styleNumber(styleName, propertyName) {
  const styleMatch = source.match(new RegExp(`${styleName}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`));
  assert.ok(styleMatch, `${styleName} must remain in the canonical Logger stylesheet.`);
  const valueMatch = styleMatch[1].match(new RegExp(`${propertyName}:\\s*(-?\\d+)`));
  assert.ok(valueMatch, `${styleName}.${propertyName} must remain an explicit density contract.`);
  return Number(valueMatch[1]);
}

function styleBody(styleName) {
  const styleMatch = source.match(new RegExp(`${styleName}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`));
  assert.ok(styleMatch, `${styleName} must remain in the canonical Logger stylesheet.`);
  return styleMatch[1];
}

const rangeWorkspaceHeight = styleNumber('activeNextSetRowExpanded', 'minHeight');
const rangeHeroHeight = styleNumber('activeNextSetHeroExpanded', 'minHeight');
const rangeStackHeight = styleNumber('activeNextSetPlateRangeExpanded', 'height');
const metricStripHeight = styleNumber('activeNextSetMetricRowExpanded', 'minHeight');
const workspaceGap = styleNumber('activeMovementWorkspaceExpanded', 'gap');

assert.ok(rangeWorkspaceHeight <= 214, 'The compact range workspace may not return to its former 376px hero.');
assert.ok(rangeHeroHeight <= 154, 'The dual-stack hero must stay compact enough for the timeline and actions.');
assert.ok(rangeStackHeight >= 120, 'Both canonical plate stacks must remain legible and visually prominent.');
assert.ok(metricStripHeight >= 52 && metricStripHeight <= 62, 'The reps/RPE strip must remain compact and readable.');
assert.ok(workspaceGap <= 8, 'Expanded Core sections must not reintroduce stacked 12px dead zones.');
assert.doesNotMatch(
  source,
  />\s*Movement \{sessionIndex\}\s*</,
  'Canonical Training Session cards must not render movement index labels.',
);
assert.doesNotMatch(
  loggerScreenSource,
  />\s*MOVEMENT \{supersetRoundLogger\.activeIndex \+ 1\} OF \{supersetRoundLogger\.entries\.length\}\s*</,
  'Superset logging must not reintroduce a visible movement ordinal label.',
);
assert.doesNotMatch(
  styleBody('activeNextSetMetricRow'),
  /borderTop(?:Width|Color)/,
  'The reps/RPE strip must not render a horizontal divider above its metrics.',
);
assert.match(
  source,
  /<View style=\{styles\.activeNextSetMetricCenterDivider\} \/>/,
  'The useful vertical divider between reps and effort must remain.',
);

assert.match(
  source,
  /visualContext\.plateStack\.mode === 'range'[\s\S]*?visualContext\.plateStack\.endpoints\.map/,
  'Ranged Core prescriptions must keep both canonical endpoint stacks.',
);
assert.match(
  source,
  /if \(compact && target\) return target;/,
  'The condensed timeline must show the per-set target without repeating the card-level prescription.',
);
assert.match(compactTimelineSource, /horizontal/);
assert.match(compactTimelineSource, /height: 44,[\s\S]*?width: 44/);
assert.match(compactTimelineSource, /ready to log/);
assert.match(
  source,
  /<SetTimeline[\s\S]*?<LogSetAction[\s\S]*?>History</,
  'Timeline, Log Set, and History must remain in the canonical expanded-card workflow.',
);
assert.match(
  source,
  /styles\.activeNextSetPlateRangeExpanded/,
  'The compaction must apply only through the canonical expanded-workspace branch.',
);

// This is a stable density estimate for the workspace below the movement header.
// It deliberately includes a warmup row, timeline heading, both actions, and
// inter-section gaps so 3/4/5-set regressions fail before reaching a device.
const compactTimelineHeight = 20 + 60 + 38;
const fixedCompactHeight = 50 + rangeWorkspaceHeight + 28 + 58 + 10 + 44 + compactTimelineHeight + (workspaceGap * 3);
const fixedPreviousHeight = 60 + 376 + 32 + 58 + 10 + 44 + (12 * 3) + 12;
for (const setCount of [3, 4, 5]) {
  const compactHeight = fixedCompactHeight;
  const previousHeight = fixedPreviousHeight + (64 * setCount);
  assert.ok(compactHeight <= 690, `${setCount}-set expanded workspace must remain phone-height bounded.`);
  assert.ok(previousHeight - compactHeight >= 195, `${setCount}-set compaction must recover meaningful vertical space.`);
}

console.log('Expanded canonical Core card 3/4/5-set compaction guards passed.');
