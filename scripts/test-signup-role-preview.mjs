import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => fs.readFileSync(path, 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
function load(source, modules) {
  const context = { exports: {}, require: name => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, console, __DEV__: false };
  vm.runInNewContext(compile(source), context);
  return context.exports;
}
const paths = load(read('lib/signup-paths.ts'), {});
function runtime() {
  const states = [], effects = [], back = new Map();
  let cursor = 0, effectCursor = 0, dismissed = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment', useRef: initial => ({ current: initial }),
    useEffect: (callback, dependencies) => {
      const index = effectCursor++, key = JSON.stringify(dependencies);
      if (effects[index]?.key === key) return;
      effects[index]?.cleanup?.();
      effects[index] = { key, cleanup: callback() };
    },
    useState: initial => {
      const index = cursor++;
      if (index >= states.length) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
  };
  const Image = Object.assign(function Image() {}, { resolveAssetSource: () => ({ width: 1206, height: 2622 }) });
  const theme = { SLColors: new Proxy({}, { get: () => '#A78BFA' }), SLFontFamilies: {}, SLRadius: {},
    SLTypography: new Proxy({}, { get: () => ({ fontSize: 14, lineHeight: 20 }) }) };
  const modules = {
    react: React,
    'react-native': { View: 'View', Pressable: 'Pressable', Image, Platform: { OS: 'android' },
      StyleSheet: { create: x => x, absoluteFill: {}, hairlineWidth: 0.5 }, Linking: {},
      Keyboard: { dismiss: () => dismissed++ }, useWindowDimensions: () => ({ width: 375, height: 667, fontScale: 2 }),
      BackHandler: { addEventListener: (event, fn) => { back.set(event, fn); return { remove: () => back.delete(event) }; } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/constants/theme': theme,
    '@/components/ui/sl-text': { Text: 'Text', TextInput: 'Input' },
    '@/components/keyboard/KeyboardSurface': { KeyboardAvoidingView: 'KeyboardViewport', KeyboardScrollView: 'Scroll' },
    '@/components/onboarding/SignupWelcome': { SignupWelcome: 'SignupWelcome' },
    '@/components/onboarding/OnboardingProgress': { OnboardingProgress: 'Progress' },
    '@/components/onboarding/OnboardingSupport': { OnboardingSupport: 'Support' },
    '@/lib/mobile-education-images': { educationImage: name => ({ uri: `example:${name}`, width: 1206, height: 2622 }) },
    '@/lib/signup-paths': paths, '@/lib/onboarding-message': { onboardingMessage: x => x },
    '@/components/ui': { SLButton: 'Button' },
    '../assets/images/16:9.png': {}, '../../assets/images/16:9.png': {},
    '@/components/AuthSsoButtons': { default: 'SsoButtons' },
  };
  return { modules, back, states, render: (component, props) => { cursor = 0; effectCursor = 0; return component(props); }, dismissed: () => dismissed };
}
const flatten = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(flatten) : typeof tree === 'object'
  ? [tree, ...flatten(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree?.props?.children) : String(tree ?? '');
const find = (tree, predicate) => { const node = flatten(tree).find(predicate); assert.ok(node, 'Expected rendered control'); return node; };
const press = (tree, name) => find(tree, node => ['Pressable', 'Button'].includes(node.type)
  && (node.props.accessibilityLabel === name || node.props.label === name || text(node) === name));

// Execute the real LoginScreen callbacks, not a duplicate of its transitions.
async function exerciseLogin(source = read('app/login.tsx')) {
  for (const role of ['athlete', 'coach', 'self_coach']) {
    const r = runtime(), requests = [], routes = [], logins = [];
    r.modules['expo-router'] = { useRouter: () => ({ replace: value => routes.push(value) }) };
    r.modules['@/context/AuthContext'] = { useAuth: () => ({ login: (...args) => logins.push(args) }) };
    r.modules['@/lib/api'] = { registerMobileRequest: async payload => { requests.push(payload); return { ok: false, error: 'Example server rejection' }; } };
    const component = load(source, r.modules).default;
    const render = () => r.render(component);
    let tree = render();
    assert.equal(tree.type, 'SignupWelcome', 'Signup must begin with the role experience, including the signed-out entry');
    tree.props.onSignIn(); tree = render();
    assert.equal(flatten(tree).filter(node => node.type === 'Input').length, 2, 'Existing email sign-in stays available');
    press(tree, 'Sign up').props.onPress(); tree = render();
    assert.equal(tree.type, 'SignupWelcome', 'Signup must begin with the role experience');
    assert.equal(flatten(tree).some(node => node.type === 'Input'), false, 'Role preview never mounts account inputs');
    tree.props.onSelectRole(role); tree = render(); assert.equal(tree.props.role, role);
    tree.props.onContinue(); tree = render();
    assert.ok(text(tree).includes(paths.SIGNUP_PATHS[role].requirement));
    assert.equal(flatten(tree).filter(node => node.type === 'Progress').length, role === 'athlete' ? 0 : 1, 'Athletes do not enter trial steps');
    const submit = () => press(render(), 'Create account and continue');
    assert.equal(submit().props.disabled, true);
    await submit().props.onPress(); assert.equal(requests.length, 0);
    const set = (placeholder, value) => { find(render(), node => node.type === 'Input' && node.props.placeholder === placeholder).props.onChangeText(value); };
    set('Alex', 'Example'); set('Carter', 'Person'); set('you@example.com', 'example@onboarding.test');
    set('Password', 'fictional-password'); set('Confirm password', 'different-password');
    await submit().props.onPress(); assert.equal(requests.length, 0, 'Mismatched password cannot register');
    set('Confirm password', 'fictional-password');
    if (role === 'coach') {
      assert.equal(submit().props.disabled, true);
      await submit().props.onPress(); assert.equal(requests.length, 0, 'Coach beta code remains mandatory');
      set('Access code', 'FICTIONAL-CODE');
    }
    press(render(), 'Change account type').props.onPress(); tree = render();
    assert.equal(tree.type, 'SignupWelcome'); assert.equal(tree.props.role, role);
    tree.props.onContinue(); tree = render();
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'Alex').props.value, 'Example');
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'you@example.com').props.value, 'example@onboarding.test');
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'Password').props.value, 'fictional-password');
    assert.equal(submit().props.disabled, false);
    await submit().props.onPress(); assert.equal(requests.length, 1);
    assert.equal(requests[0].role, role); assert.equal(requests[0].email, 'example@onboarding.test');
    assert.equal(requests[0].access_code, role === 'coach' ? 'FICTIONAL-CODE' : undefined);
    assert.equal(routes.length, 0); assert.equal(logins.length, 0, 'Presentation must not grant access after server rejection');
    assert.equal(find(render(), node => node.type === 'Input' && node.props.placeholder === 'you@example.com').props.value, 'example@onboarding.test', 'Retry preserves draft');
    assert.equal(r.back.get('hardwareBackPress')(), true); tree = render();
    assert.equal(tree.type, 'SignupWelcome'); assert.ok(r.dismissed() > 0);
    assert.equal(r.back.get('hardwareBackPress')(), true); tree = render();
    assert.notEqual(tree.type, 'SignupWelcome', 'Android back returns to sign-in');
  }
}
await exerciseLogin();

// Exercise the actual role controls, screenshots and image-error handler.
for (const role of ['athlete', 'coach', 'self_coach']) {
  const r = runtime(), selected = [], continued = [], signedIn = [];
  const component = load(read('components/onboarding/SignupWelcome.tsx'), r.modules).SignupWelcome;
  const props = { role, onSelectRole: value => selected.push(value), onContinue: () => continued.push(role), onSignIn: () => signedIn.push(true) };
  const tree = r.render(component, props);
  const tabs = flatten(tree).filter(node => node.props?.accessibilityRole === 'tab');
  assert.equal(tabs.length, 3); assert.equal(tabs.filter(node => node.props.accessibilityState.selected).length, 1);
  for (const tab of tabs) {
    const style = Object.assign({}, ...tab.props.style({ pressed: false }).filter(Boolean));
    assert.equal(style.flex, 0, 'At large text sizes, roles must use full rows rather than compress their labels');
    assert.equal(style.flexDirection, 'row');
    assert.ok(style.minHeight >= 44);
  }
  tabs.forEach(node => node.props.onPress()); assert.deepEqual(selected, ['athlete', 'coach', 'self_coach']);
  press(tree, `Continue as ${paths.SIGNUP_PATHS[role].label}`).props.onPress(); assert.equal(continued.length, 1);
  find(tree, node => node.type === 'Pressable' && text(node).startsWith('Sign in')).props.onPress(); assert.equal(signedIn.length, 1);
  const preview = find(tree, node => typeof node.type === 'function' && node.type.name === 'ScreenshotPreview');
  const screen = () => r.render(preview.type, preview.props);
  let gallery = screen();
  assert.ok(text(gallery).includes(paths.SIGNUP_PATHS[role].captures[0].label));
  press(gallery, 'Next app preview').props.onPress(); gallery = screen();
  assert.ok(text(gallery).includes(paths.SIGNUP_PATHS[role].captures[1].label));
  const image = find(gallery, node => typeof node.props?.onError === 'function');
  image.props.onError(); gallery = screen();
  assert.ok(text(gallery).includes('You can still continue with setup'), 'Failed preview must not block registration');
}

const broken = read('app/login.tsx').replace("authMode === 'signup' && signupStep === 'preview'", "false /* reproduce form-first signup */");
assert.notEqual(broken, read('app/login.tsx'));
await assert.rejects(exerciseLogin(broken), /Signup must begin with the role experience/);
console.log('PASS: all three real role-to-form handlers, preserved drafts, registration payloads, admission validation, server rejection, Android back, preview controls and image failure. Deliberate form-first regression rejected.');
