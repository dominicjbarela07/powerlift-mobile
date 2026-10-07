# Mobile 3.0 production readiness sweep — October 6, 2026

## Owner request and acceptance

Owner requests a thorough final sweep before deciding whether to prepare Mobile
3.0 for Production: click through the product as needed, inspect every reachable
screen against the current visual aesthetic, identify meaningful holes, and give
a clear GO / NO-GO with required fixes distinguished from polish that can wait.
Perfection is not the bar. Reliable complete core journeys, consistent usable
presentation, preserved product laws and a coherent release candidate are.

This task audits canonical DEV, the separately reviewed Education preview and
current release evidence. It does not publish, push, remap Production channels,
or authorize a Production build. Use isolated existing QA accounts/local backend
for mutation checks; preserve owner data and all pre-existing dirty work.

Required evidence: exact source identities; current DEV/TestFlight/optional
differences; route/surface inventory and observed coverage; functional/visual
findings with reproduction and severity; appropriate executable checks; release
and native compatibility gaps; explicit unobserved cases; ordered disposition.

Preserved owner laws: DEV is the superset; cumulative releases and explicit
owner removals only; approved art/mappings/crops remain; canonical Session and
performed-set identity stay correct; machine PR history is equipment/manufacturer
isolated (Other separate, first machine baseline quiet); free-weight baseline
recognition allowed; zero-load bodyweight edits valid; prescription Save and
Hot Swap must persist; Cable brand-only decision is retained without silently
promoting its held-back backend/catalog migration; no user-facing “workout”;
Production Mobile 2.0.2 remains unchanged. Audit role/account/entitlement state
machines against the governing identity architecture without inventing access.

## Initial source inventory

- Canonical mobile: `/Users/dominic/powerlifting_app_dev/powerlift_mobile`,
  `dev/canonical-mobile`, `35bdf496`; tracked work clean before this record;
  existing untracked evidence/artifacts preserved.
- Optional Education preview: `/Users/dominic/powerlifting_app_mobile_optional_dev`,
  `dev/mobile-3-education-20260928`, `0afa7990`, substantial pre-existing tracked
  and untracked work. Education corrections were not yet integrated into canonical
  DEV or TestFlight at the start of the sweep. Do not treat the entire optional checkout as an approved
  release delta.
- Latest recorded TestFlight OTA: `01a11340-9ccc-7498-a71d-77a367aa6f5f`,
  group `d94afb31-3d19-4265-9040-0c2566c490b3`, source
  `59641028e514c3edc957c95de2d4882f2f3bf3e0`, runtime 2.1.0 / native build 28.
  Exact current remote state will be distinguished from this retained receipt.
- Canonical backend: `/Users/dominic/powerlifting_app_dev`,
  `dev/canonical-backend`, `f49b8eb1`, pre-existing dirty work preserved.
- Existing local runtime: canonical Metro 8081/API 5002; optional Metro 8084.
- No Codex-managed worktree artifacts attached to this chat. Existing repository
  worktrees are inventoried rather than removed during an audit.

## Results

**NO-GO for Production publication / final build certification at this source.**
The main product journeys are visually coherent and functional in the observed
states. A broad redesign is not required for 3.0. Resolve the specific product
and release-integrity findings below, then assemble and certify the actual
Production candidate. Production preparation can begin as that bounded work;
the current DEV checkout must not be exported wholesale and declared ready.

This is an audit conclusion, not permission to remove protected product state,
weaken tests, publish, build, or submit. No Production or TestFlight publication
occurred during this task. The owner separately authorized canonical Education
integration; that work is complete and committed.

### Final source and runtime identity

| Surface | Observed source / state |
| --- | --- |
| Canonical mobile DEV | `d0f0d32d78adf77bcd77b4cb687335be832bf5a0`, branch `dev/canonical-mobile` |
| Education integration | `3cf99b0b`; permitted Logger edit/Swap hint retirement in `d0f0d32d` |
| Remote canonical mobile reference | `9bb4dfdea5f8d7522eee5fda440b0bae6623db15`; local work is ahead |
| Local runtime | Canonical checkout on Metro 8081, local API 5002; iPhone Air / iOS 26.2 |
| Latest actual TestFlight OTA, read-only query | `01a11340-9ccc-7498-a71d-77a367aa6f5f`, group `d94afb31-3d19-4265-9040-0c2566c490b3`, source `59641028e514c3edc957c95de2d4882f2f3bf3e0`, created `2026-10-06T22:06:03.980Z`, runtime 2.1.0 / iOS build 28 |
| TestFlight release checkout | `57de0daf66a10579a92a1cb983bf0a88ead035fd`; separate from the OTA's publication-source commit |
| Canonical backend | `f49b8eb1`, existing dirty work preserved |
| Actual serving shared backend | Health reports `751a1173b301cb382557c5cbda59e4fdf72633b2`, recognition ready, `accessory-exact-reps-equipment-isolated-v3` |
| Optional Education checkout | `0afa7990` plus existing dirty work preserved; only the documented Education closure integrated |

The strict canonical-source certificate fails because local HEAD is ahead of
the remote reference. Independent runtime observation identifies canonical
Metro's working directory and manifest, and actual new Education was traversed.
Those observations do not substitute for the clean, synchronized, exact-source
release certificate required for a final candidate.

Evidence directory: `../validation/production-readiness-2026-10-06/`.
The candidate export was built from `d0f0d32d`; a later documentation-only audit
commit does not change those tested product bytes.

### Required fixes before a Production GO

**P1 — Draft Session lifecycle is misrepresented in Athlete Training.**
In Athlete mode, open Training → Program map → Week 2. Local QA Session 1815,
“Release Integrity QA — Coach Draft”, has actual backend `status=draft`,
`raw_status=draft`, `loggable=false`. Training lists it as **Not Started**;
Program map lists it as **Missed**. Opening it reaches a preview with a disabled
Begin Session action and no visible explanation. No draft was started.

Mechanism: `lib/program-timeline.ts:126` has no draft branch and converts an
otherwise unknown past-dated status to missed; the Training label helper
falls through to Not Started. The preview-action helper does explicitly block
drafts, so this is a state-presentation/routing inconsistency, not evidence that
the server granted logging access. Fix by preserving the established draft /
assignment semantics throughout Training and its preview. Do not invent an
athlete authoring permission. Audit equivalent dates/states, totals and the
Calendar adapter; require a regression that feeds an actual draft through each
projection. Screenshot: `19-athlete-draft-missed.png`. The observed Calendar
did not show that draft as an active Session. No attendance-data corruption is
asserted from this observation.

**P1 — One new selectable DEV movement has no approved exact artwork.**
The current governed active inventory has499 definitions,498 with approved art.
Only movement 650, `barbell_overhead_press`, lacks an exact numeric-ID assignment
and approved image. Both complete-library and Core-art coverage contracts fail
on this entry. This is an unshipped DEV addition, not a missing restored
TestFlight image. Resolve with an already owner-approved valid binding if one
exists; otherwise an owner decision is required about that new entry before
candidate assembly. Do not generate, substitute, auto-approve, or remove any
protected imagery. Proof: `current-artwork-inventory.json`, `accepted-final.log`.

**P1 — Release projection and source evidence no longer match current DEV.**
The fresh release-gate run at `d0f0d32d` stops at the Logger's exact source-bound
holdback: expected DEV hash `86156c699fba0f30...`, actual `e3b361fb24ee9203...`.
That explains the third accepted-contract failure. It also emits historical
missing-path diagnostics for the shared-movement programming test. The initial
superset audit separately flags `session-equipment-context.tsx`: DEV contains
the newer owner-requested Select/cleaner row, but the registered source
transition covers only its older TestFlight hash. This is not a file or artwork
deletion. The candidate cannot be certified from stale evidence.

Register bounded, actual owner-directed changes and update the tested holdback
projection only after demonstrating its exact retained fix/dependency closure.
Reconcile Education into the candidate with its explicit DEV directive; obtain
publication scope in the actual release task. Preserve the legitimate Cable
backend/catalog holdback. Never refresh protection pins merely to make a failed
candidate pass. Re-run the positive release case and its deliberate missing-art,
missing-feature, wrong-source and catalog-subtraction failure cases. Evidence:
`dev-gate-final-summary.json`, `dev-gate-final.log`,
`dev-superset-summary.json`, `accepted-final.log`.

**P1 — Meaningful small text fails the existing accessibility contract.**
The mobile typography audit stops at meaningful10 pt text in
`components/coach-mobile/SessionEditingWorkspace.tsx`. Several adjacent labels
use10/11 pt (editor hints, subject, toolbar and date-picker labels); the Coach
workspace shell also has small labels. Fix the meaningful labels to the
established 12 pt minimum, then inspect wrapping/touch access on a compact phone
and with larger text. The observed Air layout is readable at default size;
that does not waive the minimum or prove Dynamic Type. Do not blanket-change
all style literals. Evidence: `typography.log`.

### Production candidate work that remains

This is required release preparation, rather than another discovered UI bug:

1. Assemble the cumulative 3.0 candidate from canonical DEV with the valid
   TestFlight fixes, explicit source receipts and held-back migrations respected.
   Education and the latest equipment Select cleanup are currently DEV-only.
2. Provide a 3.0-specific approved-art inclusion policy. The current
   `lib/approved-art-runtime.ts` enables art for DEV/TestFlight and intentionally
   disables it for a normal Production export. Publishing those Production
   bytes unchanged would revive anatomy fallbacks. Preserve the legacy 2.0.2
   product/runtime; do not globally flip its policy. Verify exported and
   delivered 3.0 bytes against the protected approved inventory.
3. Prepare a new native Production build/runtime/version under the actual
   release authorization. Current DEV/TestFlight is 2.1.0/build 28; Production's
   protected baseline is 2.0.2/build 24. A 2.1.0 OTA cannot update that 2.0.2 runtime.
   Native-build and store-submit records currently say NOT_GRANTED. No request
   to publish/build was inferred from this readiness audit.
4. Synchronize the reviewed source and certify the exact candidate. The local
   DEV certificate correctly rejects an unpublished HEAD. Re-run the full
   release gates on that candidate, including actual mutation/persistence and
   post-publication source/artifact checks in the authorized release run.
5. Complete native/store and device checks on the actual new binary: Apple
   sign-in, purchase/restore/access transitions, push and background audio,
   media upload/review, compact-phone and supported tablet layout, larger text,
   Android if included, and a fresh qualifying PR's visible/audio delivery.
   The simulator/Expo review cannot certify those platform behaviors.

### Actual click-through coverage

This sweep used existing isolated Self-Coach, Coach and Athlete QA accounts on
the local backend. Education content was presented by the actual canonical
provider. Training screens used real API-backed Sessions, canonical resolvers
and original artwork. No storyboard replaced a training mutation. Education's
illustrations are teaching examples and are not account training evidence.

| Journey / surface | Actual observations and result |
| --- | --- |
| Login, logout, role homes | Existing Self-Coach→Coach→Athlete credentials; correct mode/home and athlete context; no identity override or access grant |
| Education | Self-Coach replay/opening/Back/all 3 lessons/finish/cold-base reopening; Coach and Athlete opening/all 3 lessons/correct home; Settings replay controls; new-view markers retire after visit; no cyan annotation boxes |
| Self-Coach Today | In-progress Session, week summary, completed Session entry; resume/collapse works |
| Programming | Program/Block/Week, notes, draft Session workspace, saved 5-movement/7-set composition and preview with exact artwork; navigation stays in the correct context |
| Movement search | Real accessory picker/recent entries/search; typo `lat pulldwn` returns relevant catalog options; ranking finding below; broader directory search contracts pass |
| Active machine Logger | Actual Machine Pullover; inline title Swap and background-free edit; clean Equipment Needed Select; Other chooser/current-equipment display; prescription 6–10→8–12 Save/reopen; planned sets 1→2 retains completed evidence |
| Machine Set mutation | Actual UI saves 20 lb × 12 and 22.5 lb × 12 on Other 641; rest/skip/movement completion and next-movement navigation work; backend confirms quiet baseline then valid exact-equipment PR |
| Athlete Active Logger | Bench/Push-Up navigation; role denies authoring controls; no empty comparable-exposure card for first Push-Up; zero-load logging, Save Changes and reopening at zero succeed |
| Set logger/rest controls | Load/reps/effort wheels, units, failed-lift control visible; rest sheet, Skip Rest and next movement exercised; device sound/background playback unobserved |
| Pre-Session / preview | Real saved Session previews and draft restricted start observed; latest readiness form has executable render/start contracts, but fresh readiness Save/Skip UI was not exercised in this sweep |
| Post-Session | Actual completed Self-Coach Session Overview/Performed tabs and canonical Coach review form; correct Session remains selected; no review sent/completed |
| Calendar | Self-Coach day/completed/in-progress details→recap; Coach month/agenda and counts; Athlete month/current Session; no production scheduling changes |
| Ledger | Home, Strength overview and Bench progression, Evidence/Standards, Accessories/front anatomy→Biceps detail, Movement History, Achievements/volume milestones; Coach-authorized Journey, Variants empty rotation and Archive; honest missing evidence for absent lifts |
| Coach home / Review Hub | Attention queue, athlete cards, coming-up, correct completed review, Hub counts, video-filter empty state; first-visit NEW disappears; no notification or feedback sent |
| Coach Athlete Workspace | Brief, Training/Programming, Performance limited-history chart, Reviews, relationship context, private notes empty state, scoped Evidence/Ledger; no athlete data modified |
| Coach Messages | Inbox, announcements count and empty athlete thread; composer visible; wrong-role empty copy noted; no message sent |
| Coach Check-Ins | Empty state, template chooser, actual Weekly Recovery template creation/detail/edit-question list; form remains unassigned and unscheduled |
| Team Brief | Snapshot, adherence/volume/coverage, limited-history chart/empty context; no invented complete total or progress |
| Settings | Account/mode/access/training/support/privacy presentation; Guidance replay; safe logout; no account deletion, privacy change or purchase |

Representative screenshots are numbered 01, 05–19 in the validation directory.
Screens 02–04 are earlier pre-final Education captures and are not final proof.
Screens 08–09 show the final canonical Self-Coach lessons; 13 and 17 show Coach
and Athlete Education. The simulator remains on a working canonical Athlete
Today screen with an isolated QA account.

`route-coverage.json` inventories all 84 route files (33 with actual observed surfaces) and separates
surfaces, layouts, legacy bridges, developer-only routes and unobserved routes.
Route-file count is not a count of distinct product screens: many wrappers
share components, and modal experiences are not individual route files.
The unobserved list is explicit; this report does not claim every permission,
empty/populated state, fixture, device or screen variant has been certified.

### Executable validation and artifact evidence

| Check | Result / practical limit |
| --- | --- |
| Accepted behavior contracts at final product source |266 PASS / 3 FAIL of 269; two new-entry art failures and the exact release holdback failure described above |
| Critical invariant areas after Education integration |74 PASS / 3 FAIL of 77; same three areas; the subsequent two hint-retirement lines received focused actual-handler coverage |
| Actual canonical Active Session API regression run |50 tests PASS, covering prescription/composition/zero-load behavior; local backend, not a claim of new live deployment |
| TypeScript, canonical keyboard ownership, modal inventory |PASS; 254 consumer import contracts; 68 modal classifications, 39 canonical owners, 3 embedded owners |
| Education actual provider callbacks |PASS for role/account persistence, Back/continue/finish/skip/replay; deliberate missing completion rejected; permitted/denied/in-flight prescription entry tested |
| Native OTA dependency compatibility |PASS for current2.1.0 / iOS build 28; not a Production3.0 native certification |
| Fresh iOS TestFlight-mode export |PASS;1014 asset entries, 1008 unique asset bytes, Hermes bundle12.7MB; not published |
| Protected art byte comparison |0 unauthorized missing protected assets;489 approved mapping/asset receipt entries present;0 missing approved mapped bytes;0 unapproved candidate/master leaks |
| Historical asset differences |47 already owner-authorized consolidation/audio differences recognized by the existing removal records; no new removal authorization was invented |
| Export bundle digest |`9cb05cbc804d914f305cc38c1670c62b83bb48ed073a333c1f79b635e240845e` |
| Exact current release gate |FAIL at stale Logger source-bound holdback; gates beyond this point did not pass |
| Strict canonical remote-lineage certificate |FAIL, local HEAD ahead of origin; independent canonical runtime observation retained separately |
| Horizontal layout audit |PASS,42 files / 7 sheet contracts/app roots |
| Minimum typography |FAIL at10 pt meaningful workspace text |
| Broad visual-literal / transparent-root audits |FAIL against historical policy/exception inventory; see interpretation below |
| Live recognition health, read-only |PASS serving source 751a1173 and exact-equipment policy v3; no deployment performed |

The broad visual checker reports158 literal/exception findings and6262 literals
over135 files. The transparent-root checker flags37 roots, including deliberate
OLED-black3.0 screens. These are policy/exception drift, not158 broken screens
or37 visually failed roots. Reconcile those checkers with established owner
design direction using reviewed evidence; do not use them to trigger an
unrequested wholesale redesign or simply widen exceptions to suppress failures.

Approval inventory and export receipt counts describe different scopes:
498 current governed definitions have approved bindings (including reused art),
while the retained approval/delivery receipt has489mapping/asset entries. The
artifact audit verifies all489protected receipt entries. Neither count excuses
the 499th new selectable definition's missing binding.

### Recognition and zero-load evidence

Actual local machine Set 20552 established 20 lb × 12 on movement 178 / equipment 641
(Other selectorized) with no recognition event. Actual Set 20553 then improved
that exact 12-rep bucket to 22.5 lb and persisted valid
`ACCESSORY_REP_MAX_PR` 1273, prior Set 20552, exact-equipment policy v3. This proves
baseline silence and improvement recognition in the exercised implementation.
Manufacturer isolation/replay/save/rest-hand-off contracts pass. The existing
metric is best load at exact completed rep count; no new PR metric was invented.

The transient celebration was not captured as visible/audio proof in this
sweep. Do not convert the persisted event or passing delivery contract into a
guarantee about a physical phone. Its actual new-native/device delivery remains
a required release check, especially given the prior owner incident.

Athlete Push-Up Set 20554 saved 0 kg × 5 @ 2 RIR, Save Changes succeeded at zero, and
the same editor reopened at 0 lb. The API reports the same Set 20554, canonical
movement 67, added-bodyweight load convention and source revision 1. This is a
local actual-UI/API check, supplemented by the accepted zero-load editor/API
contracts; no owner Session was touched.

### Polish that can wait for a later 3.0 refinement

- Wrong-role copy: Self-Coach preview says “Return to Coach Editor”; Coach's
  empty athlete conversation says “Start the conversation with your coach”.
  The observed return/navigation works; labels should become role-aware.
- Several evidence/relationship/Accessory screens expose engineering copy
  such as canonical scope, SetLog, verified subject, relationship number and
  reward governance. Shorter athlete/coach-facing copy would improve them.
- Assisted search tolerates the observed typo, but `lat pulldwn` ranks straight
  arm options above literal Lat Pulldown options. Improve directory-wide
  relevance; do not narrow the solution to the Cable Pullover alias.
- Settings uses older gray rounded sections beside the newer OLED/editorial
  screens. It is readable and operable; aesthetic refinement can follow 3.0.
- Athlete Education's captured illustrative screens should explicitly say
  Example, as the Self-Coach lessons now do. No sample values enter real history.
- Team Brief has a long technical metric title; Archive's decorative year is
  truncated although the actual date is visible. These are presentation polish.

### Coverage limits and follow-through

Not physically exercised here: Apple sign-in/sign-up/verification/password
recovery; purchase/restore/paywall/account entitlements; disconnected/retry
device journeys; media recording/upload/playback/review completion; push/
background sound; meet-packet populated scenarios; every variant/archive-detail
and Check-In submission; Android/tablet/compact phone/larger text. Aggregate
contracts provide adjacent coverage, not fresh device certification of those
states. No owner data, message, coach feedback, invite, account access, purchase
or Production runtime was changed.

Local QA changes retained: Self-Coach Session 1849 prescription/equipment and
Sets20552 / 20553; Athlete Session 1814 bodyweight Set 20554/save-at-zero; Coach 77
unassigned unscheduled Weekly Recovery Check-In form. No completed Session was
reopened or rewritten. Existing unrelated source/worktrees remain preserved;
no temporary worktree was created, so no shipped work is stranded in one.

Production GO requires the listed P1s closed with evidence, the cumulative
version-scoped candidate assembled, its gates green and the unobserved native
release checks completed. Design polish alone need not delay3.0. The Education
owner request is closed in canonical DEV; the readiness assessment is complete
with a NO-GO, and the listed unresolved release/product findings remain open.

## Owner steering — canonical Education integration

Owner: “ok well add the education to the canonical shit”. Integrate the existing
role-aware Education system and reviewed Self-Coach corrections into canonical
DEV before continuing the sweep. Preserve current canonical handlers and fixes;
transfer only Education dependencies and its bounded consumer wiring, never
the unrelated optional checkout. Verify introduction navigation, completion,
replay and account-scoped persistence in canonical runtime; run its role/state
suite and type checks. No publication is authorized by this steering.

## Subsequent owner-directed remediation

The owner subsequently requested every identified fix in canonical DEV, with
non-simulator validation continuing if the Mac locks. The bounded implementation,
validation results and remaining artwork/native certification gaps are recorded
in `MOBILE_3_READINESS_FIXES_2026-10-06.md`. This report remains the historical
audit; its initial source and failed evidence are not retroactively relabeled.
