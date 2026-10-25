import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../components/AuthSsoButtons.tsx', import.meta.url), 'utf8');
async function verify(candidate) {
  for (const platform of ['ios', 'android', 'web']) for (const configured of [false, true]) {
    const calls = [], effects = [];
    const createElement = (type, props, ...children) => typeof type === 'function'
      ? type({...props, children}) : {type, props, children};
    const React = {createElement, useMemo: fn => fn(), useState: initial => [initial, () => {}], useEffect: fn => effects.push(fn)};
    const sandbox = {exports: {}, process: {env: configured ? {
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios', EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: 'android', EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web',
    } : {}}, console, require: name => {
      if (name === 'react') return React;
      if (name === 'react-native') return {Platform: {OS: platform}, StyleSheet: {create: value => value}, View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator'};
      if (name === '@/components/ui/sl-text') return {Text: 'Text'};
      if (name === '@expo/vector-icons') return {FontAwesome: 'Icon'};
      if (name === 'expo-auth-session') return {ResponseType: {IdToken: 'id_token'}};
      if (name === 'expo-auth-session/providers/google') return {useAuthRequest: () => [{}, null, async () => ({type: 'success', params: {id_token: 'fixture'}})]};
      if (name === 'expo-web-browser') return {maybeCompleteAuthSession() {}};
      if (name === '@/constants/theme') return {SLColors: {}, SLFontFamilies: {}, SLRadius: {}, SLTypography: {rowTitle: {}, micro: {}}};
      if (name === '@/lib/api') return {mobileOAuthRequest: async provider => {calls.push(provider); return {ok: true};}};
      throw Error(`Unexpected native/provider dependency: ${name}`);
    }};
    vm.runInNewContext(ts.transpileModule(candidate, {compilerOptions: {jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText, sandbox);
    const tree = sandbox.exports.default({oauthLoading: null, setOauthLoading() {}, onOAuthResult: async () => {}, onError() {}});
    for (const effect of effects) await effect();
    await Promise.resolve();
    const nodes = [];
    function walk(node) { if (!node) return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); if (typeof node === 'object') walk(node.children); }
    walk(tree);
    assert(!JSON.stringify(tree).includes('Apple'), `${platform}: Apple must never render`);
    const buttons = nodes.filter(node => node.type === 'Pressable');
    if (!configured) {
      assert.equal(tree, null, 'Email-only builds must not show an empty SSO stack/divider');
    } else {
      assert.equal(buttons.length, 1);
      assert(nodes.includes('Continue with Google'), 'Unrelated Google behavior must remain');
      assert(nodes.includes('or continue with email'));
      await buttons[0].props.onPress();
      assert.deepEqual(calls, ['google']);
    }
  }
}
await verify(source);
const regression = source.replace('  if (!googleConfigured) {', "  if (!googleConfigured) { return React.createElement('Text', null, 'Continue with Apple');");
assert.notEqual(regression, source);
await assert.rejects(() => verify(regression), /Apple must never render/);
const login = fs.readFileSync(new URL('../app/login.tsx', import.meta.url), 'utf8');
assert(!login.includes('or continue with email'), 'Divider visibility must belong to the component that knows whether any provider is visible');
assert(!/expo-apple-authentication|handleAppleSignIn|isAvailableAsync/.test(source), 'OS support must not reactivate retired sign-in');
console.log('PASS: actual SSO renderer across iOS/Android/web, with/without Google; Google action retained, no orphan divider/native Apple probe. Deliberate Apple restoration rejected.');
