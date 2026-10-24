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

Implemented in canonical DEV. Signup now opens a separate role experience with
atmospheric violet material, three accessible role choices, relevant features,
two manually switched real app captures per role, clear setup expectations and
a persistent Continue action. Existing example-data screenshot bytes are reused;
no artwork, native dependency, account authority or registration API changed.
The details stage carries the selected role and its requirements. Back/change
keeps the draft. Sign-in/SSO and setup support remain in their existing paths.

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
Final installed live candidate verification is pending; this DEV change is not
an OTA/Production/store publication.
