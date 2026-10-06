import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { movementSearchSuggestions } from '../lib/canonical-movement-search.ts';

// Execute the actual consumers' search effects, not a parallel mock ranker.
// A deliberately uncooperative request resolves even after aborting it.
function harness(file, refName) {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect'
      && node.arguments[0]?.body?.getText(parsed).includes(`const requestId = ++${refName}.current`)) effect = node.arguments[0].body;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(effect, `actual search effect found: ${file}`);
  const writes = {}, timers = new Map(), requests = [];
  let timerId = 0;
  const ref = { current: 0 };
  const scope = {
    module: { exports: {} }, URLSearchParams, AbortController,
    visible: true, athleteId: 65, context: 'in-session-substitution', customStep: null,
    step: 'results', movementClass: 'accessory', mode: 'search', query: 'old row',
    currentIdentity: { id: 219 }, selectedMuscle: '', selectedExecutionFamily: '',
    state: { setup: {} }, showsResults: true, movementQuery: 'old row',
    pickerStep: 'discovery', primaryMuscleFilter: '', regionalMuscleFilters: [],
    executionFamilyFilter: '', resultMode: 'all', selectedRegion: null,
    CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS: 140, [refName]: ref,
    movementSearchSuggestions, movementSearchResultGroups: () => null,
    uniqueIdentities: rows => rows.filter(row => row.id !== 219),
    availableSwapEquipmentTypeFilters: () => [],
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetchJson(path, init) {
      return new Promise((resolve, reject) => requests.push({ path, init, resolve, reject }));
    },
  };
  for (const name of ['Rows', 'Loading', 'Error', 'Suggestions', 'ExecutionFamilyFacets',
    'SearchResults', 'SearchLoading', 'SearchLoadingMore', 'SearchNextCursor', 'SearchResultGroups', 'SearchError', 'SearchSuggestions']) {
    scope[`set${name}`] = value => { writes[name] = value; };
  }
  const context = vm.createContext(scope);
  const output = ts.transpileModule(`module.exports.run = function() ${effect.getText(parsed)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInContext(output, context);
  return { context, writes, requests, ref, run: scope.module.exports.run,
    dispatch() { for (const [id, fn] of timers) { timers.delete(id); fn(); } } };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const response = id => ({ ok: true, json: { ok: true, items: [{ id, display_name: 'A canonical result' }],
  search_suggestions: [{ movement_definition_id: id, query: 'Cable Pullover', kind: 'prefix' }] } });

for (const [file, refName, queryName, rowsName, loadingName, errorName, close] of [
  ['components/movement/GovernedAccessoryPickerModal.tsx', 'requestRef', 'query', 'Rows', 'Loading', 'Error', context => { context.visible = false; }],
  ['app/(tabs)/workout/session-workspace/[workoutId].tsx', 'searchRequestRef', 'movementQuery', 'SearchResults', 'SearchLoading', 'SearchError', context => { context.state = null; }],
]) {
  const h = harness(file, refName);
  let cleanup = h.run();
  assert.equal(h.writes[loadingName], true, 'pending state starts before debounce, never flashes no matches');
  h.dispatch();
  const old = h.requests[0];
  assert.ok(old.path.includes('search_assist=1'));
  cleanup();
  assert.equal(old.init.signal.aborted, true);
  h.context[queryName] = 'cable pullover';
  cleanup = h.run(); h.dispatch();
  h.requests[1].resolve(response(170)); await settle();
  assert.equal(h.writes[rowsName][0].id, 170);
  old.resolve(response(999)); await settle();
  assert.equal(h.writes[rowsName][0].id, 170, 'slow old response cannot replace current query');
  cleanup();
  h.context[queryName] = 'machine';
  cleanup = h.run(); h.dispatch();
  const beforeClear = h.requests.at(-1);
  cleanup(); h.context[queryName] = ''; cleanup = h.run(); h.dispatch();
  beforeClear.resolve(response(999)); await settle();
  assert.notEqual(h.writes[rowsName]?.[0]?.id, 999, 'clearing invalidates old pending results');
  cleanup?.();
  h.context[queryName] = 'row'; cleanup = h.run(); h.dispatch();
  const beforeClose = h.requests.at(-1);
  cleanup(); close(h.context); h.run();
  beforeClose.reject(new Error('delayed failure')); await settle();
  assert.equal(h.writes[loadingName], false);
  assert.notEqual(h.writes[errorName], 'delayed failure', 'closing cannot retain a stale error');
}

// Execute the actual paginated loader too: an old page may finish after a
// new initial query, and must not append unrelated rows or erase new loading.
{
  const file = 'app/(tabs)/workout/session-workspace/[workoutId].tsx';
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let loader;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'loadMoreMovements') loader = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(loader);
  const h = harness(file, 'searchRequestRef');
  h.context.searchNextCursor = 'old-page';
  h.context.searchLoadingMore = false;
  h.context.searchResultGroups = null;
  vm.runInContext(ts.transpileModule(`module.exports.loadMore = ${loader.getText(parsed)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, h.context);
  const pending = h.context.module.exports.loadMore();
  h.ref.current++;
  h.writes.SearchResults = [{ id: 170 }];
  h.writes.SearchLoadingMore = true;
  h.requests[0].resolve(response(999));
  await pending;
  assert.equal(h.writes.SearchResults[0].id, 170, 'late pagination cannot append to a newer search');
  assert.equal(h.writes.SearchLoadingMore, true, 'old page cannot end a newer request loading state');
}

assert.deepEqual(movementSearchSuggestions([
  { movement_definition_id: 170, query: 'Cable Pullover' },
  { movement_definition_id: 999, query: 'Private withdrawn movement' },
  { movement_definition_id: 170, query: 'Cable Pullover' },
], [{ id: 170 }]).map(row => row.query), ['Cable Pullover']);
console.log('PASS: actual Swap/Workspace effects reject late, cleared, closed and paginated responses; abort prior reads; show pending before debounce; suggestions retain authorized result IDs only.');
