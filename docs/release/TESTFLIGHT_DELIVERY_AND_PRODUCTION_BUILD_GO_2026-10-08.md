# TestFlight delivered / Production 3 build GO — October 8, 2026

**GO to START the owner's Production 3.0 native build.** No native/EAS/Xcode build or store submission was initiated by Codex. This is build readiness, not certification of an unbuilt binary or permission to submit it.

Use `/Users/dominic/powerlifting_app/powerlift_mobile` and the `production3-preparation` profile. It resolves version/runtime `3.0.0`, channel `production-3-preparation`, the approved-art switches and the actual live API `https://app.strengthledger.fit`. The owner initiates and monitors the build.

## Delivered TestFlight

- iOS OTA update: `01a11d6d-cb22-756a-869e-4f7919bce0c4`.
- Update group: `f04dc0b5-d741-4075-a0e7-2705c0293f60`.
- Actual published source: `02b5e8cae883fc8115b07755484ee12679630265`.
- Runtime: `2.1.0`, compatible with existing iOS native build 28. No new TestFlight binary was built.
- An actual native-style update request to the project endpoint with iOS / runtime2.1.0 / channeltestflight selected this exact new update; channel delivery is verified independently of its permalink. Receipt: `config/testflight-release-published-20261008/client-channel.json`.
- Served launch bundle: `32450e18e6d3cc3da9dc84caa8553257c35f52bdf4707079a0a755922b5eac6c`; 31,927,247 bytes, identical to the validated export.
- Full served-byte audit: **998 asset entries / 992 unique assets; missing or corrupt: 0**. The launch bundle additionally contains all 17 original introduction PNG payloads, verified byte-for-byte with identical dimensions and unchanged screen layouts/behavior.
- Expo accepted 999 entries including the launch bundle, below its enforced 1,000-entry limit. The previous 1,016-entry rejection was resolved by lossless image packaging; no imagery was removed, resized, regenerated or replaced for this update.

## Final validation

| Requirement | Result |
| --- | --- |
| Automatically discovered accepted contracts | **275/275 PASS** |
| Critical product areas, including deliberate failure controls | **84/84 PASS** |
| TypeScript, source lineage, governed source/art/crop/catalog progression | PASS |
| Pre-October-2 delivered imagery | All 991 original unique asset hashes retained; zero missing mappings, missing bundled movement images, broken IDs or unexpected fallbacks |
| Current approved movement imagery | 490 mappings / 487 unique original approved images; zero missing on independent iOS and Android Production 3 exports |
| Canonical catalog | 499 active + 69 historical compatibility records; all 567 original IDs retained; approved OHP650 addition retained |
| Cumulative fixes | Accessory PR celebration/delivery, manufacturer/Other isolation, quiet first machine baselines, bodyweight zero-load edits, prescription mutation/persistence, Hot Swap, shared directory search, compact Logger/equipment/history controls, readiness and reviewed role-aware flow all covered by passing contracts |
| Actual live backend | Serving source `d4b6a8b22549a9853db71fbbd0485c708471519f`; readiness and equipment-isolated recognition policy verified after publication |
| Shared backend legacy compatibility | Exact deployed source passed frozen iOS/Android2.0.2 responses (104 each), independent owner-policy acceptance and deliberate permission-break rejection |
| TestFlight / Production candidate product equivalence | All 2,765 product files identical; fingerprint `01aafbeb24acec3875bf2bfccc95d76adea20d0c2966971dbda241416fdd42ba` |
| Independent Production 3 exports | iOS + Android: all approved movement images and all 17 original introduction images included; each 999 entries including launch |
| DEV superset / published state missing from DEV | Gate C PASS; missing: 0 |
| Protected Production2.0.2 | Actual channel mapping, update identities/source/runtime and fingerprints unchanged; legacy mobile main retained |
| Worktree closeout | Complete. Durable release checkout reused; no new temporary worktree and no unique owner work deleted. Independent unfinished worktrees preserved and assessed |

The current candidate retains already observed journeys under the owner's instruction not to repeat satisfactory screens. The source-bound check retains 32 actual journeys and the actual live-backend native preview, allowing only strictly verified lossless image transport. **No fresh 32-flow simulator run or new Production3 binary certification is claimed.** Existing native preview SecureStore proof is retained; the actual new signed binary must be checked after the owner's build.

The compatible shipped Cable implementation remains intact; the separate pending Cable backend/schema rollout remains held back. That pending feature is not represented as shipped. The 195 historic review thumbnails remain preserved in DEV and were absent from the authoritative pre-October-2 product baseline; they were not used as an approval blocker. Actual human OHP approval and Deficit Deadlift crop approval remain exact.

## Permanent release protection

Historical source/image/catalog/removal pins remain unchanged. Reviewed additions carry exact before/after patches and actual human art/crop receipts. Missing approved imagery, missing inclusion flags, altered canonical identity, hidden runtime/source changes, modified image payloads, incorrect image bindings, changed screen behavior and an over-limit OTA all fail validation. Negative controls deliberately reproduce these conditions. The new current/previous TestFlight identities and the exact served-byte/Gate C proofs are retained in canonical DEV; advancing the baseline requires those proofs and cannot authorize another candidate.

The last staging-only NO-GO is superseded for **starting this build**: the source/art/catalog reconciliation blockers are resolved and the complete current release passed. Store/customer/device certification follows the owner-operated build; it is not inferred from JavaScript exports or the repaired existing simulator shell.

Evidence: `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/testflight-current-2026-10-07/` (`publish-resumed.log`, `published-update.json`, `published-asset-byte-audit.json`, `resumed-prepublication-runtime.json`, `production3-final-art-audit.json`, `final-product-equivalence.json`, `production-legacy-channel-preservation.json`). Durable exact release export/Gate C/worktree proof: `/Users/dominic/powerlifting_app_dev/.codex/release-artifacts/01a11d6d-cb22-756a-869e-4f7919bce0c4/`.
