# Role-first onboarding — October 24, 2026

## Published guidance — latest owner instruction

The owner requested research into established app onboarding instead of invented
flows. Apply the relevant published recommendations to the rejected screenshot
flow, preserving all established account/access rules. Research reviewed October
24, 2026; these are design recommendations, not a universal mandatory sequence.

| Primary source | Relevant guidance | Strength Ledger application |
| --- | --- | --- |
| [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Keep prerequisites brief; prefer interaction and contextual teaching. | Remove the compulsory preview. Existing role-aware Education remains contextual and replayable after admission. |
| [Material Design 2: Onboarding](https://m2.material.io/design/communication/onboarding.html) | Keep meaningful self-selection short; do not combine self-selection with a benefits carousel. This is published M2 guidance, not a new M3 requirement. | Keep the three consequential role choices on one screen; role selection opens account creation immediately. |
| [NN/g: Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/) | Avoid introductory card tutorials; minimize setup and teach unfamiliar tasks in context. | No screenshot gallery, feature grid or extra Continue screen. |
| [GOV.UK: Create accounts](https://design-system.service.gov.uk/patterns/create-accounts/) | Explain the task clearly and avoid distracting account-creation content. | One short role benefit, accurate eligibility and a focused account form. Accounts remain necessary for private training data. |
| [GOV.UK: Password input](https://design-system.service.gov.uk/components/password-input/) | Support password managers, show/hide, paste and correct creation/login autofill semantics. | Correct native semantic hints, explicit field/toggle labels, no correction/spellcheck of passwords. Existing confirmation remains because the registration contract requires it; removing it is outside this presentation correction. |
| [React Native: TextInput](https://reactnative.dev/docs/textinput) | Native semantic hints differ by platform; avoid conflicting autofill properties. | iOS textContentType; Android autoComplete, without supplying both. |

Acceptance: direct role → account callbacks for all three roles; no onboarding
screenshot dependency; no draft loss on Back/Change; existing invite, beta-code,
password, backend rejection, sign-in, SSO, verification, trial and support recovery
remain intact. Verify actual callbacks and deliberate regressions, TypeScript,
affected keyboard behavior, actual canonical DEV visual convergence, and refreshed
native live-backend proof. Delivery remains canonical DEV and the local simulator;
no new Production/OTA/store release. Do not claim conversion or trust improvements
as measured: those require usability testing and production funnel evidence.

## Screenshot rejection — latest owner direction

The owner explicitly rejected screenshots as an eyesore that adds nothing to the
signup flow. This supersedes the earlier request to display screenshots and the
intermediate preview stage. Remove that stage entirely. Keep the photographic
role entrance. A role tap opens its account form directly, with one concise
role-specific benefit sentence and accurate admission requirements. Back/Change
returns to roles without losing the draft. Preserve sign-in, SSO, registration,
verification, trial/support recovery and backend access authority.

Delivery: canonical DEV and refreshed live-connected iPhone Air preview. No
Production/OTA/store publication. Preserve screenshot files and Education uses
on disk; remove only their onboarding consumption. Validate actual direct role
handlers, role changes/drafts, admission, back navigation and regression controls;
inspect actual revised forms and refresh native handoff verification.
Status: completed in canonical DEV and the local live-connected simulator.

## Standards correction — implementation and validation

Implemented direct role → account creation in canonical DEV. Removed the gallery
component and its Education image dependency, preview stage and unused capture
metadata. Original screenshots and Education consumers remain intact. The photo
entrance is unchanged; no new decorative style or imagery was introduced.
Account forms now use a compact Back/brand row, full-width eligibility copy and
unboxed fields, with the password minimum visible before typing. Added native
name/email/password autofill hints and distinct accessible password controls.
Confirmation remains an explicit retained API/product constraint; this is not a
claim of perfect adherence to every general recommendation.

Actual source callback checks passed for all three roles on iOS and Android:
direct account entry; alternate role/back changes retaining drafts; coach code
and password admission; rejected submission/retry; successful unverified signup
passing backend state to AuthContext and the canonical resolver; support presence;
native autofill hints, independent show/hide and back navigation. Deliberate
form-first, extra-interstitial and screenshot reintroduction failures were rejected.
TypeScript, keyboard geometry/event/consumer checks, existing checkout recovery
including forced-dismiss rejection, and canonical fresh-login identity passed.

Canonical npm-start visual convergence: first pass exposed oversized brand space,
nested form framing and cramped eligibility copy. Refined all three; inspected
the second pass, all three direct role forms and retained draft after Coach →
Self-Coach. Compact iPhone SE normal and accessibility-large were inspected;
eligibility now uses the full width and scrolling reaches password, confirmation,
submit, help and sign-in. Restored compact text size and shut down that fixture.
Evidence: `docs/validation/onboarding-standards-2026-10-24/`.

State machine touched: signed-out signup presentation (choose/details), semantic
input configuration and Back/Change. Adjacent systems: sign-in/SSO setup,
registration, verification, billing admission, Auth bootstrap, keyboard, Education
and support. No identity/entitlement/billing writer changed. Verification resend,
email correction, checkout terms/return/status recovery and support fallback were
reviewed in source and retained. No live signup, purchase or support submission was
performed; source review and fixture tests do not prove customer email/card delivery.
The native simulator refresh passed. Installed product source:
`64208a8d1c1f70e6f7e829a1473ab1a465538c01`; bundle SHA-256:
`0790143840bcd8f77af9283c6358a3aa75bc8a0e195f292db609f83ee19a5e73`.
All 994 exported runtime files equal their installed bytes; the three edited
product source files equal the export source map; all 998 prior protected export
asset entries remain present by content hash. No native graph, signing identity,
approved-art policy or store provisioning was changed. This uses the preserved
simulator shell and does not certify a new store/native build.

The actual installed native probe at `2026-10-24T17:07:39.199Z` passed disposable
SecureStore missing/read/write/delete checks without accessing real auth keys;
the actual native live health request returned HTTP 200, ready true, serving
`72e1987fa086ae10ef42b10d0ee373e2b706a7de` at
`https://app.strengthledger.fit`. Restored the normal entry and removed the probe.
The mandatory installed-app simulator handoff verifier passed; its unchanged
same-day negative controls remain in
`docs/validation/onboarding-simulator-live-2026-10-24/guard-negative-controls.json`.
Observed native Self-Coach → account creation directly and Back → roles. Left
iPhone Air at role selection for owner takeover. Product source was pushed to
`origin/dev/canonical-mobile`; no Production/backend/OTA/store publication.

## Owner visual correction — superseded preview design

The owner rejected the first delivered atmosphere as unrelated to strength and
too busy. This supersedes the violet rings/auras and the dense all-in-one role,
headline, feature grid and screenshot composition. Rebuild the opening around
physical lifting imagery: loaded iron, chalk, hard light and a neutral dark gym.
The first screen contains only brand/sign-in, one headline and three clear role
actions. Choosing a role opens a separate, restrained app preview before the
existing account form. Keep role-specific screenshots and setup requirements,
draft preservation, admission/recovery/access guards and live simulator targeting.
No Production/OTA release is authorized by this visual correction. Inspect actual
canonical runtime captures twice, with explicit assessment of visual density and
the strength-related background. Preserve prior evidence as rejected history.
The correction is implemented in DEV; the earlier completion below is historical.

Current flow: choose one of three full-width role actions → that role's app
preview → existing account form. The opening has a photographic loaded-barbell
background, one headline, three role rows and Sign in. Feature grids, decorative
orbits/auras, preview dots, screenshot captions and the large violet Continue
button were removed from the opening. The role preview retains two actual app
captures and a concise feature sentence. A short, accurate admission/setup note
stays beside Continue; full requirements remain in the form. Back and Android
back move through the stages without discarding the draft.

Generated a new DEV background with the built-in image tool:
`assets/images/onboarding/loaded-iron-welcome-v1.png`. Its exact prompt, source
file and generation mode are retained in
`docs/validation/onboarding-strength-atmosphere-2026-10-24/background-generation.json`.
The original generated file is preserved. This is welcome-screen imagery; no
movement image, human approval, original asset or crop registry was changed.

Visual convergence assessed three weak areas: (1) the initial cover crop hid the
loaded barbell's sleeve, repaired with a full-width, explicitly measured image
frame; (2) information density, repaired by separating the opening and product
preview and removing repeated UI; (3) reading/action clarity, repaired with larger
role subtitles, an always-visible setup note and bounded decorative-heading
scaling while role text remains scalable. Inspected actual canonical npm-start
captures after these refinements, all three role previews, the transition to the
account form, compact iPhone SE and accessibility-large scrolling/role access.

The actual-handler guard now covers choose → preview → details, draft retention,
registration admission/payloads, rejected requests, all Android back levels,
backdrop/preview failures and the sparse opening. Deliberate form-first and
busy-opening regressions are rejected. TypeScript and the canonical keyboard
suite pass. Unchanged identity, billing, SSO, Education and support mutations keep
the preceding source-bound checks; no new account access owner or writer exists.
No live account, payment or support message was created. Evidence:
`docs/validation/onboarding-strength-atmosphere-2026-10-24/`.
Final refreshed native handoff passed. Installed product source:
`238f916fbc2309d02a9f3693de0ffbc500370d9e`; bundle SHA-256:
`b05ed7be7d8fabb3f3997be388a98856e6a924811afc3ad665a6899e56491013`.
The actual installed bundle's source map matches LoginScreen, SignupWelcome and
role-definition bytes. All 994 native export files, including the exact new photo,
match installed bytes; all 998 prior published asset entries remain preserved.
Fresh native SecureStore read/write/delete and live Production health passed
(HTTP 200, ready true, source `72e1987fa086ae10ef42b10d0ee373e2b706a7de`). The
installed-app guard passed embedded entitlements, signature, exact bundle and
live targeting. Temporary instrumentation is removed. The guard's unchanged
same-day negative controls remain applicable to its stale-bundle/origin checks.

Observed the final native photo-led opening on iPhone Air and left it there for
owner takeover. The compact test device is restored and shut down. No real
signup/payment/support message, backend change, OTA or store publication ran.
This is the current canonical DEV design in a local simulator preview against
live services, using the retained simulator shell, not new store certification.

Owner request: replace the uninviting signup entrance with a premium, atmospheric
experience. Athlete, Coach and Self-Coach selection comes before forms. Show real
app screenshots and relevant features for the selected role, then collect account
details. Trust and a smooth path into onboarding are acceptance requirements.

Destination: canonical mobile DEV and the owner-authorized iPhone Air simulator,
using live services. No Production/OTA/store publication is included in this new
design task. Preserve the released reliability and recovery work, artwork bytes,
identity and AuthContext/backend routing ownership, email verification, coaching
billing, Coach beta-code and Athlete invite admission rules. No real signup,
payment, support message or customer mutation will be performed during preview.

Acceptance:
- Signup opens a separate role preview with no account inputs mounted.
- Each role shows relevant real captured app screens, clear benefits and accurate
  setup requirements. No invented endorsements, prices, trial duration or access.
- Continue opens the existing account form with that role. Back/change-role keeps
  entered details. Existing sign-in, SSO, validation and recovery paths survive.
- Accessible role/control semantics, large text, compact screens, keyboard/back
  navigation and screenshot failures remain usable; no automatic carousel.
- Inspect actual canonical npm-start screenshots, identify the three weakest
  visual areas, refine them and inspect a second screenshot pass. Validate the
  actual role-to-form handlers and unchanged registration request requirements.
- Refresh and verify the final installed live simulator candidate before handoff.

Implemented in canonical DEV. The signed-out entry now opens a separate role experience with
atmospheric violet material, three accessible role choices, relevant features,
two manually switched real app captures per role, clear setup expectations and
a persistent Continue action. Existing example-data screenshot bytes are reused;
no artwork, native dependency, account authority or registration API changed.
The details stage carries the selected role and its requirements. Back/change
keeps the draft. Sign-in/SSO and setup support remain in their existing paths.
Returning users have a persistent Sign in action at the top of the opening screen.

Actual canonical npm-start visual convergence:
1. First pass: benefits fell below the opening viewport, the image fade obscured
   useful content, and screenshot switching lacked an obvious action.
2. Refined hierarchy and spacing; placed benefits before the image; reduced the
   fade and focused Ledger captures on actual progress; added a 44-point next
   control and 44-point preview selectors.
3. Inspected a second pass for Athlete, Coach and Self-Coach. Also inspected the
   iPhone SE compact screen. Accessibility-large exposed compressed role labels;
   the final layout uses full-width role/feature rows and remeasures when the text
   scale changes. Observed the corrected rows and scrolling with a fixed action.
   Initial failure screenshots are retained as pre-correction evidence.

Validation passes: actual rendered role-to-form and back handlers for all roles;
draft retention; exact registration role/code payload; missing fields, password
mismatch, mandatory Coach code, rejected request/retry without access grants;
Android back; preview switching and failed-image fallback. The guard deliberately
rejects the previous form-first entrance. Native checkout recovery, canonical
fresh-login identity, actual Education provider navigation/exit-loop control,
keyboard ownership/event/frame checks and TypeScript also passed. Unchanged
backend admission/billing protections retain their October 23 release evidence.

State-machine scope: presentation introduces preview → details before existing
registration. Adjacent sign-in, canonical identity, verification, entitlement,
SSO, Education and support keep their owners. No client access grant or API
contract changed. No live signup, payment or support notification was performed.

Evidence: `docs/validation/onboarding-role-preview-2026-10-24/`.

Completed live simulator handoff: installed product source
`7b317362d1e1c2a97018c13afc24d369a2576970`, clean bundle SHA-256
`ec3a0068573028026a5cc1c7625ebc47cafd0ebf516aea032c05da953cc35a26`.
The fresh native disposable SecureStore probe passed read/write/delete and called
`https://app.strengthledger.fit/health/recognition`: HTTP 200, ready true, backend
`72e1987fa086ae10ef42b10d0ee373e2b706a7de`. Its API source is unchanged across the
final entry-default correction. The installed-app handoff guard passed; all 993
actual native export files match installed bytes. All 998 prior published asset
entries are preserved. Source-map contents for LoginScreen, SignupWelcome and
the role definitions match the named checkout's exact source bytes. Temporary
instrumentation was removed. The unchanged guard's deliberate stale-bundle and
localhost-receipt rejection evidence is retained in the preceding same-day
`onboarding-simulator-live-2026-10-24` validation directory.

Observed the final installed native app open directly at the role preview, with
Self-Coach selected, live services, no account inputs and no error. Left it there
for owner takeover. Choose a role, use the preview arrow/dots to see both app
captures, then Continue to the account form. Back/Change returns to the preview.
The compact simulator was restored to its original text size and shut down.

Product source and evidence are in canonical DEV. This is an owner-requested
local simulator preview using the retained native shell, not an OTA/Production
publication or newly certified 3.0 native store binary.
