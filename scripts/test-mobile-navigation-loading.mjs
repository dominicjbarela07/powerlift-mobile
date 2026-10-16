import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const flag = process.argv.indexOf('--candidate-root');
const root = flag < 0 ? process.cwd() : path.resolve(process.argv[flag + 1]);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function harness() {
  let cursor = 0, dirty = false, component, output;
  const slots = [], effects = [], listeners = new Set();
  const state = { user: { id: 1, email: 'owner@example.test', role: 'coach', athlete_id: 2, mobile_mode: 'individual' },
    subject: { athleteId: 2, valid: true }, focused: true, revision: 0, now: Date.now(), calls: [], ledgerPending: null, calendarPending: null, denied: false };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], v => { const next = typeof v === 'function' ? v(slots[i]) : v; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  const subscription = { remove() {} };
  const focusEffect = fn => react.useEffect(() => state.focused ? fn() : undefined, [state.focused, fn]);
  const invalidations = new Set();
  const evidence = { onInvalidation: fn => { invalidations.add(fn); return () => invalidations.delete(fn); } };
  const today = () => new Clock().toISOString().slice(0, 10);
  const theme = new Proxy({}, { get: () => ({}) });
  const deps = {
    react,
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v, hairlineWidth: .5 },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => subscription },
      AppState: { currentState: 'active', addEventListener: (_name, fn) => { listeners.add(fn); return subscription; } }, Alert: { alert() {} } },
    'expo-router': { useFocusEffect: focusEffect, useRouter: () => ({ push() {} }) },
    '@react-navigation/native': { useIsFocused: () => state.focused },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-haptics': {},
    '@/context/AuthContext': { useAuth: () => ({ user: state.user }) },
    './athlete-ledger-subject': { useAthleteLedgerSubject: () => state.subject },
    './use-ledger-resource': { useEvidenceRevision: () => state.revision },
    '@/lib/evidence-read-cache': { evidenceReadCache: evidence, invalidateEvidenceReads: () => { state.revision++; for (const fn of invalidations) fn({}); } },
    '@/components/ui/sl-text': { Text: 'Text' }, '@/constants/theme': { SLColors: theme, SLTypography: theme },
    '@/components/calendar/AthleteCalendarExperience': { parseYmd: v => new Clock(v + 'T12:00:00'), toYmd: v => v.toISOString().slice(0, 10) },
    '@/components/calendar/AthleteCalendarStoryboardV2': { AthleteCalendarStoryboardV2: 'Calendar' },
    '@/components/calendar/CalendarEventSheet': { CalendarEventSheet: 'EventSheet' },
    '@/components/calendar/TrainingScheduleSheet': { TrainingScheduleSheet: 'ScheduleSheet' },
    '@/components/workout-logger/readiness-modal': { ReadinessModal: 'Readiness' },
    '@/lib/api': { getDeviceTimezone: async () => 'UTC', fetchJson: async url => {
      state.calls.push(url);
      if (url.includes('/calendar/day')) return { ok: true, json: { ok: true, calendar_day: { date: today(), sessions: [] } } };
      if (state.calendarPending) return state.calendarPending.promise;
      if (state.denied) return { ok: false, status: 403, json: { ok: false, error: 'Forbidden' } };
      const query = new URL(url, 'https://example.test').searchParams;
      return { ok: true, json: { ok: true, athlete_calendar: { today: today(), days: [{ date: today(), sessions: [] }],
        range: { start_date: query.get('start'), end_date: query.get('end'), timezone: 'UTC' } } } };
    } },
  };
  class LedgerRequestError extends Error { constructor(kind) { super(kind); this.kind = kind; } }
  deps['@/lib/ledger-data'] = { LedgerRequestError,
    fetchLedgerProgression: async () => { state.calls.push('progression'); if (state.ledgerPending) await state.ledgerPending.promise; if (state.denied) throw new LedgerRequestError('unauthorized'); return { marker: state.user.id }; },
    fetchLedgerCurrentBests: async () => { state.calls.push('bests'); if (state.ledgerPending) await state.ledgerPending.promise; return { items: [{ id: state.user.id }] }; },
    fetchLedgerAccomplishments: async () => { state.calls.push('events'); if (state.ledgerPending) await state.ledgerPending.promise; return [{ id: state.user.id }]; },
  };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const m = { exports: {} }; modules.set(file, m.exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module: m, exports: m.exports, __DEV__: false, Date: Clock, Map, Set, Promise, URL, URLSearchParams,
      AbortController, console: { warn() {}, log() {} }, require: key => {
        if (key in deps) return deps[key];
        const relative = key.startsWith('@/') ? key.slice(2) : key.startsWith('.') ? path.join(path.dirname(file), key) : null;
        if (relative) { for (const ext of ['', '.ts', '.tsx', '.js']) if (fs.existsSync(path.join(root, relative + ext))) return load(relative + ext); }
        throw new Error(`Unmocked ${file}: ${key}`);
      } }); return m.exports;
  }
  async function render(fn = component) { component = fn; for (let i = 0; i < 15; i++) { dirty = false; cursor = 0; output = component();
      while (effects.length) effects.shift()(); await new Promise(r => setImmediate(r)); if (!dirty) break; } return output; }
  const nodes = n => n && typeof n === 'object' ? [n, ...(n.children || []).flat(Infinity).flatMap(nodes)] : [];
  return { state, load, render, get output() { return output; }, find: type => nodes(output).find(n => n.type === type),
    invalidate: () => { state.revision++; for (const fn of invalidations) fn({ path: '/workouts/mobile/1/log_set' }); },
    foreground: () => { for (const fn of listeners) { fn('background'); fn('active'); } } };
}

let h = harness();
const live = h.load('components/ledger/use-ledger-live-data.ts').useLedgerLiveData;
await h.render(() => live('90d', { allowPartial: true, projection: 'ledger-index' }));
assert.equal(h.output.loading, false); assert.equal(h.state.calls.length, 3, 'Index reads start together once');
h.state.focused = false; await h.render(); h.state.now += 11_000; h.state.ledgerPending = deferred(); h.state.focused = true; await h.render();
assert.equal(h.state.calls.length, 6); assert.equal(h.output.loading, false, 'warm same-subject Ledger must remain visible while fresh reads are pending');
assert.equal(h.output.progression.marker, 1);
h.state.ledgerPending.resolve(); h.state.ledgerPending = null; await h.render();
h.state.ledgerPending = deferred(); h.invalidate(); await h.render();
assert.equal(h.output.loading, true, 'a mutation revision must not masquerade as fresh evidence'); assert.equal(h.output.progression, null);
const obsolete = h.state.ledgerPending; h.state.user = { ...h.state.user, id: 9 }; h.state.subject = { athleteId: 10, valid: true }; await h.render();
assert.equal(h.output.progression, null, 'another account never sees retained evidence');
obsolete.resolve(); h.state.ledgerPending = null; await h.render(); assert.equal(h.output.progression.marker, 9);
h.state.focused = false; await h.render(); h.state.now += 11_000; h.state.denied = true; h.state.focused = true; await h.render();
assert.equal(h.output.progression, null); assert.equal(h.output.errorKind, 'unauthorized', 'denial clears same-subject retained evidence');

h = harness();
const calendar = h.load('app/(tabs)/athlete-calendar.tsx').default;
await h.render(calendar); assert.ok(h.find('Calendar'));
const rangeCalls = () => h.state.calls.filter(url => url.includes('/calendar?')).length;
const first = rangeCalls(); h.state.focused = false; await h.render(); h.state.focused = true; await h.render();
assert.equal(rangeCalls(), first, 'rapid Calendar return must reuse the scoped unexpired range');
h.state.focused = false; await h.render(); h.state.now += 11_000; h.state.calendarPending = deferred(); h.state.focused = true; await h.render();
assert.equal(rangeCalls(), first + 1); assert.ok(h.find('Calendar'), 'expired range remains visible during revalidation'); assert.equal(h.find('Calendar').props.refreshing, true);
h.state.calendarPending.resolve({ ok: true, json: { ok: true, athlete_calendar: { days: [] } } }); h.state.calendarPending = null; await h.render();
h.invalidate(); h.state.focused = false; await h.render(); h.state.focused = true; await h.render();
assert.equal(rangeCalls(), first + 2, 'a Set mutation invalidates the navigation cache');
h.foreground(); await h.render(); assert.equal(rangeCalls(), first + 3, 'foreground return must fetch fresh data');
h.find('Calendar').props.onRefresh(); await h.render(); assert.equal(rangeCalls(), first + 4, 'manual refresh must fetch fresh data');
h.state.user = { id: 12, email: 'other@example.test', role: 'athlete', athlete_id: 13 }; h.state.calendarPending = deferred(); await h.render();
assert.equal(h.find('Calendar'), undefined, 'a new account never sees the previous Calendar');
h.state.calendarPending.resolve({ ok: true, json: { ok: true, athlete_calendar: { days: [] } } }); h.state.calendarPending = null; await h.render();
h.state.denied = true; h.find('Calendar').props.onRefresh(); await h.render();
assert.equal(h.find('Calendar'), undefined, 'revoked Calendar access clears retained history');
console.log('PASS: actual Ledger hook and Calendar route; cold/warm/expiry, concurrent reads, mutation, account switch, obsolete responses, foreground/manual freshness and authorization denial.');
