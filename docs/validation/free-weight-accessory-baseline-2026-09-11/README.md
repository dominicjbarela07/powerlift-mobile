# Performing-athlete accessory baseline — DEV evidence

The final direction is an athlete **performing** the movement, per the user's clarification. Earlier equipment-only studies are superseded. Only the performing-athlete master is registered in the app.

## Native visual gate

All screenshots below were captured from the canonical mobile repository's literal `npm start` runtime, port 8081, iPhone 17 / iOS 26.2. Metro accepted the dirty working tree. [Startup receipt](canonical-metro-startup.txt).

The first performing-athlete pass showed the three weakest areas: the far shoe's tight edge clearance, a bright floor patch that competed with the action, and bright shoe soles that pulled attention below the weights. The final generated refinement increased framing clearance and subdued floor/sole lighting. The shared photographic frame also uses proportional corner radii so 42-point thumbnails preserve the footprint. The second pass was inspected against the source portrait and first pass; both dumbbells, the pressing pose and incline remained readable.

| Surface | Actual native evidence |
| --- | --- |
| First performing-athlete pass | [Logger](person-pass1-logger.png) |
| Final Logger plan: 120-point hero and 42-point thumbnail | [Second pass](person-pass2-logger.png) |
| Final expanded Logger: 48-point movement image | [Second pass](person-pass2-logger-expanded.png) |
| Final Session Workspace card | [Second pass](person-pass2-workspace.png) |
| Final movement search / selection | [Second pass](person-pass2-search.png) |
| Final exact Movement History: 86-point image | [Second pass](person-pass2-history.png) |

These are actual existing surfaces, not composed UI mockups. The inspected account is the authorized DEV coach viewing athlete 12's existing Session 1498 and exact MovementDefinition 33. Preview remained read-only; the editor remained Saved; no selection, prescription, substitution or SetLog was changed. Closing History returned to the same Session. Search visibly distinguishes the new reviewed catalog movement from the separately governed legacy Incline Dumbbell Press entry and adjacent curl/fly/machine movements, which keep existing artwork.

## Functional validation

- `npx tsc --noEmit`: passed.
- Targeted ESLint for the three changed TypeScript files: passed, no output/errors.
- Accepted behavior runner: **197/197 passed**; existing 49 historical quarantined harnesses remain excluded and unchanged. [Full log](accepted-contracts.log).
- `test-free-weight-accessory-artwork.mjs`: passed again after installing the final PNGs; covers the catalog entry, programmed/effective/performed/legacy identity, Logger subject normalization, swap-away protection, incomplete/conflicting identity denial, unrelated fallback, Core isolation, and both PNG dimensions.
- Existing canonical artwork, Logger canonical subject, individual-movement hard rule and Session Workspace artwork suites passed.
- [Actual local API identity proof](runtime-identity-proof.json): programmed and effective identities agree on ID 33 / `accessory_incline_dumbbell_bench_press`. No backend identity or historical evidence was rewritten.

No new behavior tests were needed for PNG pixel aesthetics; their acceptance evidence is the inspected native screenshot passes. The full accepted runner occurred before the final performer-only pixel refinement; the final refinement retained the same mapping and file dimensions and the focused guard was rerun.

## Architecture / adjacent coverage

**State touched:** movement-artwork subject resolution across programmed, effective, performed and resolved-legacy inputs. No account, relationship, entitlement or Session lifecycle transitions changed.

**Adjacent consumers:** Logger, Session Workspace/programming, movement search/selection, History and Ledger movement imagery. Core and unrelated accessory fallbacks remain intact. Aggregate anatomy is separate and its components were not changed.

**Regression basis:** shared canonical resolver/renderer, one exact catalog key, no display-name inference, fail-closed incomplete/conflicting subjects, 197 accepted contracts and native evidence on existing representative surfaces. No new artwork was assigned to neighboring movements.

## Files and scope

[Family style rules](../../FREE_WEIGHT_ACCESSORY_ART_BASELINE.md), [asset manifest](asset-manifest.json), [performer prompts](performing-athlete-prompts.json), [selected refinement](performing-athlete-final-prompt.txt).

`generation-prompts.json` and `final-refinement-prompt.txt` retain the superseded equipment-only exploration for provenance. They do not describe the selected master. Its screenshots were moved to local `artifacts/free-weight-accessory-baseline-2026-09-11/superseded-equipment-studies/`.

**NO TESTFLIGHT. NO PRODUCTION.** This work changes only canonical DEV artwork, its mapping, focused tests and documentation.
