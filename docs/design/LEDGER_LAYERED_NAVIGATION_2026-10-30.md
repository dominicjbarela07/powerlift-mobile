# Ledger layered navigation — approved implementation

Owner: “fucking impliment it”, approving the immediately preceding researched
recommendation: a slim visible Records / History / Milestones switch, smaller
section-specific controls, connected details with clear Back/Close and retained
filters/position, subtle depth and consistent transitions.

The nine-item global chooser was rejected. Replace it in canonical DEV while
preserving all three Records groups, all five History collections, original
record/source identity, unit inheritance, role/subject/access rules, approved
movement artwork, populated DEV evidence and app-wide navigation. No backend,
database, image replacement or Production/TestFlight/native build operation.

The prior no-visible-tabs assertion reflected an owner-rejected iteration. The
new protection must require exactly one visible primary chapter control and
properly scoped contextual filters, reject a global nine-item menu and reject
stacked primary/secondary navigation rails. Keep all functional coverage.

Research applied: [Hevy exercise performance](https://www.hevyapp.com/features/exercise-performance/)
and [Strong exercise details](https://help.strongapp.io/article/237-about-exercise-detail)
retain local exercise context; [Linear mobile navigation](https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile)
keeps frequent destinations available and secondary actions contextual. The prior
research pass inspected their published screenshots and documented flows, not
installed native versions. This implementation adapts that hierarchy to the
existing Strength Ledger owners rather than copying another app's exact layout.

Acceptance: primary chapters switch in one tap and stay visible while scrolling;
local filters cannot jump chapters; chapter switches preserve open record detail,
filters and view positions; original detail back/close stays attached; search/date
controls stay reachable and source-driven film searches remain usable; reduced
motion remains governed. Inspect actual authenticated DEV athlete Records and
History, identify three weak areas, correct them and inspect a second pass.

Validation scope: TypeScript, actual navigation/controller/filter/search tests,
existing connected Ledger/history/source/chart/art/subject tests, horizontal
layout and native two-pass convergence. Reuse unchanged backend/data/media and
approved-image evidence. Stop after DEV push, exact runtime verification and
leaving the requested experience open.

Owner correction during implementation: “it should be a simple dropdown that
opens near where the initial touch was.” Local Records/History choices must
use the shared measured, safe-area-aware anchored dropdown, never a bottom
sheet. Primary chapter taps switch directly without opening a menu. Keep
outside-tap/back dismissal, selected-state semantics and keyboard-safe anchoring.

## Implemented result and convergence

Removed the global nine-destination sheet, its delayed sheet-dismiss navigation,
and the extra title/breadcrumb block. Added one persistent three-chapter segmented
control, scoped measured dropdowns (three Records choices / five History choices),
and a compact History toolbar with search/date actions. Search expands on demand;
source-driven film queries still open with their original date bounds. Chapter
switches retain connected record detail, filters and independent scroll offsets.
Back from a Core record explicitly says Core lifts. Canonical entrance/press
motion is reused and does not remount the retained chapter contents.

Three weakest areas addressed: hidden primary destinations in the rejected global
chooser; a local filter unexpectedly opening at the bottom of the screen; and
always-visible search/form chrome crowding the archive. The first native pass
also showed the popup material was too prominent. The second pass uses the
existing darker panel token with a lighter selected row, a violet checkmark and
clear trigger alignment. No approved image pixels or image geometry changed.

Actual authenticated athlete DEV observation, iPhone Air / iOS26.2, canonical
Metro8081 + local DEV5017, user78/athlete68:

- Primary Records/History taps changed views directly, without a navigation modal.
- Core lifts and History choices appeared directly below their measured triggers;
  outside tap closed without changing the selection.
- Personal bests, Film and Meets opened with existing populated evidence. Film
  search Bench narrowed three saved demo clips to the Bench clip; Cancel closed
  search and restored all three.
- Records Squat detail → History (retained Meets) → Records resumed the same Squat
  detail; the Core lifts Back action returned to the original Records surface.
- All three approved Core movement subjects remained visible in the final layout.
- The final Records and History dropdown captures were inspected; no bottom sheet
  is used for navigation. The requested DEV athlete Ledger remains open.

Native captures and machine logs are retained in
`/Users/dominic/.codex/work/ledger-layered-nav-20261030/`:
`pass1-records-menu.png`, `pass2-records.png`, `pass2-records-menu.png`,
`pass2-history-menu.png`. These are actual simulator captures, not concept art.
The simulator used the connected hardware keyboard; software-keyboard timing and
rotation/edge collision cases are executed component/layout tests, not claimed
as observed Android/device certification.

## Validation and state boundary

PASS: TypeScript; connected Ledger suite (history races, dedupe, subject isolation,
retry, canonical source/detail, units, chart fidelity and approved movement art);
actual primary/filter/shared-dropdown/controller tests; actual archive search and
source-focus handlers; Coach Calendar shared-dropdown regression; horizontal
layout audit. Final targeted logs are `navigation-final.log` and
`archive-search-final.log`; the unchanged connected checks are in
`ledger-suite.log`. The navigation protection deliberately rejects a bottom-placed
menu, a navigation sheet, an extra tab rail, missing navigation and foreign
chapter choices. Actual controller tests execute per-view scroll restoration,
not only restoration-key string assertions.

The whole-app UI constitution audit retains the same five pre-existing findings:
Home font count/value drift, SignupWelcome literals, Logger follow-through
literals and login literals. This task introduces no new finding; no exceptions
or protection pins were refreshed. That audit is not reported as fully passing.

Touched state machine: local Ledger chapter/family/collection/detail/search state.
Adjacent systems: shared dropdown anchoring and Calendar consumers; original
source/detail navigation, scoped athlete reads, inherited units and motion.
Existing workflows validated: all nine destinations, chapter round trips, Core
Back, Film play/source controls, own-athlete/coach/denied-foreign film scope,
archive paging/date bounds, source-focused searches, original record/unit/art
contracts. No identity, entitlement, auth, backend mutation, equipment policy or
history ownership change. Existing fixture/media/backend evidence remains valid
because its inputs and serving DEV backend were unchanged.

Delivery is canonical DEV only on `dev/canonical-mobile`, based on
`91fd5542ad84c20150101eb83404698645891354`. The exact pushed/running commit is bound
by the post-push `canonical-runtime.json` receipt in the evidence folder and
remote-reference verification. This is a canonical npm-start/Expo development
observation; no native3.0 archive, TestFlight update or Production release is
claimed. Unrelated dirty backend and untracked historical evidence are preserved.

## Owner correction — restore page identity

Owner asked what happened to the page title “The Ledger”. Removing the global
chooser did not authorize removing the page identity. Restore the persistent
page heading above the chapter controls, with units alongside the heading; retain
anchored local dropdowns and all navigation/state/data/art behavior. Scope is a
small DEV presentation correction. Verify title/controls in the actual athlete
simulator, navigation regressions, TypeScript and horizontal layout; reuse the
unchanged data/source/art evidence above. Push canonical DEV and leave it open.

Title restoration validated: navigation controller/guard, TypeScript and horizontal
layout PASS. The native heading is visible in Records and History; the dropdown
remeasures its new trigger position correctly. Final athlete Records screen is
open, captured at `title-restored.png` in the evidence folder. This correction
adds only presentation hierarchy; prior navigation/data/state scope is unchanged.
Post-push source identity is recorded separately in `title-runtime.json`.
