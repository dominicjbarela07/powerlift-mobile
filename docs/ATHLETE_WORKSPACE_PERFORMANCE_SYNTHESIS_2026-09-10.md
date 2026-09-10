# Athlete Workspace Performance — compact coaching synthesis

DEV only. Canonical mobile branch `dev/canonical-mobile`. No TestFlight, Production, OTA, release build, deployment or backend product changes.

## Diagnosis and resulting hierarchy

The previous page placed full detail treatments in sequence: estimated Total and S/B/D chart, three large literal-strength rows, execution, volume, many observations, full accessory/variant lists, standing, two recovery charts, every check-in field and repeated record links. Repeated numbered chapter labels and motivational headings added more vertical travel without adding evidence.

Performance now answers trajectory, change and where to investigate:

| Area | Primary page | Deeper evidence |
| --- | --- | --- |
| Trajectory | Atmospheric Total/delta, existing period selector, compact S/B/D chart and latest estimates | Strength and exact lift profiles |
| Strength development | One three-lift composition: governed artwork, heaviest period load, literal load change | Strength |
| Training output | Completion ring beside completed/planned Sessions, working sets and frequency; performed volume and compact weekly bars below | Archive |
| Worth noticing | At most three distinct ranked observations | Existing canonical destinations; remaining observations in a dismissible sheet |
| Supplemental development | Two accessory progress examples; one exact Core Variant example and S/B/D family rotation counts | Accessories, Core Variants, exact movement/variant records |
| Body & Readiness | Latest reported weight/change/trend, 7-day reported readiness mean/trend, two prioritized latest check-in fields | Journey |
| Athlete Record | Compact standing/trophy and available recent PR evidence; Journey/Archive links | Achievements, Journey, Archive |

No additional persistent navigation, pills, dashboard tiles or generated imagery. Existing governed artwork and shared chart/floating-control primitives remain authoritative. Empty sections collapse; links for absent accessory/variant evidence remain available independently.

## Measured scroll reduction

Measured on the same native iPhone 17 / iOS 26.2, athlete 4, 90 days, lb, fully loaded, with disclosure closed. Measurements use the actual React Native scroll content and viewport, not screenshot-count estimates.

| Measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Content height | 5,488.7 pt | 2,842 pt | 48.2% |
| Viewport | 746 pt | 746 pt | — |
| Required scroll travel | 4,742.7 pt | 2,096 pt | **55.8%** |

This is roughly 2.8 viewport heights of travel instead of 6.4. Core text remains readable at 14–16 points; reduction comes from composition, deduplication and preview limits. Evidence: [scroll-depth.json](evidence/performance-synthesis-2026-09-10/scroll-depth.json). Original screenshots remain in [the preceding canonical runtime evidence](evidence/workspace-floating-controls-2026-09-10/top-lb.png).

## Deterministic observation policy

`lib/coach-performance-summary.ts` is a pure projection of canonical evidence, not a new progression detector or PR system.

- Competition observations require a supported canonical comparable-task result. Estimated S/B/D changes are not emitted again.
- Accessory evidence must resolve a governed movement, retain its exact equipment comparison, and fall within the selected period. Ranking rewards load change (80 plus a capped relative magnitude bonus), reps (75 plus capped reps bonus), then effort reserve (70 plus capped bonus). Less assistance is treated as improvement by the canonical load direction.
- Core Variants require a stable Core movement ID, governed Squat/Bench/Deadlift parent and canonical exact-variant progression. Their scores follow the same load/reps/effort order; no inferred parent-lift carryover.
- Supported competition comparisons score 85; completion below 85% with at least three planned Sessions scores 90; material recent readiness change scores 95; volume changes of at least 10% contextualized by working-set counts score 68.
- Recency adds at most seven points over the latest 14 days. Ties resolve by event date then stable evidence ID. Input array order and display units do not affect rankings.
- Main observations admit at most one item per category and cap at three. Movements already selected for supplemental previews are excluded from observations. The sheet exposes the remaining supported comparisons without lengthening the primary page.
- PRs and standing have one home in Athlete Record. PR labels distinguish estimated 1RM, rep-max and literal weight; a bounded recent event sample does not claim to be full PR history.
- Readiness uses reported days only, deduplicated by date. Comparison requires at least two reported days in each seven-day window. Missing days are not zero. Latest check-in fields are limited to two actual values, prioritizing short sleep, low energy, high stress/soreness and low sleep quality. Stale/out-of-range and invalid samples are excluded.

Accessory previews retain the canonical block context label. Their full record's period and equipment policy remain owned by Accessories. The selected Performance period bounds which progress examples are eligible.

## Redundancy and permanent copy rule

Removed `THE LONG GAME`, `Earned, not given`, repeated numbered `THE ATHLETE RECORD` labels, full inline accessory/variant lists, the second readiness chart and the full latest check-in field dump. Estimated strength, literal load, output, supplemental progression and recovery each have a distinct role. Standing links directly to Achievements without repeating an adjacent Achievements link.

Audited all active Athlete Workspace components. Brief now uses `Coaching brief`, `Conversation`, `No active training program`, `No actions need attention` and `No upcoming decisions`; Messages uses `ATHLETE CONVERSATION`. Removed `IN THEIR CORNER`, `Between you two`, `The next decision starts here` and `next training chapter` language. Canonical product names such as Journey and Athlete Record remain.

**Permanent rule:** concise, calm, factual coaching language. Explain evidence and actions; do not prescribe emotion or introduce motivational slogans. The automatically discovered synthesis test guards the prohibited phrases across every active workspace component.

## Visual convergence

Compared native first-pass screenshots against the original runtime and requested hierarchy. Corrected the three weakest visual areas before the second pass:

1. Over-compressed chart frames collided with axis labels. Both local chart frames now respect the shared chart's plot and label budget at 168 points. Shared chart geometry was not changed.
2. The wide display numeral extended outside the execution ring. The ring now uses a readable body numeral, while primary totals retain the established numeric display face.
3. Repeated dividers and verbose observation qualifiers weakened compact grouping. Disclosure links now have a quiet 44-point treatment, movement comparisons use direct names, and adjacent Achievements links are deduplicated. Effort-only comparisons explicitly show RIR/RPE rather than identical load/reps alone.

The partial-athlete pass then exposed horizontal date-label contact. The canonical chart now passes its actual axis font size to the existing X-layout helper, which measures start/end-anchored labels correctly instead of treating endpoints as centered. Regression checks cover label spacing at 9/11/16-point fonts and 280/320/370/402-point widths without removing any observations or changing their coordinates. Both chart fidelity and accessory axis-mode suites pass; the complete accepted suite was repeated after this shared change.

Second-pass native screenshots confirm separate chart labels, contained ring text, readable comparisons, governed movement art and consistent shared floating utilities. The final footer can scroll above the upper utility; the dock and utility slots retain their canonical safe-area clearance.

## Subject ownership and blast radius

**Touched state machine:** backend-verified Athlete Workspace subject → period-scoped Performance projection → bounded display summaries/disclosure → canonical Ledger navigation → return with workspace period/unit/scroll state.

The existing workspace subject key and request cancellation remain authoritative. Supplemental requests begin after the primary projection resolves, including short pages that cannot reach an arbitrary scroll threshold. Effect cleanup rejects late prior-scope responses; payload athlete IDs must match both in the loader and the pure summary. All deep links use `workspaceLedgerParams(athleteId)`; exact movement and variant links use governed IDs. No display name infers identity.

**Adjacent systems:** Brief's shared Strength hero, floating display units, scoped Ledger return routing, Training/toolkit actions, movement/equipment evidence presentation, and existing analytical-chart consumers. The shared chart correction only affects axis label selection; numeric scaling, data points, source identity and scrubbing remain unchanged. No auth, onboarding, billing, entitlement, relationship, programming mutation, movement identity or release-guard behavior was changed.

**Regression confidence:** executable stale-subject/identity checks, bounded deterministic projection tests, existing global/Individual programming subject contracts, native athlete transitions and canonical drill-down return checks. Backend authorization and underlying evidence systems remain intact. Native checks open tools and evidence without saving training data or sending messages.

## Validation and delivery evidence

- TypeScript: PASS.
- Focused ESLint for Performance, shared visuals and new summary helper: zero errors/warnings.
- New summary tests: PASS (ranking/order, diversity, caps, preview deduplication, governed identity, stale athlete payloads, dates, sparse/empty states, assistance, effort, units, PR semantics, recovery sampling and copy).
- Existing Performance, Workspace relationship/entry/return, floating control and Programming subject contracts: PASS; Programming subject suite 8/8.
- Accepted mobile contracts: **191/191 PASS**, including automatically discovered new tests. Existing quarantine unchanged.
- Canonical dirty-runtime certificate: PASS, Metro PID 73477 / port 8081 / app/runtime 2.1.0.

Native checks used one iPhone 17 / iOS 26.2 from the canonical `npm start` runtime:

| Representative state / workflow | Result |
| --- | --- |
| Athlete 4, rich S/B/D, accessory/variant and recovery history | PASS; Total 1,303 lb, compact literal load evidence, 1,207 sets, bounded previews and final 2,842-point content height |
| Athlete 12, accessory-heavy partial strength | PASS; one established lift, compact missing Bench/Deadlift, 808 sets, no empty bodyweight chart, readiness 2.4/5 over four reported days and -0.8 versus prior week |
| Athlete 58, Meet Packet QA, empty training history | PASS; 653.3-point content fits inside the 746-point viewport; no empty output/observation/recovery chapters; all six record destinations reachable |
| All six canonical destinations | PASS; Strength (including lift detail), Accessories, Core Variants, Achievements, Journey and Archive open and return to the same athlete's Performance |
| Disclosure and controls | PASS; observations open/dismiss; lb → kg → lb; toolkit opens for the workspace athlete; Message Athlete opens the same subject without sending anything |
| State preservation | PASS; kg retained across Ledger returns, Brief/Performance and Messages/Performance; scroll returns to the previous chapter; 30-day selection retained after native refresh and Brief/Performance return |
| Subject transition | PASS; 4 → 12 → 58 → 4 shows the correct header and subject evidence; stale supplemental payloads are also rejected by executable tests |

Inspected [rich trajectory](evidence/performance-synthesis-2026-09-10/rich-top-lb.png), [output/observations](evidence/performance-synthesis-2026-09-10/rich-output-lb.png), [supplemental evidence](evidence/performance-synthesis-2026-09-10/supplemental-kg.png), [partial strength](evidence/performance-synthesis-2026-09-10/partial-top-kg.png), [partial recovery](evidence/performance-synthesis-2026-09-10/partial-recovery-kg.png) and [empty state](evidence/performance-synthesis-2026-09-10/empty-performance.png).

Automation corrections are recorded honestly: the first screenshot command used a disallowed absolute output path; the first lift-detail assertion expected the overview's back label; automatic scroll centering overshot an Accessories target; one sparse-state swipe passed its intended text; the empty fixture is named Meet Packet QA, not Dev Athlete 58. Corrected selectors and explicit native scroll positions completed those checks. No app behavior was altered to satisfy selectors. Original navigation failure logs are retained alongside the completed focused flows. Measurement/scroll setup used the existing React Native public ScrollView methods through Hermes DevTools; no diagnostics ship in the app.

Delivery hashes and the final matching-origin runtime certificate are recorded in the PT-first [daily DEV ledger](../../docs/development-log/2026-09-10.md). No unresolved product failure remains in the focused scope. **NO TESTFLIGHT. NO PRODUCTION.**
