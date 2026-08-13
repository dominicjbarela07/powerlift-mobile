import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_DEV_RETURN_CONTROL_PREFERENCES,
  nearestReturnControlEdge,
  parseDevReturnControlPreferences,
  returnControlXForEdge,
  returnControlYFromRatio,
  returnControlYRatio,
} from '../dev-mocks/live-screen-return-control-core.ts';

const source = readFileSync(new URL('../dev-mocks/DevLiveScreenReturnControl.tsx', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../dev-mocks/live-screen-return-control-state.ts', import.meta.url), 'utf8');

assert.equal(nearestReturnControlEdge(12, 390, 190), 'left');
assert.equal(nearestReturnControlEdge(210, 390, 48), 'right');
assert.equal(returnControlXForEdge('left', 390, 190, 12), 12);
assert.equal(returnControlXForEdge('right', 390, 190, 12), 188);
assert.equal(returnControlXForEdge('right', 320, 48, 12), 260);

assert.equal(returnControlYFromRatio(0, 57, 780), 57);
assert.equal(returnControlYFromRatio(1, 57, 780), 780);
assert.equal(returnControlYFromRatio(2, 57, 780), 780);
assert.equal(returnControlYRatio(418.5, 57, 780), 0.5);
assert.equal(returnControlYRatio(100, 100, 100), 0);

assert.deepEqual(parseDevReturnControlPreferences(null), DEFAULT_DEV_RETURN_CONTROL_PREFERENCES);
assert.deepEqual(parseDevReturnControlPreferences('{"edge":"right","yRatio":0.25,"minimized":true}'), {
  edge: 'right',
  yRatio: 0.25,
  minimized: true,
});
assert.deepEqual(parseDevReturnControlPreferences('{"edge":"invalid","yRatio":4,"minimized":"yes"}'), {
  edge: 'left',
  yRatio: 1,
  minimized: false,
});

assert.match(source, /PanResponder\.create/, 'control must support drag gestures');
assert.match(source, /nearestReturnControlEdge/, 'control must snap to the nearest edge');
assert.match(source, /useSafeAreaInsets/, 'control must respect system safe areas');
assert.match(source, /onLongPress=\{openContextMenu\}/, 'control must expose its context menu by long press');
assert.match(source, /Hide Until Relaunch/, 'context menu must expose session-only hiding');
assert.match(source, /IDLE_OPACITY/, 'control must reduce its idle visual prominence');
assert.match(source, /session\.mode === 'ideal'/, 'Ideal State must use the minimal mock header instead of the floating developer control');
assert.match(stateSource, /AsyncStorage\.setItem/, 'position and minimized preference must persist');
assert.match(stateSource, /DevSettings\.addMenuItem\('Restore UI Mock Library control'/, 'the DEV menu must restore a hidden control');
assert.doesNotMatch(stateSource, /AsyncStorage\.setItem\([^\n]*hidden/, 'session-only hidden state must not persist');

console.log('DEV live-screen return control tests passed.');
