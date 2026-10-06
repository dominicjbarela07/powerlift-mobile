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

## Accessory PR backend delivery — latest October 5 machine isolation correction

Machine PRs MUST NOT leak across manufacturers. Compare all eligible saved sets
for the exact movement/reps inside the same governed equipment configuration;
Other is separate. This latest owner directive supersedes earlier cross-brand
PR scope. First machine baselines stay quiet; free-weight first baseline
recognition remains allowed. Preserve existing brand-only Cable behavior within
a brand. Isolate comparison, record supersession, edits/rebuild and replay/
history/recap delivery. Deploy through guarded Production Git push and verify
exact live source, policy and schema; a client OTA alone proves no server delivery.
