# Android 3.0 compatibility / owner build handoff — October 13, 2026

Owner request: “I want an android compatability check for 3.0 then give me the build command if its good”.

Check the current Production candidate in `/Users/dominic/powerlifting_app/powerlift_mobile` against canonical DEV. Determine GO/NO-GO to start the owner-operated Android 3.0 build. Validate exact EAS profile/version/runtime/package/API, native configuration and dependencies, Android-specific platform paths, TypeScript, cumulative regressions, full approved artwork export and actual upload archive integrity/size. Retain exact evidence and any unresolved device/binary limitations. Provide the exact Android build command only if checks support GO.

Preserve approved original art/crops and mappings, manufacturer-isolated accessory PRs, quiet first machine baselines, free-weight policy, bodyweight zero-load, first-tap set save recovery, Session identity/persistence, search and cumulative fixes. Do not change backend or legacy Production 2.0.2, remap channels, build or submit a native binary, increment/reset remote versions, or change credentials. No simulator handoff is requested. The owner alone starts and monitors the build. No new temporary Git worktree is needed for this audit. Any test/device use must use DEV and fictional data; static production configuration may point to the actual live API.

Acceptance: source/configuration and Android export checks pass; required assets preserved; no deterministic Android build blocker; actual archive is below the enforced limit with runtime files byte-identical; regression results and actual native/device observations reported separately. An unbuilt signed binary and Play acceptance cannot be certified before the owner build.

Current status: **GO to start the owner-operated Android 3.0 build** after the Firebase correction below. The initial NO-GO and its evidence remain as history.

## Result: NO-GO for the Production Android build

The code bundles and native preparation succeeds, but Android remote push is not configured. The current candidate has no `expo.android.googleServicesFile`, no Firebase Android config in the generated app, no Google Services Gradle plugin, and no `google_app_id` resources. The app's existing push registration calls FirebaseMessaging through Expo Notifications; native initialization cannot succeed without those inputs. The registration exception is caught, so this is a missing notification capability rather than proof of an app-start crash.

Required correction: use the owner's Firebase Android app configuration for **com.strengthledger.app**, verify matching EAS FCM v1 sending credentials, and regenerate/recheck the native inputs. No Firebase project, identifiers, account access or credentials were invented. No Android build command is presented as approved while this deterministic gap remains.

## Completed checks

- Production candidate source `f47b5a0b`; version/runtime **3.0.0**, package **com.strengthledger.app**, channel **production-3-preparation**, live API **https://app.strengthledger.fit**. Remote Android version code **12** was read only; automatic increment remains enabled for the owner build.
- TypeScript, full Android Hermes export, native Android prebuild, 34 Expo modules and 11 React Native module autolinking checks passed. Generated native version/package/runtime were inspected. Android 7+ (minimum API 24), target/compile API 36, Hermes, New Architecture and edge-to-edge retained.
- iOS-only Apple authentication availability, native Liquid Glass and SF Symbol paths have Android availability handling/material/icon fallbacks. Android notification channel initialization precedes permission/token requests. Native SecureStore backup rules and keyboard resize configuration are present. These are source/generated-input observations, not real-device execution proof.
- Actual fresh Android export: **998 asset entries**, **490 approved movement mappings / 487 unique original approved movement images**, plus 3 equipment-category images. Missing approved assets **0**; pending/rejected art **0**. Original assets/crops/mappings were not changed.
- Candidate and governed TestFlight projection match across **2,766 product files**, fingerprint `eb0157e764eac8b17b87ebc69d6417e0b88a1a05a165cf014489af131e88227a`. DEV superset Gate A passed; this is explicitly a partial source preparation check, not publication authorization.
- Cumulative regressions on that exact product-equivalent TestFlight projection: **277/277 accepted contracts** and **86/86 critical areas PASS**, including negative controls. The direct Production-root runs retain two failures apiece because the existing harness only accepts missing development labs in the TestFlight projection. Those historical harness failures were not weakened, ignored or relabeled as Production-root passes.
- Actual default Git EAS archive stage and compressed EAS tarball independently inspected. Compressed size **1,601,832,150 bytes** under the **2,000,000,000-byte** limit. **3,194 required inputs**, including **2,249 asset files**, byte-identical; missing/changed **0**; Git/review-output payload absent. The earlier no-VCS inspection was superseded by the default Git inspection and actual Git tarball. Neither inspection starts a native build.

## Advisories and remaining certification

Expo Doctor: **16/18 checks passed**. Warnings concern static/dynamic configuration detection and four newly recommended SDK patch versions: Expo 54.0.37, Constants 18.0.14, FileSystem 19.0.24 and Updates 29.0.20. Existing pinned versions remain unchanged; actual resolved config/native outputs were inspected rather than deleting protected configuration or adding suppressions.

The exported runtime alone is 486,247,317 raw bytes / 470,174,621 bytes in a ZIP compression probe. Google's current base-module compressed download limit is 500 MB; this probe does not include all native code/resources and is not Play's per-device calculation. Inspect the actual owner-built signed AAB with bundletool/Play before submission. No approved image was removed, resized, recompressed or replaced to reduce size.

The stack and native configuration were checked for API 36 and 16 KB support. Actual compiled ELF/ZIP alignment, signed-binary boot/login, Android system-back/keyboard behavior, set logging, media and remote push delivery remain unobserved until the owner supplies the signed Android build. No native build, emulator run, submission, channel remap, live-backend mutation, remote version mutation or credential change occurred.

## State-machine / workflow closeout

- State machine touched: none changed; inspected native release configuration, auth availability and notification registration.
- Adjacent systems assessed: SDK/native module compatibility, API/environment resolution, authentication, Session mutation/history/PR contracts, artwork bundling, local credential backup, media permissions and push.
- Existing workflows validated: cumulative functional contracts and their negative controls in the exact equivalent governed projection; actual Android export/prebuild/config/autolinking and archive-byte validation. No real Android device workflow is claimed.
- Regression confidence: all 2,766 product files remain unchanged; preserved guards/pins, original assets and legacy Production 2.0.2; no dependency upgrade or backend change. Full compatibility is **not** asserted because Firebase native configuration is missing.

Evidence directory: `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/android-3-compatibility-2026-10-13/`; machine summary `compatibility-report.json`, full positive/failed logs, generated native project, exact export, archive directory and tarball byte proofs. This record is retained in canonical DEV and Production. No temporary Git worktree was created.

Primary references checked October 13, 2026:

- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://developer.android.com/google/play/requirements/target-sdk
- https://support.google.com/googleplay/android-developer/answer/9859372?hl=en
- https://expo.dev/changelog/sdk-54
- https://developer.android.com/guide/practices/page-sizes

## Owner-authorized Firebase correction — acceptance

Owner confirmation: “Config downloaded, Expo credential saved. It is the most recent in my downloads folder”. Located `/Users/dominic/Downloads/google-services.json`; this is the public Android config for `com.strengthledger.app`, Firebase project `strength-ledger-50698`, and contains no private key. Its exact source hash is retained in the follow-up evidence.

Implement the native Android config connection in canonical DEV and the Production 3 candidate; preserve legacy/native iOS behavior and all approved assets, original gates, cumulative product fixes and owner-operated build authority. Verify only non-secret EAS FCM v1 credential metadata against the owner config. Do not retrieve or commit the private sending key. Regenerate Android native inputs, deliberately reproduce a missing-config failure, rerun the Android export/art/type/functional and actual upload-byte checks, then give the owner the build command if build readiness passes. No build or submission is authorized.

Follow-up evidence: `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/android-3-fcm-2026-10-13/`.

## Firebase correction completed — GO to start the owner’s Android 3.0 build

This supersedes the initial Firebase NO-GO **for starting the build**. The owner supplied the public Android config, then explicitly authorized direct upload of the matching downloaded private sending key into this app’s FCM V1 slot. Firebase project: `strength-ledger-50698`; Android package: `com.strengthledger.app`; Expo project: `7afb1a4b-46b6-4295-b33f-816b05589e81` / `@dominicjbarela07/powerlift_mobile`.

Changes retained in canonical DEV and Production:

- `config/android/google-services.json`: exact owner-provided public config, SHA-256 `0b315eb3fb3be9513a42b1c2140245c0d670909208628db0152fffa35906f994`.
- `app.config.js`: connect `android.googleServicesFile` only inside the existing Production 3 target. Exact before/after configuration comparison proves default/legacy configuration, iOS Production 3 native settings and other build-profile fields unchanged. Expo’s existing built-in Android plugins generate the Google Services Gradle wiring; no iOS notification plugin or new dependency was added.
- EAS: uploaded the owner-authorized matching service-account key and assigned it to `googleServiceAccountKeyForFcmV1` for this Android app. An independent fresh metadata query confirms exact key ID/project/key-identifier assignment. The old `strength-ledger` credential remains intact. Private key contents were transmitted directly to Expo, never printed, copied into the repository or included in any build archive.

Validation after the correction:

- Android native prebuild succeeds. `android/app/google-services.json` matches the owner file byte for byte; Google Services classpath/application plugin present. Removing the source config in the isolated preparation directory deliberately fails actual Expo prebuild with exit 1. Restoring it succeeds with exit 0. Existing Expo native preparation therefore blocks a missing configured Firebase input.
- Fresh Android Hermes export and TypeScript pass. All 490 approved mappings / 487 unique original movement images and three equipment-category assets pass the complete export audit. All 998 exported asset entries match the pre-fix export byte for byte. The bundle hash differs and is retained in `export-byte-preservation.json`; byte identity is not claimed for the bundle after changing native Expo configuration.
- All 2,766 existing TestFlight product files remain byte-identical in the candidate. The only new product-inventory entry is the public native Firebase config. Canonical DEV has identical new configuration and retains its three already-governed Cable holdback differences. Gate A passes; no valid TestFlight state was removed from DEV or candidate.
- Final serial governed application acceptance: **277/277 PASS**, **86/86 critical areas PASS**. The initial concurrent accepted-suite run failed the release-gate fixture without diagnostic output; its harness has a 30-second limit, but the precise cause was not captured. The isolated failure controls and subsequent full serial unmodified accepted suite pass. No timeout, quarantine, guard, pin or assertion was changed.
- Production 3 art policy and native upload policy, including their deliberate failure contracts, pass. Actual fresh EAS Git archive and compressed tarball preserve **3,195 required inputs / 2,249 asset files**, missing/changed **0**. Compressed upload: **1,601,835,999 bytes**, below the 2-billion-byte limit. Public Firebase config included; private sending key absent.

The remaining signed-binary/device/16 KB/Play-size checks stated above still apply after the owner build. No native build, store submission, backend deployment, legacy Production 2.0.2 channel/runtime mutation or temporary Git worktree occurred. Remote build/version counters were not changed by Codex.

Native push configuration is the only behavior-adjacent change. Auth, account readiness, relationship/entitlement policy and Session mutation implementation are unchanged. Adjacent SDK/storage/media/notification paths were assessed; preserved application workflows pass their existing contracts. Actual Android notification delivery is not claimed before a signed device build.

Owner command, from `/Users/dominic/powerlifting_app/powerlift_mobile`:

```sh
eas build --platform android --profile production3-preparation
```

The owner alone starts and monitors the build. Final receipts and complete proof remain in `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/android-3-fcm-2026-10-13/`, particularly `compatibility-final.json`, `native-fcm-proof.json`, `eas-fcm-assignment-receipt.json`, `product-preservation.json`, full accepted/critical logs, archive-byte proof and export audit.
