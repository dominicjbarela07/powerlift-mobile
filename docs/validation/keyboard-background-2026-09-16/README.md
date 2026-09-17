# Canonical keyboard backing — September 16, 2026

## Root cause and correction

The reported Swap Accessory path is `GovernedAccessorySubstitutionPickerModal` → `KeyboardModal` → independent `KeyboardViewport` → React Native Modal. Installed React Native 0.81.5 `Libraries/Modal/Modal.js` defaults the opaque modal container to white when `backdropColor` is absent. The avoidance wrapper padded transparent views around a dark child, exposing that white parent during keyboard movement and at the native keyboard's rounded corners. The native baseline reproduces white corners/backing; it does not reproduce the full large slab described on the owner's device.

The correction belongs to the shared presentation boundary. `KeyboardModal` now supplies `SLColors.canvas` to the native backdrop and paints its entire opaque independent viewport, including vacated padding. `AppShell` also paints its full bounds beneath the existing workspace background. These colors are present in every keyboard state. Transparent modals/sheets keep their existing scrim and underlying app, rather than becoming opaque panels. No Swap-specific rectangle or keyboard-height spacer was added.

The first pass found three weak backing layers: the native opaque modal's white default, its transparent avoidance viewport, and the root shell relying on a background child rather than its own fill. All three are now owned explicitly; the second native pass confirms the correction.

## App-wide audit

[Inventory](input-surface-inventory.json): 242 app/component TSX files, 112 input/SLField consumer render sites in 42 files plus the single native input owner. These are static render sites, not distinct runtime fields. All inputs use `SLTextInput`; its existing `props.keyboardAppearance ?? 'dark'` is the only appearance declaration. Native appearance remains a platform hint and caller overrides remain supported. No native keyboard is manually colored.

Root/navigation scenes, native modal roots, measured avoidance, shared scroll forms, FlatLists, bottom sheets, search, Messages, Athlete Workspace, feedback, Coach/Session notes, review inputs and Programming all converge on the audited owners. Transparent scene/list/scroll children retain the AppShell backing. All native modal imports remain inside the keyboard owner. Existing list viewport, focus reveal, composer, bottom-sheet gesture and dismissal code is unchanged.

## Native second pass

Canonical DEV Metro on port 8081, existing Expo Go / iOS 26.2, 402×874 iPhone 17 and 375×667 small iPhone. Native input focus and production opening/dismissal callbacks were driven through the local React Native debugger after Computer Use returned “Invalid app” for Simulator. Screenshots and recordings are actual native output, not browser emulation. No new QA route, native dependency or production instrumentation was added.

| Required surface | Native evidence |
| --- | --- |
| Exact Swap Accessory search | [Open keyboard](swap-after-open.png), [search results](swap-after-results.png); actual QA Session, no movement selected |
| Movement search / Programming | [Small Add Movement search](small-movement-search-open.png); results remain visible, no movement added |
| Equipment/manufacturer search | [Open manufacturer search](equipment-after-open.png); no equipment selected |
| Messages composer | [Populated](small-messages-open.png), [empty](small-messages-empty-open.png); input, attachment and Send above keyboard |
| Athlete Workspace Messages | [Embedded composer](small-workspace-messages-open.png); scoped QA conversation |
| Coach notes | [Scratchpad](small-coach-notes-open.png); focused native field remains visible; existing form remains scrollable |
| Session notes | [Small Session authoring](small-session-notes-open.png); field and existing Save toolbar visible |
| Review feedback | [Small review field](small-review-feedback-open.png); existing DEV certification mounts actual `CompletedSessionRecap` with inert save callbacks, not a live completed-record review |
| Settings/feedback | [Standard](settings-feedback-details.png), [small](small-feedback-open.png); field and Cancel/Send footer visible |
| Bottom-sheet input | Equipment, feedback and Coach scratchpad above exercise existing governed/legacy sheets |

[Native field measurements](native-measurements.json) confirm focused field bounds above the actual keyboard frame. Both devices end with keyboard visibility false. Message, feedback, note, equipment, movement and Session submit actions were never invoked; existing QA data and drafts were not edited, apart from a discarded movement-search query. No message was sent.

[Final transition recording](swap-transition-final.mp4) covers two focus/open/dismiss cycles followed by closing Swap and navigating to Settings. [All-frame scan](animation-scan.json) inspects 199 encoded frames over 6.07 seconds: zero broad white rows below the header and zero white backing at both app edges. The 495-frame baseline has white edge backing in 307 frames. The [contact sheet](transition-contact.png) was visually inspected, including intermediate keyboard positions, and [navigation after dismissal](after-dismiss-navigation.png) has no stale backing layer. No white flash was observed in this captured pass; this bounded native evidence is not a claim about every OS/keyboard combination. Final installed-TestFlight verification belongs to the owner.

## Regression scope and release

Touched state: backing paint across keyboard hidden → opening → open → closing → hidden and native modal presentation. Keyboard geometry, focus scrolling, animation event handling, top-origin sheet gestures, drafts and lifecycle writes are unchanged. Adjacent systems are every input/form/composer plus route dismissal. No authentication, onboarding, billing, role, relationship, movement identity, routing-authority or persistence implementation changed.

TypeScript and all 222 accepted contracts passed, including actual viewport/modal rendering, 36 device/frame geometries, iOS/Android events, AppState and route dismissal, multiline bounds, focus callbacks, composer clearance, consumer convergence and existing sheet-gesture checks. The existing keyboard contract now verifies opaque black backing across visibility states while preserving transparent sheets and the native dark appearance hint. The guarded publisher rechecks source projection, all accepted/critical contracts, route export, exact artwork receipts and existing native-build compatibility.

Authorized delivery: push canonical DEV and publish a compatible update to the existing TestFlight channel. No native build. Production unchanged. Final release IDs and PT-first/Eastern timestamps are recorded in the backend development ledger and release receipt after served-bundle verification.
