# Ledger material depth — canonical DEV

Owner request: be careful that clean does not become too gray or flat; research
again and implement a solution. Continue the Ledger as the DEV design proving
ground. Preserve the approved dark brushed gunmetal/cool iron background, readable
integrated movement artwork, page title The Ledger, visible primary chapters,
near-touch dropdowns and all data/source/navigation behavior. This authorizes no
app-wide redesign, image replacement, backend changes or Production publication.

Research, October30:

- [Linear's UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui):
  separate foreground/panel/dialog elevations and consistent base/accent/contrast.
  Inspected its published light/dark comparison and final UI screenshot. Adapt the
  hierarchy, not its predominantly neutral appearance.
- [Apple's new design system](https://developer.apple.com/videos/play/wwdc2025/356/):
  distinguish interactive controls from content, ground menus in their trigger,
  and maintain clear grouping and legibility. Do not stack decorative glass or
  blur on every data card. This is an adaptation for existing React Native
  materials, not a claim to implement native Liquid Glass.
- [Oura's app redesign](https://ouraring.com/blog/new-app-design/):
  color signals the meaning of information. Keep Strength Ledger's existing lift,
  earned-award and selection color roles; invent no recovery score or metric.

Compare against the actual owner-endorsed Records/History concept images retained
in operation-visual-cleanup/. They show charcoal depth, restrained directional
lighting, violet selected controls, meaningful lift colors and warm earned gold.
Do not restore the rejected stacked tab navigation or square artwork thumbnails.

Implementation: reduce the blue-gray cast of content panels; separate darker
chart wells from softly illuminated faces; use restrained edge lighting and
lift/earned-specific surface tint. Give the selected chapter a violet material
and keep inactive chapters quiet. Match dropdown selection and unit controls to
this hierarchy. Reuse the existing surface/motion/anchoring owners and approved
art pixels; avoid new render loops, large blurred layers or image downloads.

Acceptance: recognizable depth without busy decoration; readable text/chart axes;
visible complete movement subjects; purposeful color instead of a gray block
for selection; unchanged title, interactions, original units/history/source/access.
Inspect actual athlete DEV Records, History and Milestones, identify three weak
areas in the first pass, correct and inspect a second pass against the references.
Run affected material/contrast, connected Ledger, navigation, art and type/layout
checks. Reuse unchanged backend/fixture/media checks. Commit/push canonical DEV,
verify the exact running source and leave the populated athlete Ledger open.

## First-pass critique and corrections

Actual native first pass compared with the approved Records/History concepts and
Linear's published light/dark comparison. Three weakest areas: selected control
still lacked a clear upper/lower light hierarchy; milestone lift cards were
indistinguishable neutral panels; chart scaffolding competed with the actual
colored trail. Added a restrained selected-control upper edge/darker lower edge,
carried each existing lift's tone into its milestone surface and subtle outline,
and softened mini-chart grid lines without altering points, labels or axes.
Plate stages were shifted from blue-gray to neutral lit steel at comparable
brightness; every original source pixel and framing remains untouched.

## Result, validation and DEV delivery

Added: a three-stop face gradient, restrained upper-face/edge illumination,
recessed chart material, violet selected-control gradient and coordinated local
menu selection; existing lift tones now extend into milestone panels/edges;
earned gold has a warmer face. Removed the blue-gray cast from the shared Ledger
panel/plate-stage palette and reduced competing mini-chart grid opacity. Kept
The Ledger title, current layout, all approved artwork pixels/feathering, existing
lift color meanings, original axes/values, motion and dropdown positioning.
No new full-screen blur, image asset, dependency or animation loop was introduced.

Compared actual canonical8081 npm-start screenshots with the approved Records and
History concepts and Linear's published screenshot. Inspected first and second
passes in the iPhoneAir/iOS26.2 simulator. Second pass covered Records (all three
movement subjects and original load trails), History (calendar labels, selected
training day and original Session), Milestones (legible medal/plates and lift
contexts), direct chapter changes, anchored menu placement/selection and neutral
outside dismissal. Left the populated athlete Records view open.

Evidence folder: `/Users/dominic/.codex/work/ledger-material-depth-20261030/`.
Actual captures: `pass1-records.png`, `pass1-history.png`, `pass2-records.png`,
`pass2-history.png`, `pass2-milestones.png`. They are development captures, not
native store/release certification or marketing concepts. The research inspected
published screenshots/documentation, not installed third-party native apps.

PASS: connected Ledger suite (subject/unit/history/source/record/chart contracts),
actual navigation/dropdown/controller handlers, actual material and approved-art
rendering guards, text contrast on neutral/lift/gold/selected surfaces, TypeScript
and horizontal layout. Deliberate failures reject collapsed elevation levels,
a gray selected control, a flat actual rendered face, removed light layers and
existing artwork/source/navigation regressions. Overlay lights remain outside
hit testing and accessibility. Logs: `connected.log`, `material-contrast.log`,
`material-art.log`, `navigation-first.log`, `types-final.log`, `layout.log`.

Whole-app UI constitution audit still reports the same five unrelated existing
Home/onboarding/Logger/login findings; no new findings, exception edits or pin
refresh. It is not claimed as a fully passing whole-app audit.

State machine touched: presentation of the existing Ledger chapters and local
controls; state transitions, account identity, access, performed evidence and
qualification calculations are unchanged. Adjacent systems: shared dropdown's
Ledger-only appearance, shared analytical chart material input, source sheets
using Ledger tokens and movement/plate visibility. Existing workflows protected
by the actual handler/source/history/art/chart suite and the second native pass.
Unchanged backend, fixtures, media, artwork approval and published release state
retain their prior applicable evidence. No database mutation or backend push.

Delivery: canonical mobile DEV branch `dev/canonical-mobile`, based on
`c950df4a42044ee5020a5d0d62654c9a2e107c16`. Post-push exact-source/remote/Metro
verification is retained as `canonical-runtime.json` in the evidence folder.
This is DEV only; no Production/TestFlight/native-build operation. Unrelated
untracked and dirty backend work is preserved.
