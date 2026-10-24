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
function runtime(os = 'android') {
  let states = [];
  const componentStates = new Map(), effects = [], back = new Map();
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
    'react-native': { View: 'View', Pressable: 'Pressable', Image, Platform: { OS: os },
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
    '@/lib/signup-paths': paths, '@/lib/onboarding-message': { onboardingMessage: x => x },
    '@/components/ui': { SLButton: 'Button' },
    '../assets/images/16:9.png': {}, '../../assets/images/16:9.png': {},
    '../../assets/images/onboarding/loaded-iron-welcome-v1.png': 'gym-photo',
    '@/components/AuthSsoButtons': { default: 'SsoButtons' },
  };
  return { modules, back, render: (component, props) => { states = componentStates.get(component) ?? []; componentStates.set(component, states); cursor = 0; effectCursor = 0; return component(props); }, dismissed: () => dismissed };
}
const flatten = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(flatten) : typeof tree === 'object'
  ? [tree, ...flatten(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree?.props?.children) : String(tree ?? '');
const find = (tree, predicate) => { const node = flatten(tree).find(predicate); assert.ok(node, 'Expected rendered control'); return node; };
const press = (tree, name) => find(tree, node => ['Pressable', 'Button'].includes(node.type)
  && (node.props.accessibilityLabel === name || node.props.label === name || text(node) === name));

// Execute the real LoginScreen callbacks, not a duplicate of its transitions.
async function exerciseLogin(source = read('app/login.tsx')) {
  for (const os of ['ios', 'android']) for (const role of ['athlete', 'coach', 'self_coach']) {
    const r = runtime(os), requests = [], routes = [], logins = [];
    let response = { ok: false, error: 'Example server rejection' };
    r.modules['expo-router'] = { useRouter: () => ({ replace: value => routes.push(value) }) };
    r.modules['@/context/AuthContext'] = { useAuth: () => ({ login: (...args) => logins.push(args) }) };
    r.modules['@/lib/api'] = { registerMobileRequest: async payload => { requests.push(payload); return response; } };
    const component = load(source, r.modules).default;
    const render = () => r.render(component);
    let tree = render();
    assert.equal(tree.type, 'SignupWelcome', 'Signup must begin with the role experience, including the signed-out entry');
    tree.props.onSignIn(); tree = render();
    assert.equal(flatten(tree).filter(node => node.type === 'Input').length, 2, 'Existing email sign-in stays available');
    const signInPassword = find(tree, node => node.type === 'Input' && node.props.placeholder === 'Password');
    assert.equal(os === 'ios' ? signInPassword.props.textContentType : signInPassword.props.autoComplete, os === 'ios' ? 'password' : 'current-password');
    press(tree, 'Sign up').props.onPress(); tree = render();
    assert.equal(tree.type, 'SignupWelcome', 'Signup must begin with the role experience');
    assert.equal(flatten(tree).some(node => node.type === 'Input'), false, 'Role preview never mounts account inputs');
    tree.props.onSelectRole(role); tree = render();
    assert.notEqual(tree.type, 'SignupWelcome', 'Role selection must open account creation directly');
    assert.ok(flatten(tree).some(node => node.type === 'Input'), 'Role selection must open account creation directly');
    assert.ok(text(tree).includes(paths.SIGNUP_PATHS[role].requirement));
    assert.ok(text(tree).includes(paths.SIGNUP_PATHS[role].description));
    assert.ok(text(tree).includes('At least 8 characters.'));
    assert.ok(flatten(tree).some(node => node.type === 'Support'), 'Setup support stays reachable');
    for (const label of ['First name', 'Last name', 'Email', 'Password', 'Confirm password']) {
      const field = find(tree, node => node.type === 'Input' && node.props.accessibilityLabel === label);
      assert.ok(os === 'ios' ? field.props.textContentType && !field.props.autoComplete : field.props.autoComplete && !field.props.textContentType);
    }
    for (const label of ['Password', 'Confirm password']) {
      const field = find(tree, node => node.type === 'Input' && node.props.accessibilityLabel === label);
      assert.equal(os === 'ios' ? field.props.textContentType : field.props.autoComplete, os === 'ios' ? 'newPassword' : 'new-password');
      assert.equal(field.props.secureTextEntry, true);
      assert.equal(field.props.autoCorrect, false); assert.equal(field.props.spellCheck, false);
    }
    press(tree, 'Show password').props.onPress(); tree = render();
    assert.equal(find(tree, node => node.type === 'Input' && node.props.accessibilityLabel === 'Password').props.secureTextEntry, false);
    assert.equal(find(tree, node => node.type === 'Input' && node.props.accessibilityLabel === 'Confirm password').props.secureTextEntry, true);
    press(tree, 'Hide password').props.onPress();
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
    assert.equal(tree.type, 'SignupWelcome');
    const alternate = role === 'coach' ? 'athlete' : 'coach';
    tree.props.onSelectRole(alternate); tree = render();
    assert.ok(text(tree).includes(paths.SIGNUP_PATHS[alternate].requirement));
    press(tree, 'Choose another account type').props.onPress(); tree = render();
    tree.props.onSelectRole(role); tree = render();
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'Alex').props.value, 'Example');
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'you@example.com').props.value, 'example@onboarding.test');
    assert.equal(find(tree, node => node.type === 'Input' && node.props.placeholder === 'Password').props.value, 'fictional-password');
    assert.equal(submit().props.disabled, false);
    await submit().props.onPress(); assert.equal(requests.length, 1);
    assert.equal(requests[0].role, role); assert.equal(requests[0].email, 'example@onboarding.test');
    assert.equal(requests[0].access_code, role === 'coach' ? 'FICTIONAL-CODE' : undefined);
    assert.equal(routes.length, 0); assert.equal(logins.length, 0, 'Presentation must not grant access after server rejection');
    response = { ok: true, token: 'fictional-token', role: role === 'athlete' ? 'athlete' : 'coach', email: 'example@onboarding.test', account_state: 'EMAIL_VERIFICATION_REQUIRED', email_verified: false, verification_required: true, can_access_product: false };
    await submit().props.onPress();
    assert.equal(logins.length, 1); assert.equal(logins[0][0].user.account_state, 'EMAIL_VERIFICATION_REQUIRED');
    assert.equal(logins[0][0].user.can_access_product, false);
    assert.deepEqual(routes, ['/'], 'Successful registration must return to the canonical account-state resolver');
    assert.equal(find(render(), node => node.type === 'Input' && node.props.placeholder === 'you@example.com').props.value, 'example@onboarding.test', 'Retry preserves draft');
    assert.equal(r.back.get('hardwareBackPress')(), true); tree = render();
    assert.equal(tree.type, 'SignupWelcome'); assert.ok(r.dismissed() > 0);
    assert.equal(r.back.get('hardwareBackPress')(), true); tree = render();
    assert.notEqual(tree.type, 'SignupWelcome', 'Android back returns to sign-in');
  }
}
await exerciseLogin();

// Execute the actual role controls and backdrop recovery. No capture dependency is mocked.
function exerciseWelcome(source = read('components/onboarding/SignupWelcome.tsx')) {
  const r = runtime(), selected = [], signedIn = [];
  const component = load(source, r.modules).SignupWelcome;
  const props = { onSelectRole: value => selected.push(value), onSignIn: () => signedIn.push(true) };
  let tree = r.render(component, props);
  const choices = flatten(tree).filter(node => ['Athlete', 'Coach', 'Self-Coach'].includes(node.props?.accessibilityLabel));
  assert.equal(choices.length, 3);
  for (const choice of choices) {
    const style = Object.assign({}, ...choice.props.style({ pressed: false }).filter(Boolean));
    assert.equal(style.flexDirection, 'row'); assert.ok(style.minHeight >= 44);
    choice.props.onPress();
  }
  assert.deepEqual(selected, ['athlete', 'coach', 'self_coach']);
  assert.equal(flatten(tree).filter(node => node.type === r.modules['react-native'].Image).length, 2, 'Only brand and backdrop images belong in signup');
  assert.equal(flatten(tree).some(node => typeof node.type === 'function' && /preview|gallery/i.test(node.type.name)), false, 'Signup must not restore a screenshot gallery');
  assert.ok(find(tree, node => node.props?.accessibilityRole === 'header').props.maxFontSizeMultiplier <= 1.4, 'The decorative headline must not crowd out the role choices at accessibility text sizes');
  const photo = find(tree, node => node.props?.source === 'gym-photo');
  assert.equal(photo.props.resizeMode, 'contain', 'Preserve the loaded barbell rather than crop away its sleeve');
  assert.equal(Object.assign({}, ...photo.props.style).height, 375 * 1.5, 'The native image frame must have an explicit height');
  photo.props.onError(); tree = r.render(component, props);
  assert.equal(flatten(tree).filter(node => ['Athlete', 'Coach', 'Self-Coach'].includes(node.props?.accessibilityLabel)).length, 3, 'A failed backdrop never blocks role selection');
  press(tree, 'Sign in').props.onPress(); assert.equal(signedIn.length, 1);
}
exerciseWelcome();
const loginSource = read('app/login.tsx');
const broken = loginSource.replace("authMode === 'signup' && signupStep === 'choose'", "false /* reproduce form-first signup */");
assert.notEqual(broken, loginSource);
await assert.rejects(exerciseLogin(broken), /Signup must begin with the role experience/);
const blocked = loginSource.replace("setSignupRole(role); setSignupStep('details');", "setSignupRole(role); /* reproduce extra role interstitial */");
assert.notEqual(blocked, loginSource);
await assert.rejects(exerciseLogin(blocked), /Role selection must open account creation directly/);
const welcomeSource = read('components/onboarding/SignupWelcome.tsx');
const busy = welcomeSource.replace('<View style={styles.choiceBody}>', '<View style={styles.choiceBody}><Image source="example-app-screenshot" />');
assert.notEqual(busy, welcomeSource);
assert.throws(() => exerciseWelcome(busy), /Only brand and backdrop images belong in signup/);
console.log('PASS: all three direct role/account handlers on iOS and Android; role changes/drafts, admission/payloads, rejected request/retry/support, sign-in, native autofill/password controls, back and failed backdrop. Deliberate form-first, extra interstitial and screenshot regressions rejected.');
