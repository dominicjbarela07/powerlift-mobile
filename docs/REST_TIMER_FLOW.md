# Canonical Session rest timer

The existing global `rest-timer-completion:v2` record owns the active rest period:
`timerId`, `ownerUserId`, `workoutId`, `startedAtMs`, `endAtMs`, `notificationId`.
The former per-Session expiry key remains cleanup-only. The logger no longer owns
mutable remaining-seconds, active flags, copied deadlines, or a countdown interval.

## Set acceptance and deliberate choice

The canonical Set submission controller accepts and deduplicates server responses.
Only a new accepted SetLog may schedule the existing sheet handoff. The handoff
opens the existing Rest Timer picker; it never calls timer start. Previous selected
Session/account duration preselects the wheel. Start Timer explicitly establishes
a deadline and records the duration preference. Skip Rest closes the choice without
starting anything. These preferences are not performed or prescribed evidence.

`set-rest-handoff.ts` reconciles returned canonical SetLogs with existing superset
round evidence. An incomplete same-round paired movement remains the next action;
there is no conventional rest picker between A1/A2. A complete round, including an
explicitly skipped member in an atomic round save, may offer rest. Unequal member
Set counts use the existing `buildSupersetRoundModel`. Extra/custom Sets remain
individually loggable. A movement-final Set may offer rest before the next movement;
the server's Session-final boundary bypasses rest and retains the completion flow.
Edits, inspection, failed/cancelled saves and idempotent replays never request rest.

## Root cause and mechanics

The previous footer implemented `+30` as `startRestTimer(restSeconds + 30)`.
`startRestTimer` cleared the interval, then called `setRestActive(true)`. With an
already-active timer, the effect dependencies remained unchanged, so no replacement
interval started. The global deadline advanced while displayed seconds stopped.
The original source reproduces 1:14 → 1:44 → frozen 1:44 while true remaining time
reaches 1:42. This was an interval-lifecycle defect, with rounded display state also
being misused as the input to a new deadline.

`extendGlobalRestTimer` now adds exactly 30,000 milliseconds to the live deadline,
retaining the same rest-period ID/start time. Repeated taps read the current store,
not a render closure. Skip clears authority synchronously and cancels its native
notification. Expiry uses the existing global completion presenter and pending
completion state. Starting/extending/clearing never changes Session lifecycle.

Storage snapshots are serialized to prevent slower earlier writes from restoring
old deadlines. Native notification scheduling uses the absolute deadline, rechecks
it after authorization, and attaches only against the same timer ID **and deadline**.
Schedules that resolve after extension/Skip/replacement are cancelled. Navigation
unmount does not cancel the active timer or its background completion notification.

## Clock and rendering

`deadline-display-clock.ts` provides one shared display pulse. It derives wall-clock
time, pauses while backgrounded, and immediately rebases on foreground. It owns no
rest duration/deadline. `RestTimerClockText` derives `ceil((endAtMs-now)/1000)`;
`SessionElapsedClockText` independently derives elapsed time from Session start.
Only these small display subscribers tick. The logger movement/artwork/history tree
has no timer/elapsed `setInterval` or per-tick state. The warmup display uses the same
clock/deadline and retains its own typography. Existing isolated final countdown
audio/haptic cues remain local and reset when the deadline changes or rest stops.

The active store is filtered by current account, Session and execution mode. Coach
Preview cannot start or extend timers. Remount restores the same global persisted
deadline; there is no movement-specific timer fork. The global completion presenter
still handles expiry away from the logger and suppresses duplicate foreground notices.

## Verification and delivery

Permanent `scripts/test-rest-timer-flow.mjs` executes the real runtime with controlled
storage and native-scheduling dependencies. It covers new Set choice, remembered
preselection, Start/Skip, exact/repeated extensions and subsequent ticks, 35-second
background transitions, display mount/unmount, process hydration, ordered writes,
notification races, expiry, final Session boundaries and canonical superset rounds.
Existing timer/header/warmup contracts now enforce isolated clocks and deliberate
choice rather than the superseded root-level interval/autostart implementation.

The focused flow test runs in the accepted-contract discovery and release-critical
timer area. Full evidence and TestFlight receipt are recorded in backend
`docs/validation/rest-timer-flow-2026-09-12/README.md`.

Compatible with existing TestFlight runtime 2.1.0/build 28. No native dependencies or
configuration changes. No Production deployment or new native build.
