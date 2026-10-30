# Mobile 3.0 Today and active Session Set edit — shipped October 30, 2026

The owner authorized release of the last two fixes after full validation.
Both repairs are published to the existing iOS 3.0.0 runtime on
`production-3-preparation`; the matching shared backend is live. This is a
JavaScript update for the existing build 35, with no native build or submission.

## Delivered behavior

Today uses request/focus ownership and cache revision checks. A departed or
older request cannot clear the active loading state, overwrite fresh data or
redirect the current screen. Real failures still expose Retry. Actual-route
tests cover roles, cold start, focus/resume, cache races and deliberately removed
ownership guards.

Editing a performed Set preserves its immutable ID, snapshots, zero load and
server revision. The server replays recognition with bounded history reads;
the client completes on an exact accepted acknowledgement and refreshes the
Session silently. Lost responses recover with the same revision and payload;
conflicting edits reject, failures retain drafts and dependent recognition is
invalidated even when acknowledging an already-applied edit. Actual endpoint
and handler tests cover these paths and deliberately restore the old failures.

## Exact delivery and verification

| Item | Verified value |
| --- | --- |
| Live backend source | `1ace1350e337d4474ba2be5cee37df76d88560ff` |
| Mobile source | `1767b1080df6af3eb8c6217349f587ca934aecb6` |
| Mobile group | `7a9477ad-481a-4e70-aed0-0effff7652c9` |
| Mobile update | `01a18d81-51fd-77b3-bdfc-6334c56fe0ee` |
| Runtime/platform | `3.0.0` / `ios` |
| Served bundle SHA-256 | `5355bb632a9cf63096ae6ac31f9bd57cf012d93d817ef6b5843d02ec87009ef8` |
| Product fingerprint | `d43c6a758f47a142567ab6afacb2f5499fd86997a4840b0bb9144e41a8344d9b` |
| Accepted contracts | 316/316 |
| Critical product areas | 91/91 |
| TypeScript | PASS |

The source-pinned Production gate passed frozen iOS/Android response parity,
the deliberate permission-breaking control, independent owner equipment policy,
rep-chain, Today/navigation, Archive and artwork checks. The exact clean
Production candidate also passed all four new edit API cases before its push.
Live recognition health reports the expected source, ready state, schema and
manufacturer-isolation policy.

The guarded mobile publisher passed mandatory source ancestry, DEV superset,
cumulative integrity, native graph, functional and actual export checks. Gate C
verified the served bundle against the validated bytes and the exact retained
asset inventory. An independent native-channel request selected the new update
and matched the bundle hash. Content-addressed image bytes were reused only
through the publisher's exact prior verified asset proof. Worktree closeout
completed for the durable registered release checkout; the two isolated active
optional-feature checkouts were assessed and preserved.

## Preserved state and limitations

The complete previously published 3.0 product, all 28 protected fixes, original
protected source/required-file pins, approved artwork/crops, native graph and
legacy 2.0.2 behavior remain protected. Exact before/after proofs add only the
two fixes and their safeguards. Unrelated DEV onboarding and existing Cable
holdbacks remain in DEV. The candidate descends canonical DEV and retains the
previous published source ancestry. Its source is saved on the remote release
branch and the exact update archive reference.

No simulator or physical-device session was performed. Source/endpoint tests,
publication, native-channel selection and served-artifact verification are
distinct from an observation on the owner's phone.

The separate pre-existing completed-duration test error also reproduces in the
clean Production candidate, matching the pre-fix failure already retained in
the edit investigation. It is not a passing check, is not caused by these two
repairs and is not silently added to their validated scope.

The first full mobile run passed 315 app contracts but failed temporary test
repository cleanup: asynchronous Git maintenance recreated `.git/objects/info/packs`
after deletion started. The unchanged lifecycle test reproduced the failure,
then passed with `gc.autoDetach=false` and `maintenance.autoDetach=false` scoped
to the release process. The complete guarded publisher was rerun successfully;
no assertion, protection pin or quarantine was weakened. All attempts and the
environment recovery record are retained.

A later pre-publication evidence check required the exact observed Retry button
label. The original report was retained unchanged and a clearly labeled UI
observation supplement was added. The completed app checks were not reused
across this metadata/source change: the full guarded publisher ran again.

## Evidence

Mobile source-bound publication proofs:
`config/testflight-release-reliability-20261030/runtime-3.0.0/`.
Matching backend gate and live health:
`config/testflight-release-reliability-20261030/backend-deployment.json`.
Exact deltas, immutable baseline map, owner instruction and guard reviews are
retained in the same config family. Backend durable release evidence:
`docs/validation/today-set-edit-release-2026-10-30/`.
The complete export is retained at
`.codex/release-artifacts/01a18d81-51fd-77b3-bdfc-6334c56fe0ee/validated-export/`.
