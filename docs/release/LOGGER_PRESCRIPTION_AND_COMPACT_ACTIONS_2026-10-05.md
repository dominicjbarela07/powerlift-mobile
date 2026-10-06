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
Sets and RIR; the repair passes the full 11-test prescription suite and the
127-test guarded production candidate. Production source
`f1a4a628ba3fe4a456ef249c6cd9acdda4767397` was pushed from the production repository
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
