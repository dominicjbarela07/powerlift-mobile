# Prescription persistence fix and compact logger controls

Owner request, October 5: saving EZ-Bar Curl from 6–10 to 8–12 reps closes the
editor but leaves the old prescription. Fix persistence/display and publish the
bug fix to TestFlight in this run. Separately, implement compact logger controls
in canonical DEV and leave the simulator open for owner review. The visual
changes require owner sign-off before a later TestFlight publication.

Acceptance criteria:

- A saved accessory rep-range change persists, appears immediately in the logger,
  survives reload/reopen, and preserves completed Sets and immutable identity.
- Retain the same authorization/version protections and adjacent Core edits.
- Validate the failure before repair and the real edit/save/reload path afterward.
- Publish only the functional fix cumulatively through the guarded TestFlight
  path; inspect the exact published artifact and verify canonical DEV contains it.
- In DEV, remove the full Equipment/Edit Prescription/Swap action row. Put an
  obvious edit icon beside Prescribed, place equipment swapping within Current
  Equipment, retain automatic equipment selection on first logging, and place
  self-coach movement swapping near movement identity without changing permissions.
- Validate real DEV screens/interactions, compare with the owner's references,
  correct the weakest visual areas, and capture a second pass.
- Leave the canonical simulator open with the revised logger for owner review.
- Do not publish the unapproved layout, change approved art, alter machine PR
  policy, lose valid subsequent fixes, or publish Production Mobile 2.0.2.

Source state before implementation: canonical backend `3065c0b6`, canonical
mobile `4286c8e7`, durable TestFlight `1fd43af9`. Existing pending backend changes
remain preserved. This task explicitly authorizes simulator validation, superseding
earlier task-specific no-simulator instructions for this work.

Status: FUNCTIONAL FIX LIVE; DEV UI READY FOR OWNER REVIEW.

The functional failure was a stale `performed_*` execution override after the
base prescription was saved. The backend now updates existing edited overrides,
without rewriting completed Sets or identity. The real pre-fix API failed reps,
Sets and RIR; the repair passes the full 12-test prescription suite and the
128-test guarded production candidate. Production source
`210559e431df3927ab7286f9d1c4e895129b6439` was pushed from the production repository
and is verified live. The existing published TestFlight client calls the repaired
endpoint; no new OTA/native artifact is required. Exact deployed source and
frozen 2.0.2 compatibility are retained in
`LOGGER_PRESCRIPTION_EXECUTION_FIX_2026-10-05.json`.

The actual canonical DEV simulator reproduces the owner's EZ-Bar Curl edit:
6–10 → 8–12 now appears immediately, remaining Set targets update, the completed
Set stays unchanged, and editor/Session reopen retains 8–12. New control
placement was checked on EZ-Bar Curl, Machine Lateral Raise and long-title
Single-Arm Machine High Row. Equipment Swap opens the canonical picker with
logged-Set protection; movement Swap opens the governed substitution picker;
first logging unconfigured Machine Pullover automatically opens equipment
selection. No permissions, mutation route, approved artwork or crops changed.

First-pass refinements clarified Swap movement, added a discreet equipment tap
boundary, and removed the unused tools-slot spacing. Second-pass real screenshots
and source hashes are retained in
`../validation/logger-compact-actions-2026-10-05/runtime-review.json`.
The iPhone Air review fixture is synthetic, on October 6 for direct Calendar
access; the revised high-row logger is left open for owner inspection.

DEV typecheck and focused adjacent contracts pass. The complete DEV contract run
initially found five failures: two obsolete placement/count harness assertions
were corrected and rerun successfully; two pre-existing overhead-press artwork
coverage gaps retain identical pre-task art/catalog bytes; the release projection
rejects the unapproved DEV UI source, as intended. No release pins were weakened
and no artwork was auto-approved. This is a DEV review, not a claim that a new
mobile release is authorized or all DEV readiness checks are green.

All 2,230 shipped asset/policy files remain byte-identical in canonical DEV.
The durable TestFlight UI and current OTA are unchanged. Only backend deployment
metadata, its receipt and the current API-suite coverage check were reconciled
there. No temporary product worktree was created or unique work deleted.
The visual update remains held for explicit owner sign-off before publication.

The final backend repair also covers previously failed Saves: the editor reads
the same live execution target as the logger, making reapplication a real change
instead of a silent no-op. Versioning includes base and execution state. A
deliberate API failure and actual simulator before/after/reopen proof are retained.

## Owner visual refinement — October 5, 22:32

Before implementation, the owner requested this quick DEV-only refinement:
remove the background/container around the Prescribed edit icon; put movement
Swap on the title line, rather than beside Set position, with the visible label
“Swap” and its icon; remove the Current Equipment Swap background/container.
Keep the existing edit, equipment, substitution callbacks and permissions,
approved imagery/crops, saved prescription repair, and all other layout behavior.
Refresh the actual canonical DEV simulator and leave it open for another visual
review. This does not authorize TestFlight publication of the pending layout.
Acceptance: all three changes visible, long title readable, no Set-line overlap,
existing controls functional, typecheck and focused existing contracts pass.

Refinement complete in canonical DEV: edit and equipment Swap are now unboxed
with opacity-only pressed feedback; movement Swap shares the title row and uses
“Swap” plus its icon. Actual edit, movement substitution, and equipment pickers
were opened and dismissed without changing the QA Session. The full long title
wraps without truncation or overlap. Both real screenshot passes were inspected;
typecheck and four focused existing contracts pass. Source hashes and final
proof: `../validation/logger-compact-actions-2026-10-05/plain-controls-title-swap-review.json`.
Simulator left open. Pending UI remains DEV-only for owner review. No backend,
TestFlight, asset, permission, or mutation changes in this refinement.

## Owner correction — inline title suffix, October 5, 22:38

The owner explicitly rejected the two-column title/Swap layout. Required DEV
result: movement Swap appears immediately after the title's last character in
the same flowing text, with its icon and short label. It must not reserve a
separate column or sit on the Set position line. Preserve unboxed prescription
edit/equipment Swap, canonical callbacks and permissions, and all approved art.
Verify the actual long-title simulator and leave it open; pending UI publication
remains unauthorized. This correction supersedes the prior title-row placement.

Inline correction complete: native title text now owns the full heading width;
Swap is an inline text suffix immediately after the last character, rather than
a separate flex column. Actual High Row now wraps to two lines with Swap after
“High Row”. Tapping that suffix opened the real governed substitution picker,
then dismissed without a mutation. Title collapse remains a separate text tap;
accessible activate/Swap actions are retained and exposed by the actual runtime.
Typecheck and the existing compact-control contract pass, including native text
flow placement and the canonical accessible callback. First/second real screens
were inspected; final simulator remains open. DEV-only; no TestFlight release.
Evidence: `../validation/logger-compact-actions-2026-10-05/inline-title-swap-review.json`.
