# Athlete Workspace Performance floating controls — September 10, 2026

DEV only. The governing Identity/Relationship Architecture v2 was read before implementation.

## Cause and correction

Performance derived `unit` directly from the signed-in viewer's `preferred_units`. It did not register `FloatingDisplayUnitRegistration`, and its workspace shell did not host a `FloatingControlCoordinator`. The weight displays already consumed a unit argument, but the coach had no control to change that display lens.

`CoachAthleteWorkspaceShell` separately defined `styles.floatingToolkit`: a 50-point solid `COACH_V2.violet` Pressable with its own border, shadow, icon and press scale. That custom implementation is removed.

The workspace now owns the existing `useSurfaceWeightUnit(user?.preferred_units)` hook. Performance and Brief consume that shared workspace value. Selection survives navigation between workspace destinations and return from Ledger. The hook retains the established display-only contract: it does not patch account settings, athlete preferences, prescribed loads or performed evidence. Performance owns no separate unit hook, storage or conversion arithmetic.

## Canonical components and geometry

- `FloatingControlCoordinator` hosts the controls outside scrolling content.
- `FloatingDisplayUnitRegistration` registers Performance's existing unit/setter in trailing slot 1.
- `FloatingControlStack` places `FloatingUtilityButton` in trailing slot 0. The action remains `Open athlete actions`, with the canonical add icon and restrained selected lens.
- `SLTabRowControlShell` provides the shared glass/near-black fallback material, border, radius and depth. `SL_TAB_ROW_SELECTED_LENS`, `SLCanonicalIcon` and `SLMotionPressable` supply the existing ring, icon and immediate press feedback.
- The unchanged `SLFloatingNavigationDock` and both controls share the `tab-screen` geometry. `floatingControlBottom`, `SL_FLOATING_CONTROL` and safe-area insets govern positions. Performance's bottom content padding now derives from the upper slot plus shell size and gap, replacing fixed 168-point padding.
- The pre-existing Messages composer offset and keyboard suppression are preserved. Performance adds no custom offset, copied button style or new floating-control component.

On the representative 402 × 874-point iPhone, utility touch bounds are unit `[349,680]–[389,720]` and action `[349,736]–[389,776]`. Their 48-point outer shells have an 8-point gap. Dock touch targets begin at y=791; the safe-area bottom is 34 points. The final footer can scroll entirely above the upper control.

## Unit coverage

All weight branches use the same workspace unit and existing Ledger/display helpers:

| Evidence | Verification |
| --- | --- |
| Estimated Total, S/B/D, chart axes and deltas | Native lb/kg switch; Total 1,303 lb ↔ 591 kg; Squat 478.5 lb ↔ 217 kg |
| Literal heaviest, career load, rep best, matched-task comparison | Native expanded Squat; period heaviest 410 lb ↔ 186 kg |
| Plate clubs | Existing unit-specific governed club resolver, checked in expanded strength |
| Performed and weekly volume | Native switch, canonical kg conversion and unchanged counts/percentages |
| Accessory loads | Native Leg Extension 110 lb ↔ 49.9 kg and machine-row load 185 lb ↔ 83.9 kg |
| Core Variant loads | Native independent exact-variant rows; shared prior/current load formatting |
| PR loads | Conversion/consumer contract guard; representative Performance projection displayed the existing empty PR state, so no native populated-PR claim |
| Reported bodyweight and chart | Native 200 lb ↔ 90.7 kg; readiness scores remain dimensionless |

Canonical formatter tests exercise lb → kg → lb for total, estimated strength, literal loads, accessory/variant loads, bodyweight and volume. Existing rounding behavior is preserved; no values are written back.

## Actions, navigation and visual acceptance

The toolkit callbacks and availability conditions are unchanged: New Session, Message Athlete, Add Coach Note, Adjust Program, Edit Next Session when assigned, and Review Next Item when pending. Session actions continue to use `athlete.id`; notes, messages, programming and reviews retain their workspace destinations.

Native validation uses one iPhone 17 / iOS 26.2, athlete 4, from the canonical `npm start` Metro on port 8081. The toolkit displays `Act for Dev Athlete 4`; Message Athlete opens that subject's workspace Messages, and Performance return retains its display unit. Existing Ledger Journey accepts kg/lb switching and returns to the same athlete workspace. No messages were sent and no programming or training data was edited.

The three visual weaknesses were the missing persistent unit control, the saturated standalone action disk, and independently hardcoded action/content clearance. Canonical registration, the shared utility shell and shared slot-derived clearance correct them. Before and subsequent native screenshots were inspected directly. Top, middle and bottom captures preserve the Performance hierarchy and assets; the floating controls have consistent material/spacing and do not collide with each other or the dock. Scrolling brings every chapter and the final footer into the clear reading area above the overlay band.

## Focused regression validation

- Complete native Maestro flow: PASS, including lb/kg round trips, all populated weight chapters, toolkit/Message navigation, Ledger Journey and same-athlete return.
- TypeScript: `npx tsc --noEmit` PASS.
- Scoped ESLint: zero errors, three existing `Array<T>` warnings.
- Five focused suites PASS: `test-workspace-floating-controls`, `test-floating-display-unit-control`, `test-coach-performance-v2`, `test-coach-athlete-workspace-v1`, `test-global-weight-unit-toggle`.
- New permanent guard is automatically discovered by the accepted-contract runner. It enforces workspace unit ownership, canonical control reuse, distinct slots, safe-area-derived scroll clearance, all weight-bearing consumers and retained scoped actions. The prior workspace guard now expects the shared stack instead of direct dock-token placement.
- Two additional historical unit harnesses fail obsolete source-shape assertions in Settings and Movement History. Both were already in `config/accepted-behavior-contract-quarantine.json` under `superseded-source-shape-snapshot`; the tests, targets and quarantine configuration are unchanged. Their numerical conversion assertions pass before the stale assertions. No new quarantine was added.
- Initial Maestro selectors for nested labels were corrected to use accessible button labels; the implementation was not changed to accommodate automation.

Evidence: [native screenshots, flow and validation records](evidence/workspace-floating-controls-2026-09-10/). The dirty-runtime certificate verifies canonical source, matching origin, the existing Metro PID 73477 and app/runtime 2.1.0 while local edits were present.

## State machine and blast radius

**Touched state machine:** workspace display-unit selection → Performance/Brief rendering → navigation away and back. Floating-control registration follows the mounted Performance destination; toolkit open/close retains its existing state.

**Adjacent systems:** workspace dock/composer layout, Ledger return navigation, preferred-unit presentation and athlete-scoped action routing. Shared primitive implementations, backend authorization and mutation payloads are unchanged.

**Validated workflows:** lb/kg round trips, Brief/Performance return, expanded strength, lower chapters, bottom reachability, same-athlete toolkit/Message navigation, and the existing Ledger Journey control/return path. Existing relationship-generation, stale-response, identity-isolation and route contracts pass.

**Regression confidence:** the change composes existing primitives and the existing unit hook, preserves action callbacks and canonical numeric helpers, adds permanent consumer guards, and is supported by actual native interaction/screenshots. Auth, onboarding, billing, entitlements, relationships, release guards and canonical movement identity are unchanged.

**NO TESTFLIGHT. NO PRODUCTION.** DEV source and development ledger only; no release build, OTA, deployment or promotion.
