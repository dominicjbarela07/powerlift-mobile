# Role-first onboarding — October 24, 2026

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
