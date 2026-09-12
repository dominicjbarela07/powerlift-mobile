# Begin Session readiness gate

September 12, 2026 — compatible mobile-only TestFlight fix for runtime 2.1.0/build 28.

The Session V3 footer called `beginWorkout` directly while its secondary action
opened readiness. The original `handleBeginWorkoutPress` was disconnected. The
footer now opens the canonical readiness modal as the only fresh-start entry.

- Begin opens the sheet without checkout, timing or lifecycle writes.
- Save & Begin persists via the existing Session readiness endpoint, then follows
  the existing checkout/timing/begin path. Failed saves stay retryable in the sheet.
- Skip & Begin calls only the existing start path. It never posts a legacy
  `skipped` sentinel or creates default evidence.
- Close/backdrop/gesture dismissal leaves the Session assigned.
- Fresh server Session data plus its canonical Calendar-day readiness projection
  determine whether applicable readiness already exists. Exact Session or explicit
  Session-less same-day observations are accepted; another Session's row, another
  athlete, another date, and legacy negative-score skips are not.
- An existing observation is shown for confirmation with Continue to Session,
  preserving its values and ID without another save.
- Resume is separate: active navigation/background/restart does not reopen readiness.
- Coach Athlete Preview can open the same sheet. Save/Skip are disabled, and intent,
  capability and server guards deny readiness or lifecycle mutations.
- The synchronous intent lock covers lookup, choice, persistence and begin;
  checkout/begin also has a synchronous request lock. Actor/navigation changes
  invalidate pending continuations. Existing stable timing-event retries remain intact.
- Submit and Skip remain pinned below the scrolling form. Unit control remains in
  the Session footer. The redundant optional check-in launcher is gone.

Tests: `scripts/test-session-readiness-start.mjs`, `scripts/test-readiness-modal.mjs`,
backend `tests/test_mobile_readiness.py`, Session lifecycle and execution-access suites.
The accepted-contract and release-critical runners include the readiness gate.

The generated free-weight art and associated larger DEV artwork frames are an
explicitly excluded prior DEV scope. `__DEV__` branches retain current DEV rendering
and preserve the previously shipped fallback/geometry in release. The guarded OTA
publisher hashes its actual fresh export and refuses any generated candidate bytes.
This readiness fix does not publish pending art or grant any art approval.

No native dependency/config/plugin change is needed. No Production mobile or
backend deployment is part of this fix. Full validation and delivery receipt live
in backend `docs/validation/pre-session-readiness-2026-09-12/README.md`.
