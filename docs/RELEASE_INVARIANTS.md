# Strength Ledger Release Invariants — authoritative document

Before any TestFlight/release operation, read and enforce the canonical backend
document: `/Users/dominic/powerlifting_app_dev/docs/RELEASE_INVARIANTS.md`.

The tracked canonical source is
[Strength-Ledger-Dev / docs/RELEASE_INVARIANTS.md](https://github.com/dominicjbarela07/Strength-Ledger-Dev/blob/dev/canonical-backend/docs/RELEASE_INVARIANTS.md).
This file is a pointer, not a second constitution. Release verification reads
and checks the authoritative document through `STRENGTH_LEDGER_BACKEND_ROOT`.

The governing relationships are `DEV ⊇ TESTFLIGHT`, cumulative TestFlight,
explicit owner removals only, and same-workflow back-propagation. Run
`npm run release:verify-testflight` and use the guarded publisher/native wrapper.
Missing valid TestFlight state in DEV blocks release and must flow TestFlight → DEV.

Worktree lifecycle: read the Worktree Lifecycle Law in the authoritative
`docs/RELEASE_INVARIANTS.md`. Dirty canonical DEV is expected. Register justified
isolation, reconcile all valid state, assess active worktrees, and close completed
temporary worktrees in the same release workflow. Inspect with
`python3 /Users/dominic/powerlifting_app_dev/scripts/worktree_lifecycle.py inventory`
and check an exact worktree with `npm run worktree:check -- --worktree <path>`.

Explicit owner `unacceptable` means `OWNER NON-RECURRENCE DIRECTIVE`. Read the
UNACCEPTABLE section of the canonical `docs/RELEASE_INVARIANTS.md` and canonical
`docs/OWNER_NON_RECURRENCE_INCIDENTS.md` before addressing it: fix the failure
class, audit equivalents, retain and deliberately failure-test permanent guards,
record all seven closeout fields, and carry guards through releases. Known
equivalent failures or unknown counts prohibit closure. Recurrence is also a
release/process failure. Product decisions require owner approval; default NO.

## Accessory PR backend delivery — October 5 owner correction

Accessory PR compares all accepted sets for the exact governed movement across
brands and Other, retaining exact completed rep-count buckets. First machine
baselines stay quiet; free-weight baseline recognition remains allowed. See
canonical DEV `../docs/ACCESSORY_PR_BACKEND_RELEASE.md` and its authoritative
release constitution. Required server changes ship by validated Git push from
the Production repository to SCUI/main, with the exact-source frozen 2.0.2
compatibility push guard and live serving-SHA/schema verification. A mobile OTA
or local regression pass cannot establish server delivery.
