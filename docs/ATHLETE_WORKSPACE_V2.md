# Athlete Workspace V2 — DEV implementation and evidence

September 9, 2026. Canonical mobile DEV and backend DEV only.

## 1. Design thesis

A living coaching record: an atmospheric strength opening, a continuous evidence narrative, and a persistent athlete identity. The storyboard informed trajectory, output, supplemental development, achievements, and recovery. The implementation brings those chapters into one scroll with progressive strength disclosure, rather than eight separate screens. OLED black, violet identity, cyan evidence, magenta secondary series, green recorded progress, and gold achievement give different evidence distinct weight. Exo 2 and Michroma preserve Strength Ledger's typography.

## 2. Workspace architecture

`CoachAthleteWorkspaceContext` owns the verified server subject, bootstrap, operational summary, Training selection, Reviews continuation, message draft, Performance period/data, and scroll. `CoachAthleteWorkspaceShell` renders the existing `SLFloatingNavigationDock` with Brief · Training · Performance · Reviews · Messages. The athlete header and explicit Coach exit remain visible. Global navigation is suppressed in the workspace, scoped Ledger rooms, and workspace-linked Session/video/Check-In reviews. The separate floating toolkit exposes New Session, Message Athlete, Add Coach Note, Adjust Program, and conditional Edit Next Session / Review Next Item. It clears the Messages composer and hides with the keyboard.

## 3. Performance information architecture

- Opening: program context, 30/90/180 days, estimated Total or available-lift baseline, weekly S/B/D trajectories, current lift values, and recent PR signal.
- Beyond the estimate: recorded load, rep bests, comparable tasks, career heaviest/e1RM peak, and earned plate clubs, expanded per lift.
- The work behind it: completion, missed/incomplete Sessions, actual working sets, weekly frequency, actual external-load volume, and equal-length prior-period comparison.
- Worth noticing: deterministic changes with their evidence period. No causal or prescriptive conclusions.
- Supplemental development: exact accessory improvements, equipment context, Core Variants organized by parent Squat / Bench Press / Deadlift, and individual evidence routes.
- Earned, not given: canonical PRs, trophy imagery, and readable governed competitive standing.
- The person behind the work: actual reported bodyweight, daily-average readiness, and latest reported sleep, soreness, stress, and energy.
- Canonical Journey and Archive continue the record.

## 4. Data streams used

| Evidence | Canonical source and policy |
|---|---|
| Identity / relationship / program / Check-Ins | Existing workspace bootstrap and operational summary; server subject is authoritative |
| Competition strength | `get_performance_history`, governed competition lift resolver, and `build_strength_progression_lenses` |
| Career records / standards / plate clubs | Existing current-bests projection and Ledger reward/standing resolvers |
| PRs | Existing accomplishments endpoint; canonical PR event filtering |
| Execution | Existing progression consistency projection |
| Working sets / volume / frequency | Actual SetLogs joined to the athlete's Workouts; no prescribed-reps substitution |
| Accessories | Existing Ledger exploration projection, immutable identity, matched equipment/task evidence |
| Variants | Existing Core Variants projection and governed Core IDs; independent variant histories |
| Bodyweight | `reported_bodyweight_history`, actual dated reports |
| Readiness | Existing ReadinessSurvey values and canonical `readiness_number` |
| Reviews | Existing athlete-specific Session/video/Check-In queues and continuation |
| Messages | Existing authorized relationship thread, canonical ThreadScreen |

## 5. Projection changes

`GET /athletes/mobile/progression?athlete_id=…&range=90d&view=coach-workspace` adds an explicitly authorized coaching view. It accepts only 30d / 90d / 180d, returns `projection_version: coach-performance-v2`, the full workspace subject, and `coaching_context`. The new service composes existing evidence without adding persistence or another source of truth. Career-relative lens fields are removed from the bounded view; career peaks come from current-bests and deeper history remains in canonical Strength. Prior coach block narrative is omitted from this projection.

Work volume uses the existing Archive external-load policy: actual load × actual reps; warmups, contradictory athlete snapshots, assistance load, and bodyweight-only volume do not inflate it. Zero-work weeks remain on the chart. Frequency is Sessions with recorded working sets per seven days. Previous-period comparisons use exactly the same number of days. Readiness scores on the same date are averaged into one chart point. Bodyweight uses up to 50 recent dated observations within the selected range and the latest observation per day in the chart.

## 6. Assets reused

`STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength`; `LEDGER_INDEX_ASSETS.coreLift`, `careerPr`, `chapter.achievements`, `chapter.journey`, and `record`; exact governed movement/variant art through `CanonicalMovementArtwork`. Trophy, program, and equipment art use their existing semantic destinations. Curated accessory rows require an available canonical artwork source; legacy unmapped taxonomy is retained in canonical Accessories, not represented with a question-mark tile here. No aggregate anatomy geometry or consumer was changed.

## 7. Assets generated

None. The governed raster library supplied the required atmosphere, equipment, movement, program, and trophy imagery. Functional glyphs and the execution chart use existing UI primitives; no generated hero icons, human photography, or substitute anatomy masters were introduced.

## 8. Brief redesign

A compact strength snapshot and execution/readiness strip lead into Needs Your Action. The first three actions are visible initially; Show all exposes every remaining action. Program context, upcoming decisions, and relationship communication follow with a flatter hierarchy. Open Performance continues into the full record without duplicating it in Brief.

## 9. Performance implementation

`CoachAthletePerformance.tsx` and shared `PerformanceVisuals.tsx` compose the chapters. Time-series charts have readable real axes, real dates, inspectable points, and distinct lift colors. Weekly volume bars expose dated set/load evidence on tap. A Total requires all three competition lifts; its change requires repeat weekly evidence for all three. Sparse records lead with an established lift; empty records explain the baseline. No missing lift is silently treated as zero strength.

## 10. Training integration

Training opens the existing Programming Manager directly in the workspace shell. The manager's scope includes the verified workspace subject. Its outer native scroll owner restores after the loaded layout mounts, before subsequent user scrolling is saved. Program/block/week/day and scroll selection are preserved across destination changes. Athlete selection inside embedded Programming Manager enters the newly selected athlete's Training workspace. Session editing and New Session use the existing canonical routes and selected athlete/date.

## 11. Reviews and Messages convergence

Reviews retains To Review, Follow-up, History, existing source routes, and queue continuation. Underline navigation, readable evidence rows, and athlete-specific framing replace the prior pill-heavy presentation. Messages embeds the canonical relationship thread under the workspace header, using the verified thread, subject, athlete, and draft. No messaging authorization or send semantics were rebuilt. Runtime validation did not send a message or submit a review.

## 12. Canonical Ledger drill-down

Journey, Strength, Achievements, Accessories, Variants, Archive, and exact movement routes receive the selected athlete IDs plus an allowlisted workspace return destination. Conflicting IDs fail closed. Scoped rooms suppress competing global navigation. Workspace returns navigate to the existing workspace instance; standalone Ledger returns retain their existing behavior. Strength entry can select the exact S/B/D lift.

## 13. Loading and performance

The first projection loads after bootstrap verifies the subject, in parallel with the operational summary. It queries the selected strength window rather than eagerly hydrating career history. Performance's initial record requests are bounded accomplishments (12) and current bests. Supplemental exploration and variant evidence load after scrolling toward deeper chapters. Data lives in the verified workspace provider; no persisted cross-athlete cache is introduced. Request keys include full server subject, athlete, period, and refresh revision. Abort/sequence guards reject obsolete responses; mismatching result keys are never rendered. Pull-to-refresh and app-resume refresh are supported. Server responses use private/no-store.

Local DEV HTTP samples for the 90-day projection: athlete 4, approximately 0.22 seconds / 36.7 KB; athlete 12, approximately 0.09 seconds / 25.9 KB. These are representative localhost samples, not production latency claims.

## 14. Authorization, state isolation, and affected state machines

**State machine touched:** verified coach → active athlete relationship → focused workspace destination → athlete-scoped evidence → return. Its local state includes period, loading/result/error, Training selection/scroll, Reviews continuation, and relationship message draft. The server retains ownership of account capabilities, identity, and relationship truth.

**Adjacent systems:** auth/account switching, entitlement gates, coaching relationship revocation, canonical Programming Manager and Session routes, Ledger subjects, queue continuation, messaging threads/drafts, and performed evidence interpretation. Onboarding and billing implementation were not changed.

**Confidence:** the new endpoint checks the existing active relationship before reading evidence; server subject and athlete must match before rendering; namespace changes clear workspace-local state; requests are bounded and superseded responses are discarded. Regression coverage combines endpoint tests, accepted mobile contracts, actual iPhone runtime navigation, and visual inspection. This is DEV acceptance, not a claim of exhaustive production coverage.

## 15. Focused visual findings

Actual iPhone 17 / iOS 26.2 Expo Go screenshots came from canonical `npm start`, port 8081. Runtime certificates verified the canonical root, clean DEV branch, local/remote source equality, running Metro process, and Expo manifest before accepting evidence. The first pass was compared directly with the supplied storyboard's density and hierarchy.

The three weakest first-pass areas were crowded S/B/D numeric values, an over-tall opening hero, and a sparse record dominated by an unavailable Total. Corrections reduced number sizes, removed repeated inline units, shortened the chart/hero, replaced a hard-edged square hero asset with the canonical atmospheric treatment, and led sparse records with the available lift. The inspected second pass confirmed readable values and stronger first-viewport hierarchy.

Further live inspection corrected duplicate-date readiness points, the toolkit/composer collision, raw equipment enum display, and Training restoration at the actual outer native scroll owner. These fixes were validated in DEV. Screenshot evidence is linked below; DEV fixture values are genuine local records, not storyboard samples.

## 16. Automated validation

- TypeScript: PASS (`npx tsc --noEmit`).
- Full Expo lint: PASS, 0 errors; warning count is 254.
- Automatically discovered accepted mobile behavior: PASS, 188/188 contracts.
- Release-critical invariants: PASS, 55/55 protected product areas.
- Focused backend workspace, entitlement, and reported-bodyweight coverage: PASS, 23 tests.
- Canonical strength progression lenses: PASS, 3 pytest tests.
- New projection tests cover bounded history arguments, no fabricated career lenses, empty/null totals, private/no-store, invalid subject/range, missing auth, relationship revocation, actual reps, assistance, warmups, contradictory athlete identity, actual bodyweight, and duplicate-date readiness.

A broader 51-test backend history run had one pre-existing failure: `PerformanceHistoryServiceTest.test_accessory_movement_history_includes_imported_historical_rows` receives a missing row and raises `TypeError`. The same isolated test fails when the original `athletes.py` source is restored in memory for the test process. It was not hidden or reclassified as a pass. The default history endpoint was not changed by this work.

## 17. DEV commits and remote push

Backend `origin/dev/canonical-backend`:

- `fe26a5c5` — bounded canonical coaching Performance projection and contracts.
- `8de439ac` — aggregate same-day readiness observations.

Mobile `origin/dev/canonical-mobile`:

- `7154d71` — focused workspace and Performance destination.
- `fe70b96` — refined hierarchy and scoped evidence returns.
- `087ff90` — accessible toolkit/composer, expanded Brief actions, resumed Performance refresh.
- `5f61861` / `8a2c81f` — restore Training at the native scroll owner after loaded layout, and refine evidence labels.
- `a0bc0c8` — suppress competing global navigation in workspace-linked review routes.
- `c67a02c` — show chart guidance only when evidence exists.

Documentation/evidence is committed separately. No TestFlight OTA, native build, release-branch promotion, or Production operation was performed in this task. Unrelated backend changes and pre-existing mobile artifacts were preserved.

## 18. Development ledger

The canonical backend `docs/development-log/2026-09-09.md` records this work at **8:35 PM PT (11:35 PM ET)**, implementation scope, validation, DEV commit references, and explicit DEV-only release status.

## Runtime workflows validated

- Five dock destinations on athlete 4: Brief, direct Programming Manager, Performance, Reviews, and the actual authorized Messages thread.
- Performance → canonical Archive → the same athlete and Performance scroll section.
- Training Week 2 → Brief → Training: Week 2, Monday August 3 target, program/block context, and visible scroll position retained.
- Reviews → exact Session review → same athlete Reviews queue; final scoped reviewer has no competing global dock.
- Athlete 4 → athlete 12: identity and performance changed together; prior athlete/Total absent. Athlete 12 then switched to 30 days with the correct August 11–September 9 window.
- Athlete 12 → empty athlete 58: no inherited Total, explicit zero-lift baseline, clear Reviews queue, empty relationship conversation, and successful Coach Home exit.
- Long scroll through workload, observations, exact supplemental evidence, achievements, and bodyweight/readiness; representative values and text inspected.
- Loading/error rendering and request invalidation checked through bounded projection contracts and actual entry/range loading. Authorization revocation tested in the backend fixture rather than mutating a live relationship.

No review submission, programming mutation, or outbound message was needed for these runtime checks. Video/Check-In continuation, exact movement identity, entitlement, and account-state adjacency were covered by focused and accepted contracts; they were not each manually replayed on the simulator.

## Representative screenshots

| Surface | Inspected evidence |
|---|---|
| Performance, established S/B/D | [Opening trajectory](evidence/athlete-workspace-v2/performance.png) |
| Brief | [Compact snapshot and actions](evidence/athlete-workspace-v2/brief.png) |
| Training output | [Execution and real workload](evidence/athlete-workspace-v2/output.png) |
| Achievements | [Readable standing and canonical trophy](evidence/athlete-workspace-v2/achievements.png) |
| Recovery | [Reported bodyweight and readiness](evidence/athlete-workspace-v2/recovery.png) |
| Messages | [Composer clear of floating controls](evidence/athlete-workspace-v2/messages.png) |
| Sparse record | [One established competition lift](evidence/athlete-workspace-v2/sparse.png) |
| Empty record | [Explicit baseline without fabricated values](evidence/athlete-workspace-v2/empty.png) |
| Training return | [Week 2 and scroll restored](evidence/athlete-workspace-v2/training-return.png) |
| Scoped review | [Canonical reviewer without global navigation](evidence/athlete-workspace-v2/scoped-review.png) |

[Second-pass lineage](evidence/athlete-workspace-v2/pass2-lineage.json) and [final-source lineage](evidence/athlete-workspace-v2/final-lineage.json). Earlier screenshots show the accepted composition before subsequent narrowly scoped return/copy fixes; the final empty-state and scoped-review screenshots verify those changed states. Detailed local test/automation logs remain in `/tmp/strength-ledger-workspace-v2/`.
