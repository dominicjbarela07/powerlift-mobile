# Android 3.0 compatibility / owner build handoff — October 13, 2026

Owner request: “I want an android compatability check for 3.0 then give me the build command if its good”.

Check the current Production candidate in `/Users/dominic/powerlifting_app/powerlift_mobile` against canonical DEV. Determine GO/NO-GO to start the owner-operated Android 3.0 build. Validate exact EAS profile/version/runtime/package/API, native configuration and dependencies, Android-specific platform paths, TypeScript, cumulative regressions, full approved artwork export and actual upload archive integrity/size. Retain exact evidence and any unresolved device/binary limitations. Provide the exact Android build command only if checks support GO.

Preserve approved original art/crops and mappings, manufacturer-isolated accessory PRs, quiet first machine baselines, free-weight policy, bodyweight zero-load, first-tap set save recovery, Session identity/persistence, search and cumulative fixes. Do not change backend or legacy Production 2.0.2, remap channels, build or submit a native binary, increment/reset remote versions, or change credentials. No simulator handoff is requested. The owner alone starts and monitors the build. No new temporary Git worktree is needed for this audit. Any test/device use must use DEV and fictional data; static production configuration may point to the actual live API.

Acceptance: source/configuration and Android export checks pass; required assets preserved; no deterministic Android build blocker; actual archive is below the enforced limit with runtime files byte-identical; regression results and actual native/device observations reported separately. An unbuilt signed binary and Play acceptance cannot be certified before the owner build.

Status: checks complete; **NO-GO**. See results and precise limitations below.

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
