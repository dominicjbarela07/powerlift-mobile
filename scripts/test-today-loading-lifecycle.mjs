import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const flag = process.argv.indexOf('--candidate-root');
const root = flag < 0 ? process.cwd() : path.resolve(process.argv[flag + 1]);
const routePath = 'app/(tabs)/athlete-dashboard.tsx';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const projection = (name = 'Current athlete', date = '2026-10-30') => ({
  date, timezone: 'UTC', athlete: { id: 72, name },
  phase: {}, mission: { kind: 'rest', session: null },
});
const response = (name, date) => ({ ok: true, status: 200, json: { ok: true, today: projection(name, date) } });

function harness({ mode = 'athlete', broken = false, storagePending = null, ignoreAbort = false } = {}) {
  let cursor = 0, dirty = false, tree, component;
  const slots = [], effects = [], listeners = new Set(), timers = new Set(), modules = new Map();
  const state = {
    focused: true, now: Date.parse('2026-10-30T12:00:00Z'), calls: [], routes: [], writes: [], blocks: [],
    auth: { token: 'fixture-token', user: { id: 82, athlete_id: 72, email: 'fictional@example.test', preferred_units: 'lb', role: mode === 'athlete' ? 'athlete' : 'coach' },
      workspaceKey: `82:${mode}:athlete:72:0`, activeMobileMode: mode },
  };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }), Fragment: 'Fragment',
    useState(initial) {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  const router = { push: p => state.routes.push(p), replace: p => state.routes.push(p) };
  state.auth.applyAccountStatePayload = async payload => { state.blocks.push(payload); if (state.blockPending) await state.blockPending.promise; };
  const deps = {
    react,
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', Image: 'Image', Pressable: 'Pressable', RefreshControl: 'RefreshControl',
      StyleSheet: { create: x => x, hairlineWidth: .5 },
      AppState: { currentState: 'active', addEventListener: (_event, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } },
    '@react-navigation/native': { useFocusEffect: fn => react.useEffect(() => state.focused ? fn() : undefined, [state.focused, fn]) },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({}) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-async-storage/async-storage': {
      getItem: key => key.includes('today.cache') && storagePending ? storagePending.promise : Promise.resolve(null),
      setItem: async (key, value) => { state.writes.push({ key, value }); }, removeItem: async key => { state.writes.push({ key, removed: true }); },
    },
    '@/context/AuthContext': { useAuth: () => state.auth },
    '@/components/keyboard/KeyboardSurface': { KeyboardModal: 'Modal', KeyboardScrollView: 'ScrollView' },
    '@/components/ui/sl-text': { Text: 'Text' }, '@/components/ui': { SLButton: 'Button', SLProfileAvatar: 'Avatar' },
    '@/components/ui/floating-control-coordinator': { FloatingControlCoordinator: 'Coordinator' },
    '@/components/AthleteCheckInExperience': { TodayCheckInSurface: 'CoachCheckIn', TodaySubmittedCheckIn: 'SubmittedCheckIn' },
    '@/components/home/AthleteHomeV3': { AthleteHomeV3: 'Home' },
    '@/components/workout-logger/readiness-modal': { ReadinessModal: 'Readiness' },
    '@/lib/motion': { useSLReducedMotion: () => true },
    '@/lib/mobileMovementNames': { simplifyMobileMovementName: name => name },
    '@/constants/theme': { SLColors: new Proxy({}, { get: () => '#999' }), SLRadius: new Proxy({}, { get: () => 12 }),
      SLTypography: new Proxy({}, { get: () => ({ fontSize: 14, lineHeight: 20 }) }) },
    '@/lib/api': {
      isAccountStateBlockedPayload: p => p?.account_state === 'ACTIVATION_REQUIRED',
      fetchJson: (url, options) => {
        assert.equal(url, '/athletes/mobile/dashboard');
        const pending = deferred(); state.calls.push({ ...pending, url, options });
        if (!ignoreAbort) options.signal.addEventListener('abort', () => pending.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true });
        return pending.promise;
      },
    },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === routePath && broken) {
      const marker = 'if (loadGeneration === loadGenerationRef.current) {\n          setLoading(false);';
      assert.ok(source.includes(marker), 'the permanent failure control must remove the actual loading ownership guard');
      source = source.replace(marker, 'if (true) {\n          setLoading(false);');
    }
    const m = { exports: {} }; modules.set(file, m.exports);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module: m, exports: m.exports, __DEV__: false, Date: Clock, Intl, AbortController, console,
      setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn),
      require: key => {
        if (key in deps) return deps[key];
        if (key.startsWith('@/assets/')) return key;
        const relative = key.startsWith('@/') ? key.slice(2) : key.startsWith('.') ? path.join(path.dirname(file), key) : null;
        if (relative) for (const ext of ['', '.ts', '.tsx', '.js']) {
          if (fs.existsSync(path.join(root, relative + ext))) return load(relative + ext);
        }
        throw new Error(`Unmocked dependency ${file}: ${key}`);
      },
    });
    return m.exports;
  }
  component = load(routePath).default;
  const renderSync = () => { cursor = 0; dirty = false; tree = component(); while (effects.length) effects.shift()(); return tree; };
  const flush = async () => {
    for (let i = 0; i < 20; i++) { renderSync(); await new Promise(r => setImmediate(r)); if (!dirty) return tree; }
    throw new Error('Today effects did not converge');
  };
  const nodes = n => n && typeof n === 'object' ? [n, ...(n.children || []).flat(Infinity).flatMap(nodes)] : [];
  const find = type => nodes(tree).find(n => n.type === type);
  return { state, flush, renderSync, find, appState: value => { for (const fn of listeners) fn(value); },
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
    refresh: () => find('ScrollView').props.refreshControl.props.onRefresh(),
    rollover: () => { for (const fn of timers) fn(); },
  };
}

async function coldResume(h) {
  await h.flush();
  assert.ok(h.find('ActivityIndicator'), 'cold entry must show loading');
  h.appState('background'); h.appState('active'); await h.flush();
  assert.equal(h.state.calls.length, 2);
  assert.ok(h.find('ActivityIndicator'), 'cancelled first request must leave replacement loading, never Today unavailable');
  assert.equal(h.find('Button'), undefined, 'a cancelled request is not a failure requiring Retry');
  h.state.calls[1].resolve(response('Fresh after resume')); await h.flush();
  assert.equal(h.find('Home').props.today.athlete.name, 'Fresh after resume');
  assert.equal(h.find('Home').props.preferredUnits, 'lb', 'loading recovery must retain authenticated display-unit preferences');
}

for (const mode of ['athlete', 'individual']) await coldResume(harness({ mode }));

let h = harness(); await h.flush();
h.state.focused = false; h.renderSync(); h.state.focused = true; h.renderSync(); await h.flush();
assert.ok(h.find('ActivityIndicator'), 'rapid blur/refocus cannot complete the new request from old cleanup');
h.state.calls[1].resolve(response()); await h.flush(); assert.ok(h.find('Home'));

h = harness(); await h.flush(); h.state.calls[0].resolve(response()); await h.flush();
void h.refresh(); void h.refresh(); await h.flush();
assert.equal(h.find('ScrollView').props.refreshControl.props.refreshing, true, 'old refresh cannot stop the new refresh indicator');
h.state.calls.at(-1).resolve(response('Refreshed')); await h.flush();
assert.equal(h.find('ScrollView').props.refreshControl.props.refreshing, false);
assert.equal(h.find('Home').props.today.athlete.name, 'Refreshed');

h = harness({ ignoreAbort: true }); await h.flush();
h.appState('background'); h.appState('active'); h.state.calls[1].resolve(response('Newest')); await h.flush();
h.state.calls[0].resolve(response('Obsolete')); await h.flush();
assert.equal(h.find('Home').props.today.athlete.name, 'Newest', 'out-of-order requests cannot replace current evidence');
assert.equal(h.state.writes.filter(w => w.value).length, 1, 'obsolete requests cannot write cache');

h = harness(); await h.flush(); h.state.calls[0].reject(new TypeError('Network request failed')); await h.flush();
assert.equal(h.find('ActivityIndicator'), undefined); assert.equal(h.find('Button').props.label, 'Retry');
h.find('Button').props.onPress(); await h.flush(); assert.ok(h.find('ActivityIndicator'));
h.state.calls[1].resolve(response()); await h.flush(); assert.ok(h.find('Home'), 'Retry must actually recover');

for (const status of [401, 403]) {
  const deniedCache = deferred(); h = harness({ storagePending: deniedCache }); await h.flush();
  h.state.calls[0].resolve({ ok: false, status, json: status === 403 ? { account_state: 'ACTIVATION_REQUIRED' } : { ok: false } });
  await h.flush(); assert.equal(h.state.routes.at(-1), status === 401 ? '/login' : '/');
  deniedCache.resolve(JSON.stringify(projection('Cache after denial'))); await h.flush();
  assert.equal(h.find('Home'), undefined, 'denied account state never becomes a fabricated ready Today');
}

for (const invalid of [{ ok: false, status: 503, json: { ok: false, error: 'Temporarily unavailable' } }, { ok: true, status: 200, json: { ok: true } }]) {
  h = harness(); await h.flush(); h.state.calls[0].resolve(invalid); await h.flush();
  assert.equal(h.find('Button').props.label, 'Retry'); assert.equal(h.find('Home'), undefined);
}
h = harness(); await h.flush(); h.state.calls[0].reject(Object.assign(new Error('Native abort'), { name: 'AbortError' })); await h.flush();
assert.equal(h.find('Button').props.label, 'Retry', 'an unexpected current transport abort cannot leave an endless spinner');

// Cache restoration may finish after an authenticated response. It must not win.
const cache = deferred(); h = harness({ storagePending: cache }); await h.flush();
h.state.calls[0].resolve(response('Server evidence')); await h.flush();
cache.resolve(JSON.stringify(projection('Old cache'))); await h.flush();
assert.equal(h.find('Home').props.today.athlete.name, 'Server evidence', 'late cache cannot overwrite a successful server response');

const warm = deferred(); h = harness({ storagePending: warm }); await h.flush();
warm.resolve(JSON.stringify(projection('Warm same-account cache'))); await h.flush();
assert.equal(h.find('Home').props.today.athlete.name, 'Warm same-account cache', 'valid cache must still hydrate during a slow read');
h.state.calls[0].resolve(response()); await h.flush();
h.state.now += 86_400_000; h.rollover(); await h.flush();
assert.equal(h.find('Home'), undefined, 'yesterday evidence cannot stand in for Today');
assert.ok(h.find('ActivityIndicator')); h.state.calls.at(-1).resolve(response('Next day', '2026-10-31')); await h.flush();
assert.equal(h.find('Home').props.today.athlete.name, 'Next day');

h = harness(); await h.flush(); h.state.focused = false; await h.flush();
const hiddenCalls = h.state.calls.length; h.appState('background'); h.appState('active'); await h.flush();
assert.equal(h.state.calls.length, hiddenCalls, 'an unfocused Today must not refetch on foreground');

h = harness(); await h.flush(); h.state.blockPending = deferred();
h.state.calls[0].resolve({ ok: false, status: 403, json: { account_state: 'ACTIVATION_REQUIRED' } }); await h.flush();
h.state.focused = false; await h.flush(); h.state.blockPending.resolve(); await h.flush();
assert.equal(h.state.routes.length, 0, 'obsolete account reconciliation must not navigate a screen that lost focus');

h = harness(); await h.flush(); h.state.blockPending = deferred();
h.state.calls[0].resolve({ ok: false, status: 403, json: { account_state: 'ACTIVATION_REQUIRED' } }); await h.flush();
h.state.blockPending.reject(new Error('Local state storage unavailable')); await h.flush();
assert.equal(h.find('Button').props.label, 'Retry', 'reconciliation failure remains explicit and recoverable');

const departed = harness({ mode: 'individual', ignoreAbort: true }); await departed.flush(); departed.unmount();
const entered = harness({ mode: 'athlete' }); await entered.flush();
departed.state.calls[0].resolve(response('Departed workspace')); await new Promise(r => setImmediate(r));
assert.equal(departed.state.writes.filter(w => w.value).length, 0, 'the unmounted workspace cannot populate a cache after mode switch');
assert.ok(entered.find('ActivityIndicator')); entered.state.calls[0].resolve(response('Athlete workspace')); await entered.flush();
assert.equal(entered.find('Home').props.today.athlete.name, 'Athlete workspace');

await assert.rejects(() => coldResume(harness({ broken: true })), /replacement loading/, 'removing the actual ownership guard must reproduce the bug');
console.log('PASS Today actual-route lifecycle: cold/resume (Athlete + Self-Coach), blur/refocus, overlapping refresh, obsolete responses/cache, Retry, API/invalid/transport/reconciliation failures, 401/account-state denial, day rollover, hidden foreground, stale redirect, workspace departure and display units; deliberate loading-guard removal rejected.');
