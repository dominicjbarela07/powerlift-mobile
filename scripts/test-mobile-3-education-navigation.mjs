import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/mobile-education.ts';

// Execute the real provider callbacks with isolated account state. This catches
// a dismissal that routes home without completing the introduction (the prior
// preview loop), and keeps Education from changing account access or mode.
const source = fs.readFileSync('context/MobileEducationContext.tsx', 'utf8');
const compile = text => ts.transpileModule(text, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
  target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;

function harness(mode, modes = [mode], text = source) {
  const user = { id: 93, user_id: 93, email: 'education-navigation@example.test',
    account_state: 'READY', can_access_product: true, is_coach: mode !== 'athlete',
    workspace_mode: mode === 'individual' ? 'individual' : 'team', available_mobile_modes: modes };
  const key = policy.mobileEducationStorageKey(user);
  const states = [policy.freshMobileEducationState(), key, 'welcome', -1, false, null];
  const routes = [];
  let cursor = 0;
  const React = { createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {},
    useRef: value => ({ current: value }),
    useState: initial => { const i = cursor++; if (i >= states.length) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
  };
  const mods = {
    react: React,
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: x => x }, View: 'View' },
    '@/components/keyboard/KeyboardSurface': { KeyboardModal: 'Modal', KeyboardScrollView: 'ScrollView' },
    '@react-native-async-storage/async-storage': {},
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-router': { usePathname: () => '/athlete-dashboard', useRouter: () => ({ replace: path => routes.push(path) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/ui/sl-text': { Text: 'Text' }, '@/constants/theme': { SLFontFamilies: {} },
    '@/context/AuthContext': { useAuth: () => ({ user, authReady: true, activeMobileMode: mode, refreshAccountState: () => { throw Error('navigation must not change account state'); } }) },
    '@/lib/mobile-education': policy,
    '@/components/education/MobileEducationRolePreview': { MobileEducationRolePreview: 'RolePreview', MobileEducationWelcomePreview: 'WelcomePreview' },
    '@/components/education/AthleteEducationOpening': { AthleteEducationExperience: 'Athlete' },
    '@/components/education/CoachEducationOpening': { CoachEducationExperience: 'Coach' },
    '@/components/education/SelfCoachEducationOpening': { SelfCoachEducationExperience: 'SelfCoach' },
  };
  const context = { exports: {}, require: name => { assert.ok(name in mods, name); return mods[name]; }, __DEV__: false };
  vm.runInNewContext(compile(text), context);
  const render = () => { cursor = 0; const tree = context.exports.MobileEducationProvider({ children: 'actual-app' });
    const modal = tree.props.children[1];
    return { value: tree.props.value, modal, lesson: modal.props.children[0] }; };
  return { render, states, routes, user };
}

for (const [mode, type, home] of [['individual', 'SelfCoach', '/(tabs)/athlete-dashboard'],
  ['coach', 'Coach', '/(tabs)/coach-dashboard'], ['athlete', 'Athlete', '/(tabs)/athlete-dashboard']]) {
  const h = harness(mode), original = JSON.stringify(h.user);
  assert.equal(h.render().lesson.type, type);
  assert.equal(h.render().lesson.props.step, -1);
  h.render().lesson.props.onNext(); assert.equal(h.render().lesson.props.step, 0);
  h.render().lesson.props.onBack(); assert.equal(h.render().lesson.props.step, -1);
  for (let i = 0; i < 3; i++) h.render().lesson.props.onNext();
  assert.equal(h.render().lesson.props.step, 2);
  h.render().lesson.props.onBack(); assert.equal(h.render().lesson.props.step, 1);
  h.render().lesson.props.onNext(); h.render().lesson.props.onNext();
  assert.equal(h.states[0].introductionComplete, true);
  assert.equal(h.render().modal.props.visible, false);
  assert.equal(h.routes.at(-1), home);
  h.render().value.replayIntroduction(); assert.equal(h.render().lesson.props.step, -1);
  h.render().lesson.props.onClose(); assert.equal(h.render().modal.props.visible, false);
  assert.equal(JSON.stringify(h.user), original, 'Education cannot mutate account/role/access');
  assert.equal(policy.shouldPresentMobileIntroduction({ authReady: true, role: mode,
    storageKey: 'same', loadedKey: 'same', onReadyHome: true, state: h.states[0] }), false,
  'completion must prevent the automatic introduction loop');
}
const dual = harness('coach', ['coach', 'individual']);
assert.equal(dual.render().lesson.type, 'View', 'multi-mode account keeps its mode-aware overview');
const switched = harness('individual'); switched.states[1] = 'another-account';
assert.equal(switched.render().modal.props.visible, false, 'old account Education never presents for new account');
const skip = harness('individual'); skip.render().lesson.props.onGoToday();
assert.equal(skip.states[0].introductionComplete, true);
assert.equal(skip.routes.at(-1), '/(tabs)/athlete-dashboard');
console.log('Actual Education provider navigation, completion-loop prevention, replay, role destinations and account boundaries: PASS');

const broken = source.replace('    setState(completeEducationIntroduction);', '    // Deliberately reproduce exit without completing Education.');
assert.notEqual(broken, source);
assert.throws(() => {
  const h = harness('individual', ['individual'], broken);
  h.render().lesson.props.onGoToday();
  assert.equal(h.states[0].introductionComplete, true, 'completion missing');
}, /completion missing/, 'the original exit loop must fail the protection');
console.log('Deliberately omitted introduction completion is rejected: PASS');
