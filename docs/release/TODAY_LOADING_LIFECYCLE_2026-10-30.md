# Mobile 3.0 Today loading lifecycle

## Request and acceptance

The owner reports “Today is unavailable” on opening mobile or switching to
Athlete mode; it eventually clears after waiting or navigating. Investigate,
repair and validate this intermittent failure in canonical mobile DEV for 3.0.
Do not mistake a transient/cancelled read for an unavailable Today projection.

- Reproduce the affected route's actual focus/foreground request sequence before
  changing behavior. Keep a permanent executable regression and old-source failure.
- Only the current request may complete loading, publish evidence/errors, write
  the Today cache or route after account-state reconciliation.
- Preserve same-account current-day cache hydration and background refreshing;
  stale cache reads must not overwrite fresher server evidence.
- Validate real failure/Retry, expired authentication, backend account-state
  denial, day rollover, and Athlete/Self-Coach/mode-switch contexts.
- Preserve backend-owned permissions, canonical identity, workspace isolation,
  Session execution guards, readiness mutations, art and existing navigation.
- No native build, simulator run, backend deployment or mobile publication is
  included in this request. Keep 3.0 as the target; do not reopen 2.1.

## Validation plan

Execute the actual dashboard route in the repository's hook/VM harness with
controlled request completion order, navigation focus, AppState and storage.
Run the adjacent Calendar/Today, mobile-mode transition, navigation-loading,
Home/readiness contracts and TypeScript checks once after the bounded fix.
Record local evidence separately from live publication and physical observation.

## Cause and repair

The original actual-route test fails with a pending replacement request and no
loading indicator. `createLatestRequestManager` correctly rejects cancelled and
obsolete results, but the route's unconditional `finally` still turns loading
off. With no cached Today and no actual error, rendering falls through to the
exact photographed “Today is unavailable.” Navigating/refocusing causes another
read, which explains why the screen can eventually recover. This deterministically
reproduces the failure class; the photograph does not establish every request
in the owner's particular occurrence.

Each load now owns a route generation. Starting a replacement or leaving focus
retires the prior owner before cancellation. Only the current owner may finish
loading/refreshing or route after asynchronous account-state reconciliation.
Foreground events no longer issue Today reads from a hidden tab. Unexpected
transport aborts and reconciliation exceptions remain explicit Retry failures.

A second controlled race showed that slow storage could restore older cached
Today after the server had already supplied fresh evidence. Cache restoration
now checks the live revision, including authentication/account-state denials.
Current-day, same-workspace warm hydration remains supported.

The four other consumers of `createLatestRequestManager` were inspected:
Review List, Review Hub and Coach Video Archive return before completing loading
for obsolete/cancelled requests; Session Logger checks request ownership and
active-request state. They do not share Today's unconditional `finally` defect.
No shared helper or unrelated screen was changed.

## Validation and delivery

- Original actual-route test: **exit 1**, retained in `before.log`.
- Patched actual route: passes cold entry/resume in Athlete and Self-Coach,
  rapid blur/refocus, overlapping refresh, out-of-order results, late/warm cache,
  real failure and Retry, 401/account denial, invalid/API errors, unexpected
  transport abort, reconciliation failure, midnight rollover, hidden foreground,
  stale redirect, workspace departure and authenticated display units.
- Permanent deliberate failure: removing the actual loading-owner guard from
  the in-memory route reproduces the loading failure and is rejected.
- Nine adjacent checks pass: Calendar/Today lifecycle, mobile-mode transition,
  mobile navigation loading, Home v3, recovery-day readiness state, Today Archive,
  Training Hub/Today hero, readiness modal and readiness survey rendering.
- TypeScript `--noEmit` and whitespace validation pass.
- The optional historical `test-preferred-unit-display.mjs` fails its unchanged
  Settings source-shape assertion at line 86 on both original and patched Today.
  It was already in `superseded-source-shape-snapshot` quarantine. Its test and
  Settings source match HEAD; no gate/test/quarantine was weakened. The new
  actual-route test directly verifies the authenticated unit preference instead.

Evidence lives in `docs/validation/today-loading-lifecycle-2026-10-30/`.
This is a **canonical DEV 3.0 repair**. No Production/API deployment, OTA/native
publication or physical-device/simulator observation has occurred in this task.

State machine touched: route read/loading/cache ownership across focus, foreground
and workspace departure. Adjacent risks: warm hydration, navigation, backend
account-state redirection and readiness display. AuthContext retains identity,
mode and readiness authority; backend permission/execution rules are unchanged.
The actual-route regressions, retained original-source failure and removal
control protect the identified race; the adjacent tests cover existing flows.
