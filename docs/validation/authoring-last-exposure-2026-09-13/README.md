# Programming Editor exact Last Exposure — 2026-09-13

## Reproduction and first incorrect transition

Existing DEV user 1, athlete 12, draft Session 1729, item 18021 (Competition Squat, 3 × 5 @7) showed `No previous exact exposure.` in the canonical native DEV editor. No evidence or Session was created to reproduce this defect. Independent governed history contains 87 exact Squat SetLogs. Latest completed exposure: Session 1726, September 9; representative SetLog 20372, 56.699046 kg = 125 lb × 7 @8.5 RPE, four recorded sets. Native accessibility state after the fix contains that exact value, date and count.

The first incorrect transition was treating absent Core hydration as a successful empty history read. The editor requests `history=summary`; the backend intentionally skips the expensive Core history graph for that contract. Its item serializer returns accessory hydration only, so even `history=full` does not repair the editor's Core `movement_history`. The editor then used accessory-only helpers that require `exact_identity` and would reject `exact_core_identity` even if supplied. Core History access was also unnecessarily suppressed.

| Layer | Real governed identity / evidence |
| --- | --- |
| Programming item | WorkoutItem 18021; CoreMovementDefinition 1 |
| Core identity | `competition_squat`, family squat, kind competition |
| General catalog mirror | MovementDefinition 1 with explicit Core link; separate ID namespace |
| Authoring draft | Carries serialized `core_movement`; prescription/designation/set type are not history identity |
| Old request | Session 1729 `history=summary`; item history null |
| Correct exact request | Athlete 12 + `core_movement_id=1&view=v2&range=all&limit=6` |
| Backend resolver | `exact_core_history_rows`, immutable performed snapshot first; exact `core:1` |
| Modern evidence | Set 20372, performed canonical definition 1, athlete 12, September 9 |
| Governed legacy evidence | Set 16249, Session 1294, August 5, 125 lb × 6 @7; direct IDs absent; `constrained_legacy_lift_code` resolves Core 1 |
| Response | `exact_core_identity`, comparison allowed, resolved Core subject 1, athlete 12 |
| Display | Canonical representative load/reps/effort, date and recorded count; exact History link |

Real self subject: athlete 4, existing Session 1714, item 17925; 26 exact Squat sets. Latest persisted exposure before that scheduled Session is Set 20390, September 10, 315 lb × 3 @8, one recorded set. Its Session is in progress, which the existing governed history policy accepts; completion is not invented as a new eligibility requirement. Pre-ID legacy Set 16269 also resolves through the constrained Core policy.

`athlete-12-before.json` and `athlete-4-before.json` preserve the actual summary/full responses, canonical history, independent evidence, legacy provenance and request timings. `real-data-unchanged.json` verifies the original prescriptions and checked historical values remain unchanged after validation.

## Corrected contract and consumer sweep

`ProgrammingLastExposure` and Logger `SessionHistoryPeek` now share `useSessionExposure`, `SessionExposureCache`, `resolveMovementHistoryLaunchForItem` and the canonical history fetcher. The authorized Session payload supplies the athlete. The workspace subject guard still checks that payload before render or mutation. No names, actor-self fallback, squat-family collapse, or prescription fields select the history subject.

Cache keys include signed-in owner, athlete, Session ID/date, exact Core or accessory ID, equipment and applicable comparison policy. Changes to reps, sets, RPE, designation, set type, display units, clock, focus or remount do not invalidate history. Explicit refresh/retry and relevant earlier-evidence mutations revalidate. Known evidence stays visible during revalidation/offline failure; logout and authorization denial clear it. A changed movement/date/athlete uses a distinct entry immediately. The current Session and same-or-later Session dates remain excluded by the existing before-Session-date policy.

Loading, unresolved identity, unavailable comparison, request failure, genuine empty and found evidence have separate states. Only a successful exhaustive governed read may claim no prior exposure. Core responses must match both athlete and exact typed subject. Accessory hydration keeps its exact identity and equipment policy. Automation does not loosen comparison eligibility.

Audited adjacent consumers:

- Full Movement History, Coach review, Ledger movement redirects, Accessories and Variants drill-downs already use `movementHistorySheetRoute` with governed IDs and the same canonical fetcher. The fetcher now also rejects an athlete mismatch.
- Backend Movement History analytics, Core Session lookback and recap share `core_movement_history` resolution; Ledger Core classification uses the governed Core identity architecture. Existing exact variants remain independent. Tests cover immutable performed identity winning over programmed identity, explicit retired redirects, unresolved variants failing closed, and recap/web/Logger consistency.
- Accessory defaults, prior/best cues and recent-set displays remain accessory-specific and retain existing exact-identity gates; they do not become Core history resolvers.
- Logger had a separate three-month/six-card fallback. The shared reader removes that false-empty class using the existing all-time exact-movement endpoint. Its complete comparable series resolves older programmed Sessions outside the first six exposure cards. No new backend contract is required.

## Performance and validation

History loads lazily for the expanded movement, not every row. One existing exact-movement request returns at most six exposure cards plus the existing complete comparable series; it does not fetch the Ledger or issue per-set/per-row calls. Requests deduplicate across editor/Logger reuse for the same Session subject; the cache retains at most 32 entries. Complete exact-movement series still scale with that movement's recorded history; this change does not claim a constant-size all-time response. This is necessary to establish a truthful all-time empty state using the existing deployed API.

Measured localhost responses on the real subjects: athlete 12 exact history about 60 ms / 43,734 bytes; athlete 4 about 192 ms / 20 KB on the initial run. Timing is local observational evidence, not a Production performance guarantee. Lightweight Session loading remains in place.

- TypeScript: pass.
- Focused ESLint: no errors; existing large-editor/route warnings remain.
- Accepted mobile contracts: 217/217 pass; existing 49 historical harness quarantines unchanged.
- Release-critical areas: 62/62 pass.
- Focused backend suites: 15 tests pass, including new self → Team athlete A/B → repeated locked-subject reads and unlinked-athlete 403.
- Actual component/hook/network-boundary regression tests replay real modern/legacy DEV evidence. Cover older-than-page/three-month history, typed ID namespace, variants, subject isolation, draft stability, date changes, current Session exclusion, empty/failure/retry, authorization denial, and accessory equipment policy.
- Existing two source-shape checks were updated for the extracted shared component; all their behavioral assertions remain protected.

Native DEV: the original false state and corrected `125 lb × 7 @8.5 RPE`, `Sep 9`, `Representative set · 4 recorded sets` were observed in actual Simulator accessibility state from canonical Metro. Team Coach and locked Athlete Workspace both show athlete 12's value. Switching through the app's Self-Coach control and entering Programming without an athlete parameter shows the own-athlete 4 value, `315 lb × 3 @8 RPE`, September 10, one recorded set. No coached-subject value leaks into it.

The newly enabled Core History link opens actual Competition Squat history (21 exposures / 87 sets). Closing it returns to the same athlete/editor with the value retained. Collapsing and reopening the editor also retains it. Back from the locked workspace editor returns to athlete 12's Programming Manager, Week 3, with the workspace dock and subject intact. Captures include `native-core-history`, `native-history-return`, `native-remount`, `native-workspace-exposure`, `native-workspace-return`, `native-self-mode` and `native-self-exposure`.

Native viewport screenshots show the upper editor and the exact-history destination; the history value itself remains below the captured editor viewport and is proven by native accessibility state, not by pretending it appears in those images. Native wheel/scroll/background injection attempts did not produce an observable value/viewport/background transition; they are recorded as attempts, not passes. Prescription/scroll/focus/background invariance is covered deterministically in the actual component/cache contracts, but further physical gesture verification remains pending. This is a narrow data-resolution repair, not a visual redesign.

## State-machine blast radius

Touched: the Session-scoped history read lifecycle (unresolved/loading/found/empty/error and explicit retry) and Core History link reachability. Adjacent systems: authorized programming subject, Logger read-only history, exact-history sheets, accessory equipment policy and auth cache reset. Validated: self and coached athlete isolation, workspace authoritative-subject contracts, exact Core variants/legacy/performed identity, ordinary prescription/cache stability, authorization denial and accepted programming/navigation behavior. Programming mutation, relationship, billing, onboarding and Session execution state machines are unchanged. No backend application code, schema, native dependencies, production environment or artwork was modified.

TestFlight release proof and PT-first ledger are recorded in backend `docs/validation/testflight-authoring-exposure-2026-09-13` and `docs/development-log/2026-09-13.md` after actual publication. Target: existing 2.1.0 / build 28 OTA channel. NO NEW NATIVE BUILD. PRODUCTION 2.0.2 MUST REMAIN UNCHANGED.
