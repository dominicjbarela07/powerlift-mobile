# Ledger navigation cleanup — October 30 owner correction

Request: the owner rejects both the Records and History navigation in the two
6:53 PM screenshots as cumbersome. Simplify the navigation itself in canonical
DEV; implement and inspect the normal authenticated athlete simulator.

Acceptance: remove the stacked primary/secondary tab rows and repeated heading
layers; retain a clearly labeled current location and a discoverable way to reach
all three Records families, five archive collections and Milestones. Each leaf
must open directly without first choosing a chapter. Keep units, saved view
positions, detail back behavior, source links, populated history and actual
approved artwork intact. Preserve authentication/readiness/athlete subject and
all data/mutation owners. DEV only; no backend or store/TestFlight publication.

The latest owner correction supersedes the prior rail's *visual presentation*.
Its functional coverage stays: all destinations remain available from a persistent
control, including while scrolled. Existing records, media and meet fixtures are
reused without database changes. Existing untracked work remains untouched.

Direction: one current-view title control, with a quiet chapter label and a
chevron; one grouped chooser containing all nine destinations. Remove both rows
of underlined navigation and the redundant Records introduction. The view title
identifies current selection; original content owns the rest of the screen.

Research: Apple's [pop-up button guidance](https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons)
recommends a visible selected value and compact choice controls where space is
limited. [Fluent's iOS guidance](https://fluent2.microsoft.design/components/ios/core/segmentedcontrol/usage/)
also cautions against clutter around navigation controls. The applied design is
our adaptation, using the app's existing governed sheet for the chooser, rather
than a claim that Apple mandates this exact Ledger structure. It contains view
choices only; search, units and primary content actions remain outside the menu.

Validation scope: actual navigation component/controller and all nine selection
mappings; selected-state/dismissal/unknown-key behavior; rejection of stacked tab
rows; existing connected Ledger/history/source/chart/art/subject regressions;
TypeScript and horizontal layout; actual Records and History screenshots, a
first-pass weakness review and corrected second pass. Reuse unchanged backend,
artwork-byte and media fixture/API evidence from the preceding archive task.


## Result and convergence

Implemented a single current-view title in the persistent Ledger header. The
quiet label identifies the chapter; the larger title identifies the active view.
A chevron opens one grouped chooser, with direct access to all nine leaves. No
chapter selection is required before choosing a leaf. Search, units, record
inspection, playback and other content actions remain visible in their views.

Removed both underlined tab rows, the extra Records introduction, the unused
rail component and its obsolete styles/constant. The latest owner direction
explicitly supersedes the prior rail presentation; its navigation/access coverage
is strengthened in the new actual-controller tests rather than discarded.
The chooser uses the existing governed sheet, keyboard cleanup, dismissal,
reduced-motion and system-back owner. It closes before applying a destination and
ignores duplicate selection taps during closing.

First native pass compared directly with both supplied screenshots: repeated
navigation was eliminated, all three Core cards fitted on screen, and the History
chart's complete axes became visible. The three remaining weak areas were the
chooser's excess height, a dominant purple selected band and an accessory icon
that resembled health monitoring. The corrected pass uses a content-sized chooser
with a bounded scrollable fallback, neutral selected material with a checkmark,
and a library-style accessory icon. The second native pass shows all nine options
without scrolling on the iPhone Air and confirms direct Core → Film → Personal
bests → Core navigation with the correct title and unit retained.

Scroll restoration keys now belong only to the active view: changing Records
family cannot change a History collection's restoration key. Choosing a Records
leaf exits an old deep Records drill-down; other chapters retain their prior
selection. Existing bounded archive paging/search/date behavior is preserved.

## Validation and destination

Passing: TypeScript, the complete affected connected-Ledger suite, the new real
navigation component/controller tests and the horizontal-layout guard. The nine
choices are executed through the actual normal authenticated Ledger controller;
self-athlete scope and unit are retained. Tests cover cancel without navigation,
selected state, keyboard cleanup, close-before-navigation, rapid taps, small/
large-text sheet bounds, exact restoration keys and leaving a Core drill-down.
Deliberately restoring a stacked tab row or removing the persistent navigation
fails. Prior history race/denial, exact source, chart, approved artwork/subject and
modal guards also pass. The broader UI audit retains the same five unrelated
Home/onboarding/Logger/login findings; no exceptions or protection pins changed.

Native evidence is iPhone Air / iOS 26.2, authenticated QA athlete, canonical Metro
8081 / local DEV backend 5017. This is observed DEV presentation, not Android,
physical-device, native-build or release certification. No backend source,
database fixture, identity, relationship, auth/readiness/entitlement, source ID,
media file or approved movement artwork changed. Existing applicable backend and
asset evidence from the preceding archive task is reused.

State machine touched: local Ledger view selection, optional detail exit and
scroll restoration. Adjacent source sheets, date/search, unit inheritance,
read-only subject access and normal app navigation are protected by the affected
suite; AuthContext and server authorization remain their existing owners.

Receipts and exact source hashes are in
`docs/validation/ledger-navigation-2026-10-30/`. Original supplied references,
first-pass menu and final Records/History/Film/menu PNGs are retained at
`/Users/dominic/.codex/work/ledger-navigation-20261030/`. Canonical DEV is the
requested destination; no Production/TestFlight publication is part of this task.

To use it: tap **Core lifts**, **Personal bests**, **Film** or whichever current
view title appears beside the chevron, then choose the destination directly.
The DEV athlete simulator is left on Core lifts.
