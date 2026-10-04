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
