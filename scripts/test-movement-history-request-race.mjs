import assert from 'node:assert/strict';

import {
  MovementHistoryRequestGuard,
  emptyMovementHistoryPageState,
} from '../lib/movement-history-request-guard.ts';

const apply = (guard, request, mutation, anchor) => {
  if (guard.isCurrent(request, anchor)) mutation();
};

// B remains authoritative when A resolves after it.
{
  const guard = new MovementHistoryRequestGuard();
  let displayed = null;
  const requestA = guard.beginFull('?core_lifts=SQ');
  const requestB = guard.beginFull('?core_lifts=BN');
  apply(guard, requestB, () => { displayed = 'B'; });
  apply(guard, requestA, () => { displayed = 'A'; });
  assert.equal(displayed, 'B');
}

// A page cannot append after filters move to B.
{
  const guard = new MovementHistoryRequestGuard();
  guard.beginFull('?core_lifts=SQ');
  const anchor = { cursor: 'cursor-a', contextToken: 'signed-a' };
  const pageA = guard.beginPage('?core_lifts=SQ', anchor);
  guard.beginFull('?core_lifts=BN');
  let appended = false;
  apply(guard, pageA, () => { appended = true; }, anchor);
  assert.equal(appended, false);
}

// A refresh is a full authoritative generation and becomes stale after a filter change.
{
  const guard = new MovementHistoryRequestGuard();
  guard.beginFull('?core_lifts=SQ');
  const refreshA = guard.beginFull('?core_lifts=SQ');
  guard.beginFull('?core_lifts=DL');
  assert.equal(guard.isCurrent(refreshA), false);
}

// Athlete context is part of the query identity.
{
  const guard = new MovementHistoryRequestGuard();
  const athleteOne = guard.beginFull('?athlete_id=1');
  const athleteTwo = guard.beginFull('?athlete_id=2');
  assert.equal(guard.isCurrent(athleteOne), false);
  assert.equal(guard.isCurrent(athleteTwo), true);
}

// An old failure cannot overwrite a newer success.
{
  const guard = new MovementHistoryRequestGuard();
  let error = null;
  const oldRequest = guard.beginFull('?q=old');
  const newRequest = guard.beginFull('?q=new');
  apply(guard, newRequest, () => { error = null; });
  apply(guard, oldRequest, () => { error = 'stale failure'; });
  assert.equal(error, null);
}

// An old success cannot place stale data beneath a newer failure.
{
  const guard = new MovementHistoryRequestGuard();
  let state = { data: null, error: null };
  const oldRequest = guard.beginFull('?q=old');
  const newRequest = guard.beginFull('?q=new');
  apply(guard, newRequest, () => { state = { data: null, error: 'new failure' }; });
  apply(guard, oldRequest, () => { state = { data: 'old data', error: null }; });
  assert.deepEqual(state, { data: null, error: 'new failure' });
}

// Unmount invalidates every outstanding request.
{
  const guard = new MovementHistoryRequestGuard();
  const request = guard.beginFull('?q=mounted');
  guard.unmount();
  assert.equal(guard.isCurrent(request), false);
}

// Valid pagination appends, advances its identity, and deduplicates event IDs.
{
  const guard = new MovementHistoryRequestGuard();
  guard.beginFull('?core_lifts=SQ');
  const anchor = { cursor: 'cursor-1', contextToken: 'signed-context' };
  const page = guard.beginPage('?core_lifts=SQ', anchor);
  let items = [{ id: 1 }, { id: 2 }];
  let cursor = anchor.cursor;
  let contextToken = anchor.contextToken;
  apply(guard, page, () => {
    items = [...new Map([...items, { id: 2 }, { id: 3 }].map((event) => [event.id, event])).values()];
    cursor = 'cursor-2';
    contextToken = 'signed-context-2';
  }, anchor);
  assert.deepEqual(items.map((event) => event.id), [1, 2, 3]);
  assert.equal(cursor, 'cursor-2');
  assert.equal(contextToken, 'signed-context-2');
}

// A new filter generation uses the canonical empty paging state.
assert.deepEqual(emptyMovementHistoryPageState(), {
  items: [], cursor: null, contextToken: null, hasMore: false, error: null,
});

// Page identity includes the exact signed token and cursor.
{
  const guard = new MovementHistoryRequestGuard();
  guard.beginFull('?core_lifts=SQ');
  const anchor = { cursor: 'cursor-a', contextToken: 'signed-a' };
  const page = guard.beginPage('?core_lifts=SQ', anchor);
  assert.equal(guard.isCurrent(page, anchor), true);
  assert.equal(guard.isCurrent(page, { cursor: 'cursor-b', contextToken: 'signed-a' }), false);
  assert.equal(guard.isCurrent(page, { cursor: 'cursor-a', contextToken: 'signed-b' }), false);
}

console.log('[movement-history] request generation and stale-response tests passed');
