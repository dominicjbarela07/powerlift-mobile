# Human movement artwork review

Open http://127.0.0.1:5000/dev/art-review and sign in with the DEV owner account.
Approve or Reject with a required written reason. Decisions and exports save automatically.

Authoritative workflow: backend `docs/DEV_MOVEMENT_ART_REVIEW.md`.

- `review-state.json`: authoritative versions and decision history.
- `exports/rejected.json`: regenerate only these latest rejected candidates using exact reasons.
- `exports/review-results.json`: approved/rejected/pending status and history.
- `exports/approved.json`: human-approved mapping eligibility.
- `candidates/`: immutable per-version images; never overwrite them.
- `runtime-policy.json`: generated DEV rendering policy; never edit manually.

Codex registers candidates pending and stops for the human. There is no automated
approval and no CLI approve command. Approved items remain locked until human
reopen. New versions never inherit approval. Existing DEV preservation receipts
authorize only the exact pre-gate bytes, not new artwork.

Use the backend `scripts/movement_art_review.py` for registration, exports, promotion
plans and guarded promotion. Do not run the historical materializers or copy new
images directly into the canonical asset directory. Commit this folder's state,
exports and immutable candidates together with any approved mapping changes.

DEV ONLY. NO TESTFLIGHT. NO PRODUCTION.
