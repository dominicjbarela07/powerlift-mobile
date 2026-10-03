# Strength Ledger Mobile Engineering Guidance

Read the parent project's `AGENTS.md` and governing architecture before work.
Before any TestFlight/release operation, read and enforce
`docs/RELEASE_INVARIANTS.md`, which points to the single canonical constitution.
Run `npm run release:verify-testflight`. Use the guarded publisher/native wrapper;
never bypass failed gates or infer owner authorization. DEV must contain all valid
TestFlight state. Restore missing release state into DEV in the same workflow.
