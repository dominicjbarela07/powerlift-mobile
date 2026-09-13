# App-wide bottom-sheet gesture ownership

2026-09-13, 1:32 PM PT (4:32 PM Eastern). Canonical DEV implementation; TestFlight publication receipts are recorded in the backend release validation directory after delivery.

## Cause and change

`StrengthLedgerBottomSheet` previously installed simultaneous dismiss/native recognizers around the entire sheet, with body dismissal gated by a tracked scroll offset. Plain lists did not reliably register that offset. An upward body gesture could reverse at the top and become dismissal. `StrengthLedgerSheetModalAdapter` installed a pan around its entire modal root. Velocity alone could dismiss either after a tiny pull, and cancellation could consult cached motion.

Now the shared gesture exists only on explicit top chrome. There is no dismiss recognizer above the body, no scroll-offset ownership transfer, no simultaneous body recognizer and no touch-up cancellation close. Body ScrollView, FlatList, SectionList, search/input, wheels and nested controls own their full touch sequences. The compatibility ScrollView export passes original props/ref unchanged.

The canonical grabber band is 44 points high; legacy immediate title/handle regions are at least 44 points. Downward activation requires more than 12 points. Release closes after 96 points, or after at least 48 points at 0.85 points/ms (850 points/s). A 10–20 point flick cannot close. Upward/horizontal starts fail; cancellation and insufficient releases settle open, including reduced motion. Explicit X/backdrop/system close and owner dirty/busy decisions retain authority. Keyboard cleanup remains part of deliberate close. A refused legacy close always restores the live sheet on-screen.

## Consumer audit and regression guard

- 34 canonical shared-sheet call sites inherit the fix.
- 46 legacy sheets across 23 files now opt into `StrengthLedgerSheetDragRegion`; their content is outside that recognizer. [Migration inventory](legacy-sheet-migration.json).
- Three embedded video panels (Download Video, Coach Feedback, Review Tools) use `StrengthLedgerSheetGestureSurface` plus the same top chrome. Player, trim controls and Tools popover stay outside.
- Training Hub Session Preview retains its existing top-only PanResponder, with shared displacement/velocity policy and a 44-point region.
- The permanent inventory classifies 71 native-modal presentations, including 24 excluded full-screen/native page-sheet/centered dialogs and one top-only preview. Self-coached Swap search and Logger's native Session actions alert remain unchanged. Existing legacy full-height History retains its adapter but loses arbitrary body dismissal.
- `test-bottom-sheet-consumer-convergence.mjs` rejects unclassified modals and scroll/input/wheel content inside top chrome. `test-bottom-sheet-gestures.mjs` executes actual shared TSX against native-host/gesture mocks, testing body ancestry, scroll callbacks, long-list offsets/reversal/bounce, deliberate/short/cancelled pulls, unit conversion, explicit/guarded close and reduced motion. These are executable component tests, not physical-device tests.
- [Source fidelity](source-fidelity.json): entire emitted JS for all 23 consumers is identical to baseline after removing only imports, the explicit top wrapper, and Modal adapter renaming. This verifies original content, styles, callbacks and mutation scope unchanged. Reproduce from mobile root with `node docs/validation/sheet-gesture-2026-09-13/verify-source-fidelity.cjs`.

## Validation and physical limitations

216/216 accepted contracts, 61/61 critical areas, TypeScript PASS, zero lint errors. Two new import warnings corrected; remaining 242 warnings originate in existing consumers. Whitespace check clean. No dependency, native project, environment, backend/API or schema change.

Canonical DEV Metro at port 8081 served iPhone 17 / iOS 26.2 in Expo Go. Native observations:

| Representative | Observed native result | Gesture/input coverage |
| --- | --- | --- |
| Equipment manufacturers | Machine Shoulder Press identity retained; long list renders; explicit X returns to original Session | Shared legacy component tests; physical scrolling/pull unverified |
| Rest timer | Real ACTIVE disposable Session opens Rest picker; wheel/Start/Skip/X present; X closes | Actual canonical component tests incl wheel body; physical wheel/pull unverified |
| Movement Swap/search | Full-screen self-coached search, exact subject and browse controls render; X returns | Excluded unchanged native Modal; no dismiss pan added |
| Coach review tools | Three embedded panels and recap tools audited with original close/draft handlers | Structural/component and existing Coach review contracts; fresh Coach-mode native pass unavailable |
| Session actions | Session Workspace sheet opens with Rename, date, units, Delete and X; explicit X closes | Canonical component tests; Logger native alert deliberately unchanged |
| Session Workspace editing | Exact Curl editor opens Rep Target sheet with original 6–8 values, ranges/wheels/Apply; X returns to Saved state without applying | Canonical component tests; wheel injection did not establish a physical pass |
| Athlete Workspace context/actions | Existing authoritative workspace handlers and two canonical sheets unchanged | Consumer and workspace/navigation contracts; fresh native Coach-mode pass unavailable |
| Long timezone picker | 36-zone list renders; setting search to Sydney filters to one row; keyboard shown; X closes without changing New York | Search/keyboard/explicit close verified; physical long-scroll/reversal unverified |

Simulator AX clicks, search value input and software-keyboard controls worked. Pointer drags/scrolls did not reliably produce movement; some acted as a tap and others made no change. Native wheel adjustment similarly did not establish a value change. The mode selector was visible but unavailable to AX/coordinate input, preventing the final Coach views. These are incomplete physical checks, **not** claimed passes and **not** proof of a product gesture defect. The release follows the existing source-parity rule permitting compatible publication with explicitly pending physical verification when deterministic/release checks pass and no runtime defect is established.

Screenshots include Equipment, Rest, Swap, Session actions/editor, long picker and keyboard. `equipment-body-down.png` records an attempted injection, not a successful scroll. No visual redesign was requested; only top-band hit area and a centered default grabber changed.

Disposable DEV Session 1751 was created and begun solely for inspection, never logged, saved or completed, then removed. [Cleanup](qa-cleanup.json) confirms all 17,932 original SetLogs unchanged. Original Session 1711 was never begun or edited. No Coach review or timezone changes saved.

## State machine and blast radius

Touched state: sheet hidden/open → top dragging → settle/open or governed close; body scroll state stays independent. Adjacent systems: keyboard focus, rest handoffs, draft/busy guards, Session editing/navigation, Equipment/Swap, Coach review drafts and Settings. The existing accepted/critical contracts cover these consumers; unchanged emitted consumer code proves subject and mutation handlers were preserved. No auth, onboarding, billing, entitlement, identity, relationship, performed evidence or routing-authority implementation changes. Native views confirm bounded rendering/explicit-close/search behavior; physical gesture confidence remains limited as described above.

TestFlight must be a direct projection of pushed canonical DEV, runtime 2.1.0/native build 28, revision 17. Only the existing app/eas release configuration and three declared DEV mock route exclusions may differ. All 195 human-approved movement images and prior compatible mobile work remain included. **No new native build. No Production deployment.**
