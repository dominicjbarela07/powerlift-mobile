# Strength Ledger Mobile Engineering Guidance

Read the parent project's `AGENTS.md` and governing architecture before work.
Before any TestFlight/release operation, read and enforce
`docs/RELEASE_INVARIANTS.md`, which points to the single canonical constitution.
Run `npm run release:verify-testflight`. Use the guarded publisher/native wrapper;
never bypass failed gates or infer owner authorization. DEV must contain all valid
TestFlight state. Restore missing release state into DEV in the same workflow.

Explicit owner `unacceptable` means `OWNER NON-RECURRENCE DIRECTIVE`. Read the
UNACCEPTABLE section of the canonical `docs/RELEASE_INVARIANTS.md` and canonical
`docs/OWNER_NON_RECURRENCE_INCIDENTS.md` before addressing it: fix the failure
class, audit equivalents, retain and deliberately failure-test permanent guards,
record all seven closeout fields, and carry guards through releases. Known
equivalent failures or unknown counts prohibit closure. Recurrence is also a
release/process failure. Product decisions require owner approval; default NO.

For the October 4 imagery restoration, read
`docs/release/MOVEMENT_IMAGERY_RESTORATION_2026-10-04.md`. The owner selected the
valid immediately-pre-October-2 imagery baseline and prohibited simulator runs.
Keep every baseline image and the Accessory PR celebration fix. Preservation
requires no new approval; retain historical thumbnails on disk and do not invent
removal receipts. The guarded publisher verifies actual exported/served bytes.

Accessory PR owner policy: free-weight baseline recognition is allowed; a first
machine baseline must not celebrate. Machines require improvement over an exact
movement/reps baseline across all accepted SetLogs, brands and Other.
Read `../docs/ACCESSORY_PR_BACKEND_RELEASE.md` in canonical DEV and the release
constitution. Deploy required server changes by validated Production Git push;
verify the actual serving SHA, not just a mobile OTA. Read the constitution and
run both the save-API and mobile recognition regressions. Do not claim live PR
readiness from local tests or client publication alone.

Cable equipment owner law: brand selection finishes setup. Read canonical
`../docs/CABLE_BRAND_EQUIPMENT.md`; run the cable API and actual-handler regressions.
Preserve old typed cable evidence and compare it by canonical movement + brand.
Do not apply this simplification to non-cable machines or claim shipment without
the matching deployed backend and actual published update.

Canonical Logger zero-load law: zero is valid performed load when editing a
bodyweight set. Read `../docs/CANONICAL_LOGGER_ZERO_LOAD.md`; run both actual
editor-handler and edit-API regressions. Preserve the same set and its immutable
identity, reload/reopen zero correctly, and invalidate stale recognition.

Canonical Logger Option E owner direction: read `docs/LOGGER_OPTION_E.md`.
Use near-black material, a real cyan remaining-time ring, compact History and
precise green/violet state signals. Preserve art and all canonical mutations.
The October 5 Option E task explicitly requires actual simulator convergence
and a second screenshot pass; its publication scope cannot cover other changes.
