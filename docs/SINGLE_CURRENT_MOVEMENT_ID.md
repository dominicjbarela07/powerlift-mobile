# Single current Session movement identity

`WorkoutItem.movement_definition_id` is the sole authoritative **current** movement ID for Core and accessory Session items. Identity contract version 1 serializes that scalar and matching governed definition. A real authorized Swap X→Y changes this scalar to Y; X→X leaves its meaning, artwork, taxonomy, equipment and history subject unchanged.

## Field ownership

| Field | Role |
| --- | --- |
| WorkoutItem.movement_definition_id | Only current movement owner |
| movement_identity | Definition derived from current ID |
| effective_* and performed_canonical_* in current API | Compatibility aliases derived from current ID |
| core_movement_id and performed_core_movement | Typed Core projection of current general definition |
| performed_movement_definition_id when machine_equipment_* | Physical equipment/comparison context, not a movement |
| movement_provenance.original and transitions | Append-only original prescription and authorized transition audit |
| original_movement, selected_sub_movement, is_substituted, legacy resolution metadata | Historical/compatibility provenance, never current identity selectors |
| SetLog snapshots and historical reconciliation | Immutable performed evidence; not normalized as live Session rows |
| titles, muscles, taxonomy, art and anatomy | Presentation derived from current governed definition |

Initial GET and mutation replies use one backend serializer and one mobile Session normalization boundary. The old wire protocol is decoded once for the existing TestFlight API. After decoding, every mobile consumer sees the same current scalar. Matching-ID server metadata stays authoritative, with the bundled governed catalog supplying omitted metadata; catalog IDs never come from labels. Physical equipment cannot become the movement.

## Write boundaries

Programming Manager's governed Core picker sends both general and typed Core IDs. The integrated builder, Session Workspace authoring command, manual mobile create/edit, legacy web builder POST, reusable Core templates, copy/Session/Week/Block template instantiation and assignment persist a direct current ID. Typed competition codes SQ/BN/DL are explicit stable authoring protocols; Core variants require an explicit governed selection. Label-only variant submissions are rejected. Legacy free-text copies remain draft/unresolved when no explicit mapping exists. Coach/private identity authorization and first-SetLog substitution locks remain in place.

Session GET, Programming Manager GET and assignment-availability predicates no longer materialize movement IDs. Page loads also no longer reassign Session program membership or regenerate stored warmups. Existing explicit adoption/assignment and warmup-resume writes retain those responsibilities. Legacy migration and owner-confirmed resolution are explicit writes.

## Historical truth and reconciliation

Migration b8c0d2e4f6a8 adds the nullable JSON provenance column. Downgrade refuses to discard populated provenance. Original prescription and prior transition prefixes cannot be replaced through ORM writes. Same-ID selection adds no fabricated audit event. Copying starts a new prescription from the source's current movement and clears prior physical equipment.

The DEV-only reconciliation script accepts explicit performed IDs, owner-confirmed mappings, typed Core IDs and typed competition codes. It never infers identity from a movement label. It preserves all SetLog columns byte-for-byte under a sorted JSON checksum. An ambiguous legacy substitution cannot claim its old prescription as its current performed movement.

## Actual DEV evidence

- 8,336 Session items audited before/after; 7,629 initially lacked the direct current ID.
- No missing IDs among records marked by modern authoritative/copy/validated writers; 4,502 missing rows had no source marker, and 3,127 were marked unresolved free text. Their precise originating creation routes cannot be established from those records.
- 698 already had a deterministically usable direct ID; 69 governed private definitions occur in the governed population (overlapping category).
- Deterministic reconciliation filled 4,605 missing IDs, corrected 19 competing IDs and archived 9 ambiguous prescription-only IDs: 4,633 rows changed.
- 5,303 governed items now have direct current IDs. 3,033 genuinely ambiguous legacy items remain unresolved.
- Equivalent same-ID identity repair count: before **0**, after **0**. The original reported `?→same Swap→anatomy` bug was **not reproducible in the already-patched DEV baseline**. Do not claim a captured occurrence that does not exist.
- A separate old equivalent-Swap mobile diagnostic found 145 losses of equipment/history comparison context, not 145 artwork repairs. Current governed mobile comparison has 0 semantic differences and 0 unresolved art results.
- All 17,932 existing SetLogs are unchanged: SHA-256 `c8fb24667311e0fa0dc9316819002cbacb16a297a941fda844b6c54aaac36790`.
- Reconciliation is idempotent: second plan contains zero mutations.

## Structural cause and limits of proof

The retired storage contract let a prescribed ID coexist with performed and effective IDs. Swap could materialize those fields and clear equipment independently of initial hydration; consumers chose different fallbacks. Some GET paths also persisted mappings. This creates the structural asymmetry reported by the owner. Baseline actual-data serialization already contained earlier fixes, so its identity-repair count was zero. The pre-migration capture contains stored rows and identity envelopes, not a complete original failing API response. Post-change actual DEV Session 1754 has complete GET→same-ID POST→GET and normalized mobile captures demonstrating identical movement/art/history/equipment subjects.

## Validation and release boundary

Permanent tests cover stale aliases, null-overwrite prevention, append-only provenance, real Swap, same Swap, private Machine RDL, Pendulum Squat, Leg Press, Chest-Supported Machine Row, Machine Pullover, Machine Dip, free weights, cable, bodyweight, bands, Core and Core variants. They cover creation, assignment, copy, Session/Week/Block templates, initial hydration, lifecycle and frozen evidence. Mobile tests cover all 567 bundled definitions and all 5,303 governed DEV items. The actual Save handler makes no request for an unchanged same-ID selection. On older APIs, a same-ID prescription edit that clears equipment restores the previous explicit equipment selection; a failed restoration reports partial failure and requires equipment selection before logging. This older-API two-request path is not atomic; the new DEV backend preserves equipment within its single write.

The TestFlight app uses the existing shared Production API. There is no configured isolated backend deployment target. The backend migration/reconciliation and new persistence law are therefore DEV-only in this release; the compatible OTA supplies mobile normalization and same-ID no-op behavior against the old API. Production backend and Production mobile are not deployed. No new native build is authorized. Final live TestFlight verification belongs to the user.

Development ledger: Sep 16, 2026 06:45 PM PT (Sep 16, 2026 09:45 PM Eastern)
