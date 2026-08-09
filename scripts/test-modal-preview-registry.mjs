import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ABSENT_TRANSIENT_SURFACES,
  MODAL_PREVIEW_CATEGORIES,
  MODAL_PREVIEW_REGISTRY,
  modalPreviewRoute,
  modalPreviewSearchable,
} from '../dev-mocks/modal-preview-registry.ts';

const root = process.cwd();
const runtimeRoots = ['app', 'components', 'dev-mocks'];
const modalCounts = new Map();
const nativeCounts = new Map();

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolute);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry.name) || entry.name.includes('.test.')) continue;
    const relative = path.relative(root, absolute);
    if (relative === 'app/(tabs)/dev-mocks/live-state/[stateId].tsx') continue;
    const source = fs.readFileSync(absolute, 'utf8');
    const count = (source.match(/<Modal\b/g) || []).length;
    if (count) modalCounts.set(relative, count);
    const nativeCount = (source.match(/Alert\.alert\s*\(/g) || []).length
      + (source.match(/ActionSheetIOS\.showActionSheetWithOptions\s*\(/g) || []).length;
    if (nativeCount) nativeCounts.set(relative, nativeCount);
  }
}

runtimeRoots.forEach((directory) => visit(path.join(root, directory)));

assert.ok(MODAL_PREVIEW_REGISTRY.length >= 50, 'The modal inventory unexpectedly lost broad platform coverage.');
assert.equal(new Set(MODAL_PREVIEW_REGISTRY.map((entry) => entry.id)).size, MODAL_PREVIEW_REGISTRY.length, 'Modal preview IDs must be unique.');
assert.deepEqual(
  [...new Set(MODAL_PREVIEW_REGISTRY.map((entry) => entry.category))].filter((category) => !MODAL_PREVIEW_CATEGORIES.includes(category)),
  [],
  'Every modal entry must use an approved library category.',
);

for (const [sourceFile, count] of modalCounts) {
  const registered = MODAL_PREVIEW_REGISTRY.filter((entry) => entry.sourceFile === sourceFile).length;
  assert.ok(registered >= count, `${sourceFile} contains ${count} app-owned <Modal> surface(s), but only ${registered} preview entry/entries are registered.`);
}

for (const [sourceFile, count] of nativeCounts) {
  const registeredStates = MODAL_PREVIEW_REGISTRY
    .filter((entry) => entry.sourceFile === sourceFile && entry.implementation === 'native-alert')
    .reduce((total, entry) => total + entry.variants.length, 0);
  assert.ok(registeredStates >= count, `${sourceFile} contains ${count} native Alert/ActionSheet invocation(s), but only ${registeredStates} directly previewable state(s) are registered.`);
}

for (const entry of MODAL_PREVIEW_REGISTRY) {
  assert.ok(fs.existsSync(path.join(root, entry.sourceFile)), `Missing source file for ${entry.id}: ${entry.sourceFile}`);
  assert.match(modalPreviewRoute(entry), new RegExp(`${entry.id}$`));
  assert.equal(modalPreviewSearchable(entry, entry.componentName), true, `${entry.id} is not searchable by component name.`);
  assert.equal(modalPreviewSearchable(entry, entry.kind), true, `${entry.id} is not searchable by type.`);
  assert.equal(modalPreviewSearchable(entry, entry.workflow), true, `${entry.id} is not searchable by workflow.`);
  assert.ok(entry.userModes.length, `${entry.id} must participate in role filtering.`);
  assert.ok(entry.variants.length, `${entry.id} must expose at least one state.`);
  assert.deepEqual(entry.previewModes, ['live', 'ideal'], `${entry.id} must expose Live and Ideal State.`);
  assert.ok(
    ['production-component-adapter', 'representative-no-production-ui'].includes(entry.idealStateStrategy),
    `${entry.id} has an invalid transient Ideal State strategy.`,
  );
  assert.notEqual(
    entry.idealStateStrategy,
    'canonical-design-sandbox',
    `${entry.id} cannot claim one of the three protected canonical logger sandboxes.`,
  );
  if (
    !entry.sourceFile.startsWith('app/(tabs)/dev-mocks/')
    && !entry.sourceFile.startsWith('dev-mocks/')
  ) {
    assert.equal(
      entry.idealStateStrategy,
      'production-component-adapter',
      `${entry.id} has production UI and cannot use a representative transient.`,
    );
  }
}

assert.ok(ABSENT_TRANSIENT_SURFACES.length, 'Known absent product surfaces must be reported rather than fabricated.');

const returnControl = fs.readFileSync(path.join(root, 'dev-mocks/DevLiveScreenReturnControl.tsx'), 'utf8');
assert.ok(returnControl.includes('styles.opacityLayer'), 'Return-control native opacity must be isolated from JS-driven width/layout animation.');
assert.doesNotMatch(returnControl, /opacity:\s*activeOpacity,\s*\n\s*width:/, 'Native opacity and unsupported width animation cannot share one Animated.View.');

console.log(`Modal preview registry OK: ${MODAL_PREVIEW_REGISTRY.length} entries; ${modalCounts.size} source files with app-owned <Modal> elements; ${nativeCounts.size} source files with native Alert/ActionSheet surfaces.`);
