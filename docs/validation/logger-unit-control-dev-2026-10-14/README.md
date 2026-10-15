# Logger weight-unit control — DEV review

Owner requested a larger, easier-to-find lb/kg toggle in canonical DEV and a
simulator handoff before promotion.

The footer now displays both units. Each option has a 52 × 44-point minimum
target; the selected unit uses a violet fill and white 16-point type. The
existing `switchDisplayUnit` handler still owns conversion. Selecting the
already-active option is a no-op. The movement navigator and Log Set action
retain their existing callbacks.

## Actual simulator evidence

Captured October 14, 2026 from canonical `npm start`, Expo Go, iPhone Air iOS
26.2, using `http://127.0.0.1:5002` DEV backend and fictional Session 2212.

- `01-before.png`: original 40 × 32-point current-unit-only button.
- `02-lb.png`: larger selector, pounds selected.
- `03-kg.png`: tapped kg; saved-Set labels changed to kg.
- `04-review-lb.png`: tapped lb; saved-Set labels returned to lb. Final handoff.

Two visual passes inspected. The baseline's small target, weak visibility and
hidden alternative unit are addressed. Both options remain beside the movement
navigator and above the primary action. The Session remained at 3/6 saved Sets;
these checks did not submit a Set or change the prescription. The visible QA
Sets have zero load, so this observation verifies unit selection and labels;
the existing numeric conversion regression separately verifies nonzero weights
and repeated-toggle stability.

## Checks

- `npx tsc --noEmit`: PASS.
- `node --import tsx scripts/test-logger-canonical-weight.mjs`: PASS (numeric
  conversion, cross-surface agreement and repeated-toggle stability).
- Real simulator lb → kg → lb: PASS.

DEV only. No TestFlight, production, backend deployment or native build.
