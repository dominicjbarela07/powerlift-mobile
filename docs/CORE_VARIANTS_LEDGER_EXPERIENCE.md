# Core Variants Ledger Experience

## Product contract

The Ledger's Variants chapter is an exact record of supplemental Squat, Bench
Press, and Deadlift movements. The primary surface is one continuous chapter:

1. current rotation grouped by parent Core lift;
2. Core lift family summaries;
3. variants with qualified comparable progress;
4. exact-variant exposure across training blocks; and
5. the active and historical variant record.

There is no muscle-group mode and no top-level Overview / By Muscle / History
tab shell. Family and exact-variant routes are contextual drill-downs, not
parallel primary destinations.

## Evidence contract

Membership is resolved only from a governed `CoreMovementDefinition` with
`kind=variant` and the exact immutable performed Core movement identity on its
source sets. Display names, aliases, broad movement families, and Competition
movement rows cannot establish membership.

Progress is literal and exact-task scoped:

- more load at the same reps;
- more reps at the same load; or
- lower RPE / higher RIR at the same load and reps.

The representative comparison set is the heaviest performed set in each
Session. Weight-on-the-bar and rep-strength views use recorded loads, not a
formula. Performed volume is recorded load × reps. Competition-lift evidence
remains separate and no carryover claim is made.

## DEV data

From the backend root, `python scripts/seed_core_variants_dev.py` seeds the
canonical DEV athlete for `user_id=1`. It refuses non-DEV databases, stores
canonical kilograms, uses governed Core IDs, and captures immutable performed
identity snapshots. Re-running is a no-op; `--reset` safely deletes only rows
owned by the `DEV_CORE_VARIANTS_LEDGER_V1` marker and rebuilds them.

## Visual acceptance

Variants uses the approved `ledger-chapter-variants-v1.png` specialty-bar asset
and the canonical exact Core-movement artwork resolver. A material UI change is
not complete until the canonical `npm start` runtime has been captured twice:
first to identify the three weakest visual areas, then after those weaknesses
are corrected. This is governed by the repository Visual Convergence Handoff
Gate.
