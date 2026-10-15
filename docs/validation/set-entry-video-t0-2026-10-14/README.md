# Set-entry video — DEV review, October 14, 2026

Current status: owner-approved and published/verified on iOS 3.0.0 and 2.1.0.
The DEV review notes below retain the initial handoff history; shipment is recorded
at the end of this document.

The canonical Set input now accepts a selected clip. A clip uploads only after
its Set is accepted, so it attaches to the correct persisted SetLog. Selected,
queued, uploading with acknowledged progress, confirmed uploaded, and failed
with retry have distinct states. Confirmed videos have View. Upload failure does
not ask the user to save the Set again or remove the local clip.

## Focused evidence

- `node scripts/test-set-entry-video.mjs`: PASS. Actual Core handlers (straight,
  top, backdown, full custom), accessory handler, grouped response association,
  queue progress/confirmation/retry/account ownership and actual shared controls.
- `node scripts/test-session-execution-ownership.mjs`: PASS.
- `node scripts/test-repeat-last-set.mjs`: PASS.
- `node scripts/assert-video-upload-policy.js`: PASS.
- Final TypeScript check: exit 0, no diagnostics.
- Old actual Core handler deliberately fails selected-video preservation:
  PASS. Invalid, processing and wrong-Set upload receipts are rejected.

The initial new-test run exposed a test fixture file-URI mismatch; the fixture
was corrected and the final focused run passed. No product workaround was made
to satisfy that fixture. Existing unaffected release suites were not repeated.

## Real mobile evidence

Canonical `npm start`, Expo Go on iPhone Air, API http://127.0.0.1:5002, local
strength_ledger_dev database. Fictional Alex self-coach QA, athlete 72, Session
2212. No customer or Production data was written.

- Bench Core SetLog 22862 → uploaded attachment 719, one attachment, exact playback.
- EZ-Bar Curl accessory SetLog 22863 → uploaded attachment 720, one attachment,
  exact playback.
- Final owner handoff: accessory Set 2 input open with a selected test clip,
  Change/remove available and Log Set ready. Set 2 has not been submitted.

| Proof | Screenshot |
| --- | --- |
| Core Add video | 01-core-add-video.png |
| First selected Core clip | 02-core-video-selected.png |
| Confirmed Core upload | 03-video-uploaded.png |
| Exact Core Set playback | 04-exact-set-playback.png |
| Refined accessory selected clip | 05-accessory-selected-final.png |
| Confirmed accessory upload | 06-accessory-uploaded-final.png |
| Exact accessory Set playback | 07-accessory-playback.png |
| Owner review ready, accessory Set 2 | 08-owner-review-ready.png |

The first-pass visual weaknesses were discoverability, compact saved-row status
and touch area, and selected-clip change feedback. The second pass corrected
these with a shared Add video row, visible status/action, larger video target,
explicit Change, and pressed/disabled feedback. Native screenshots were inspected
after correction. No movement artwork, native dependencies or backend code changed.

Observed native runtime coverage is self-coach/iPhone Air. Coached archive/review
intent and grouped Set association have executable coverage. This is not a claim
of physical-phone, Android native, or every-role runtime observation.

## Follow-up: selected video preview before submission

The selected thumbnail/play badge and Preview video label open the local clip
with native playback controls. Change and remove remain separate actions.
Preview is explicitly Not uploaded yet; Back to set closes/stops playback and
preserves the selected clip, review intent and Set entries. It has no upload or
Set mutation dependencies. The shared control covers the same three input
surfaces; the existing server attachment player is not used for an unsaved clip.

Validation on the follow-up source:

- `node scripts/test-selected-set-video-preview.mjs`: PASS. Actual attachment and
  preview components; local URI, native controls, close/pause, unchanged clip and
  review choice, Change/remove, no clip, changed/removed clip, loading/error and
  system back.
- `node scripts/test-set-entry-video.mjs`: PASS with the new component dependency.
- `./node_modules/.bin/tsc --noEmit`: exit 0, no diagnostics.
- Previously passing unchanged upload queue, submit handlers and ownership
  evidence above was retained rather than running release suites again.

Actual iPhone Air: tapped Preview video before submitting accessory Set 2,
observed local playback with native controls/timecode, then Back to set. The
Session remained at 2/6 saved Sets, the clip remained selected, and the fields
remained 0 lb × 12 @ 2 RIR. Set 2 was not submitted. DEV backend/runtime stayed
local; no TestFlight/Production promotion occurred.

Visual weaknesses in the original selected-clip state (08) were no playback
entrypoint, an inert thumbnail, and no pre-submission player distinguishing a
local selection from a server-confirmed attachment. The Preview video action,
44-point play thumbnail and dedicated local-only player correct these. The new
screenshots were inspected for fit, preserved entries and safe return:

| Proof | Screenshot |
| --- | --- |
| Preview entrypoint | 09-preview-entry-first.png |
| Local selected-clip playback | 10-local-preview-first.png |
| Second pass native playback controls | 11-local-preview-controls.png |
| Back to unchanged Set, ready for owner | 12-preview-return-ready.png |

State machine extension: selected draft ↔ local preview, before the existing
Set-acceptance/upload flow. Adjacent native player lifecycle and sheet navigation
were exercised; upload/Set persistence, consent and archive/review policy were
not changed. Native observation remains self-coach/iPhone Air. Owner signoff is
still pending.

## Approved shipment

Owner: “Good, please ship it. Don't waste time running a fucking full validation
for 2.1 if it passes for 3.0, just upload it. Ship it for 3. Fuck. If the validation
passes for 3.0, ship it for both 3.0 and 2.1, please.”

- 3.0.0: update `01a13d2c-8c91-7687-96e3-2ba465674315`, group
  `02677ef0-0071-4eeb-bf08-631444042402`.
- 2.1.0: update `01a13d2f-e54b-719a-8007-c874adf52e12`, group
  `4286ad03-f8b3-45f9-b940-f4c31bcec18c`.
- Exact shared published source: `afacf93e9fc72d2657767757edf25bc0f5a32b53`.
- Both served bundles equal their inspected runtime-specific exports; both native
  channel requests select the exact new update. Gate C and durable-worktree
  closeout passed for each; published product state missing from DEV: zero.
- Final accepted contracts: 287/287; critical release checks and TypeScript pass.
  2.1 reused the exact passing shared receipt: neither full suite ran on 2.1.
  Target-specific native compatibility, exports and publication checks ran.
- The unchanged 998 asset entries / 992 unique hashes reused retained verified
  content-addressed bytes; no second full asset download. Missing/corrupt: zero.

Initial release checks caught missing exact style registrations and an older
runtime-proof test that did not recognize the new mutation scope. The approved
values and native modal owner were registered, and the test now rejects old or
relabelled observations for this scope. Actual color/root/inset negative controls
passed; no runtime product code was changed to suppress a failure.

Expo export --clear deleted a pre-export validation receipt. The actual passing
result was retained from successful output, unchanged source/test/backend inputs
and the bound export; 2.1 reused it. The publisher now rechecks and writes the
receipt after export. Its actual export-block regression reproduces the original
deletion and rejects changed inputs. This post-publication tooling repair changes
no shipped runtime code and required only its focused regression.

Portable source/artifact/channel/contract/imagery/shared-validation proofs are in
`config/testflight-release-set-video-20261014/`. No native build or backend
deployment was started. The live server's existing completion response fields
were checked against its serving source `6e3973fb17293bc37155cfbc74a5ac27c5578519`.
No new owner-phone behavior was observed or claimed.
