# Logger weight-unit control — corrected DEV review

## Current owner-directed candidate

The owner rejected the segmented redesign: “I didn't say ... change it. I said
make it ... bigger. ... It used to be a floating button.” The owner then asked
for the restored 60-point preview to be “slightly smaller”.

The current candidate restores the single canonical circular floating button.
Its shell is 56 points (standard utility remains 48); the label is 18 points
(standard remains 15). One tap toggles units with the unchanged logger handler.
The control sits above the measured footer, including its active-rest height;
scroll content retains clearance so underlying rows remain reachable. Other
floating utilities retain their default size and material. The segmented
selector is removed.

- `05-floating-56-lb.png`: final 56-point floating button in pounds.
- `06-floating-56-kg.png`: one tap switches the button and saved-Set labels to kg.
- `07-floating-56-review.png`: second tap returns to lb, final simulator handoff.

Actual DEV simulator checks passed with 3/6 Sets unchanged. No Set submitted.
Final TypeScript and existing floating-display-unit contracts passed. Existing
numeric conversion evidence below remains applicable: conversion code and the
logger handler did not change. DEV only, awaiting owner signoff.

## Rejected first attempt — retained history

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
- `04-review-lb.png`: tapped lb; saved-Set labels returned to lb. Rejected design.

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
