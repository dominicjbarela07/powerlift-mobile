# Set-entry video — DEV review, October 14, 2026

Status: implemented in canonical DEV; owner signoff pending. Not published.

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
