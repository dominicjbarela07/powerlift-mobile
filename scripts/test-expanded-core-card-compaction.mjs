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

const v3 = fs.readFileSync(path.join(root, 'components/workout-logger/session-v3-movement.tsx'), 'utf8');
assert.match(source, /<SessionV3Movement/);
assert.match(v3, /stacks.map/ , 'every range endpoint keeps its independent physical render');
assert.match(v3, /stacks.length > 1/);
assert.match(v3, /instrument: \{ minHeight: 145/);
assert.match(v3, /rangeStack: \{ height: 122/);
assert.match(v3, /history \|\|/ , 'only one evidence presentation occupies the history zone');
assert.match(source, /visibleDetailRows.map/);
assert.match(source, /minHeight: 42/ , 'set rows retain phone-height density');
assert.match(source, /CompletedSetSwipeRow[\s\S]*onEdit=\{row.onEdit\}[\s\S]*onDelete=\{row.onDelete\}/);
assert.match(source, /warmup=\{warmupAction\}/);
assert.match(loggerScreenSource, /<SessionV3Footer/);
console.log('Logger V3 compact instrument, physical ranges, one history zone, dense editable sets and fixed action passed.');
