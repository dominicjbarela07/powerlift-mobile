# Bodyweight exact movement artwork — DEV review

Open [Bodyweight Accessories review queue](http://127.0.0.1:5000/dev/art-review?family=canonical_bodyweight_accessories&filter=pending)
and sign in as the DEV owner. One candidate at a time; Approve or Reject with a required
written reason. All files in this batch are candidates pending the owner's decision.

The immutable visual baseline is Incline Dumbbell Bench Press, ID 33,
`artwork-review/candidates/existing-33-e05a3bf38fa7/master.png`. Barbell Row ID 4 and
Barbell Bench Press ID 46 were additional style comparisons. The master, neutral key light,
restrained violet rim, charcoal wardrobe, realistic athlete and near-black rubber floor
guided every generation. None of those approved references was changed.

For Sternum Chin-Up (ID 186), the owner's
[pose reference](validation/bodyweight-art-2026-09-13/user-sternum-pose-reference.png)
governs the body shape. Allow the torso to bend and arch backward as the chest rises;
the pelvis and legs descend beneath it. Do not impose a rigid straight diagonal or
horizontal body line. Head extension following that arch is distinct from turning the
head sideways. Both hands must visibly grasp the same supported bar. Earlier failed
prompts remain historical evidence, not reusable instructions for this movement.

## September 13 owner rejection round 7

All 31 artwork replacements from `rejected-7.json` are pending at revision 715;
69 approved bodyweight images remain unchanged. Archer Row #152 was separately
retired from DEV discovery at the owner's explicit request, preserving history.
Sternum Chin-Up retains the corrected arched pose with a higher bar and visible
floor clearance. Exact notes, 41 generation attempts, ten withheld intermediate
versions, inspection sheets and validation are in the backend report at
`docs/validation/bodyweight-review-round-7-2026-09-13/README.md`.
The run ends when this queue is ready; no waiting for decisions or promotion.

## Data and presentation

- `artwork-review/review-state.json`: authoritative identity, generation/version,
  pending/approved/rejected state, exact reasons/tags and decision history.
- `artwork-review/candidates/<candidate_id>/`: immutable 1254 px master, 512 px app
  derivative and 192 px thumbnail. Pending candidates are not static runtime imports.
- `artwork-review/generation-attempts/bodyweight-2026-09-13/<movement_id>/`: original
  attempted generations; unsuccessful preflight attempts remain outside the human queue.
- `docs/validation/bodyweight-art-2026-09-13/`: exact prompts, setup briefs, inspected
  attempts, selection manifests and registration receipts.
- `artwork-review/exports/{rejected,approved,review-results}.json`: automatic durable
  decision exports. Rejected contains only the latest currently rejected versions.

Shared `lib/movement-artwork-geometry.mjs` owns hero and thumbnail geometry for both
mobile and the protected DEV web preview. Complete presentation metadata is stored with
each candidate. Full-image thumbnail containment preserves hands, feet and essential
hardware; hero focal/scale/bias are available without screen-specific corrections.
The existing presets remain unchanged for prior approved art.

## Generation → review → regeneration

1. Read the backend governing architecture and `docs/DEV_MOVEMENT_ART_REVIEW.md`.
2. Resolve the active global governed ID/key and complete taxonomy. Do not derive an
   identity from a label. Resolve catalog ambiguity before generating that identity.
3. Generate candidates using the unchanged approved master. Inspect full resolution,
   grips, joint positions, real equipment geometry and contact points, plus thumbnails.
   Keep failed preflight attempts outside the queue. No automatic quality check is approval.
4. Register the credible candidate as pending through the existing DEV registration tool.
   Stop and let the owner review it in the web queue.
5. Read the latest `rejected.json`; carry forward the exact reason, tags and prior notes.
   Regenerate only the latest rejected version. Approved art remains locked unless the
   human explicitly reopens it. Do not replace pending candidates.
6. Register corrected pixels with a new generation ID, `supersedes_candidate_id` and
   current `expected_revision`. Preserve the prior candidate and written history. The
   replacement returns to pending and cannot inherit approval.
7. Only after human approval, use the guarded promotion plan. New IDs require explicit
   governed registry integration from the approved export; the normal exact resolver
   consumes that mapping. Human receipt and all image hashes must agree. Approval or
   file existence alone never authorizes different bytes or a release.

DEV ONLY. No automatic approval, TestFlight publication or Production change.
The backend report contains the complete 106-record inventory, identity holds, full
mechanical attempt ledger, automated checks and preservation hashes.
