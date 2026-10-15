import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const state = [];
let cursor = 0;
const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  Fragment: 'Fragment',
  useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  },
};
const imports = {
  react: { ...react, default: react },
  'react-native': { ActivityIndicator: 'Spinner', Alert: { alert() {} }, Image: 'Image', Pressable: 'Button', View: 'View', StyleSheet: { create: s => s, hairlineWidth: 1, absoluteFillObject: {} } },
  '@/components/keyboard/KeyboardSurface': { KeyboardModal: 'Modal' },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '@/components/ui/sl-text': { Text: 'Text' },
  '@/constants/theme': { SLColors: new Proxy({}, { get: () => 'color' }), SLFontFamilies: {}, SLRadius: {} },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 62, bottom: 34 }) },
};
function load(file, extra = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const allowed = { ...imports, ...extra };
  vm.runInNewContext(js, { exports, require: name => {
    assert.ok(name in allowed, `Unexpected dependency/network entrypoint ${name}`);
    return allowed[name];
  } }, { filename: file });
  return exports;
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.children || []).flat(Infinity).flatMap(nodes)];
const text = tree => !tree || typeof tree !== 'object' ? String(tree ?? '') : (tree.children || []).flat(Infinity).map(text).join(' ');
let playerUri, plays = 0, pauses = 0, playerStatus = 'readyToPlay';
const player = { status: 'readyToPlay', play: () => plays++, pause: () => pauses++ };
const preview = load('components/workout-logger/selected-set-video-preview.tsx', {
  expo: { useEvent: () => ({ status: playerStatus }) },
  'expo-video': { VideoView: 'VideoView', useVideoPlayer: (uri, setup) => { playerUri = uri; setup(player); return player; } },
});
const status = load('lib/set-video-upload-status.ts');
const entry = load('components/workout-logger/set-entry-video.tsx', {
  '@/lib/set-video-upload-status': status,
  './selected-set-video-preview': preview,
});
const video = { uri: 'file:///selected.mp4', name: 'selected.mp4', mimeType: 'video/mp4', submitForReview: false };
let picks = 0, removes = 0;
const props = { video, onPick: async () => picks++, onChange: () => assert.fail('Preview must not change review intent'), onRemove: () => removes++, allowCoachReview: true };
const render = p => { cursor = 0; return entry.SetEntryVideo(p); };
let tree = render({ ...props, video: null });
assert.equal(nodes(tree).some(n => n.props.accessibilityLabel === 'Preview selected set video'), false);

for (const label of ['Preview selected set video', 'Play selected video preview']) {
  tree = render(props);
  nodes(tree).find(n => n.props.accessibilityLabel === label).props.onPress();
  tree = render(props);
  const mounted = nodes(tree).find(n => n.type === preview.SelectedSetVideoPreview);
  assert.ok(mounted, 'Selected local preview must mount');
  assert.equal(mounted.props.video, video, 'Preview preserves the exact clip and review intent');
  assert.equal(picks, 0, 'Preview must not reopen the picker');
  assert.equal(removes, 0);
  const playback = preview.SelectedSetVideoPreview(mounted.props);
  assert.equal(playerUri, video.uri, 'Player receives the local file, not a server URL');
  assert.equal(player.loop, false);
  assert.equal(player.staysActiveInBackground, false);
  const nativeVideo = nodes(playback).find(n => n.type === 'VideoView');
  assert.equal(nativeVideo.props.nativeControls, true);
  assert.equal(nativeVideo.props.contentFit, 'contain');
  assert.match(text(playback), /Not uploaded yet/);
  const beforePause = pauses;
  nodes(playback).find(n => n.props.accessibilityLabel === 'Back to set').props.onPress();
  assert.equal(pauses, beforePause + 1, 'Closing stops playback');
  tree = render(props);
  assert.equal(nodes(tree).some(n => n.type === preview.SelectedSetVideoPreview), false);
  assert.ok(nodes(tree).some(n => n.props.accessibilityLabel === 'Preview selected set video'), 'Clip remains selected');
}
assert.equal(plays, 2);

tree = render(props);
nodes(tree).find(n => n.props.accessibilityLabel === 'Preview selected set video').props.onPress();
tree = render({ ...props, video: { ...video, uri: 'file:///replacement.mp4' } });
assert.equal(nodes(tree).some(n => n.type === preview.SelectedSetVideoPreview), false, 'Changed clip cannot keep the previous preview mounted');
tree = render({ ...props, video: null });
assert.equal(nodes(tree).some(n => n.type === preview.SelectedSetVideoPreview), false, 'Removed clip cannot keep playing');
tree = render(props);
nodes(tree).find(n => n.type === preview.SelectedSetVideoPreview).props.onClose();
tree = render(props);
await nodes(tree).find(n => n.props.accessibilityLabel === 'Choose a different set video').props.onPress();
assert.equal(picks, 1);
nodes(render(props)).find(n => n.props.accessibilityLabel === 'Remove selected video').props.onPress();
assert.equal(removes, 1);
assert.ok(nodes(render({ ...props, disabled: true })).filter(n => /Preview selected|Play selected/.test(n.props.accessibilityLabel || '')).every(n => n.props.disabled));

for (const statusValue of ['loading', 'error']) {
  playerStatus = statusValue;
  let closed = 0;
  const playback = preview.SelectedSetVideoPreview({ video, onClose: () => closed++ });
  if (statusValue === 'loading') assert.ok(nodes(playback).some(n => n.type === 'Spinner'));
  else assert.match(text(playback), /Could not preview this video/);
  nodes(playback).find(n => n.type === 'Modal').props.onRequestClose();
  assert.equal(closed, 1, 'System back remains available during loading/error');
}
console.log('PASS: actual selected-clip controls open local playback before submission, preserve clip/review intent, retain change/remove, stop on close, and expose loading/error recovery without upload dependencies.');
