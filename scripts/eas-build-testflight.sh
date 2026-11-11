#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_ROOT="/Users/dominic/powerlifting_app/powerlift_mobile_testflight"
readonly EXPECTED_API_BASE="https://app.strengthledger.fit"
readonly EXPECTED_PROJECT_ID="7afb1a4b-46b6-4295-b33f-816b05589e81"
readonly EXPECTED_BUNDLE_ID="com.dominicbarela.strengthcoachui"
readonly release_profile="${1:-testflight}"
if [[ "${release_profile}" != "testflight" && "${release_profile}" != "testflight31" ]]; then
  echo "Unknown guarded TestFlight profile: ${release_profile}" >&2
  exit 1
fi

actual_root="$(pwd -P)"
branch="$(git branch --show-current)"

if [[ "${actual_root}" != "${EXPECTED_ROOT}" ]]; then
  echo "Refusing to build outside ${EXPECTED_ROOT}." >&2
  exit 1
fi

if [[ "${branch}" != release/testflight/* ]]; then
  echo "Refusing to build from non-TestFlight release branch: ${branch}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to build from a dirty worktree." >&2
  git status --short >&2
  exit 1
fi

head_commit="$(git rev-parse HEAD)"
upstream_commit="$(git rev-parse '@{upstream}')"
if [[ "${head_commit}" != "${upstream_commit}" ]]; then
  echo "Refusing to build an unpushed TestFlight commit." >&2
  exit 1
fi

export EXPO_PUBLIC_API_BASE="${EXPECTED_API_BASE}"
export EXPO_PUBLIC_APPROVED_ART_CHANNEL="testflight"
export TESTFLIGHT_NATIVE_PROFILE="${release_profile}"
if [[ "${release_profile}" == "testflight31" ]]; then
  export STRENGTH_LEDGER_RELEASE_TARGET="testflight31"
  export EXPO_PUBLIC_ART_RUNTIME_VERSION="3.1.0"
fi

git fetch origin dev/canonical-mobile --quiet
# Mandatory: read and enforce backend docs/RELEASE_INVARIANTS.md.
node scripts/verify-testflight-release-integrity.mjs --gate-a-only
node scripts/test-release-source-lineage.mjs

node <<'NODE'
const profile = process.env.TESTFLIGHT_NATIVE_PROFILE;
const app = require('./app.config.js').expo;
const eas = require('./eas.json');
const failures = [];

if (app.extra?.eas?.projectId !== '7afb1a4b-46b6-4295-b33f-816b05589e81') failures.push('canonical EAS project ID');
if (app.ios?.bundleIdentifier !== 'com.dominicbarela.strengthcoachui') failures.push('canonical iOS bundle ID');
if (app.extra?.releaseTrack !== 'testflight') failures.push('explicit TestFlight release track');
if (profile === 'testflight31') {
  if (app.version !== '3.1.0' || app.runtimeVersion !== '3.1.0') failures.push('3.1.0 version and runtime');
  if (app.extra?.preparationTarget !== 'testflight31') failures.push('3.1 preparation target');
} else {
  if (app.runtimeVersion?.policy !== 'appVersion') failures.push('appVersion runtime policy');
  if (!/^2\.1\.\d+$/.test(String(app.version || ''))) failures.push('2.1.x app version');
}
const expectedChannel = profile === 'testflight31' ? 'testflight-3-1' : 'testflight';
if (eas.build?.[profile]?.channel !== expectedChannel) failures.push('profile build channel');
if (eas.build?.[profile]?.env?.EXPO_PUBLIC_API_BASE !== 'https://app.strengthledger.fit') failures.push('production API base');
if (eas.build?.[profile]?.ios?.distribution !== 'store') failures.push('App Store distribution');
if (eas.submit?.[profile]?.ios?.ascAppId !== '6756639297') failures.push('canonical App Store Connect app ID');

if (failures.length) {
  console.error(`Refusing to build: invalid ${failures.join(', ')}.`);
  process.exit(1);
}
NODE

node scripts/test-testflight-source-parity.mjs --release-projection .
release_export_dir="$(mktemp -d "${TMPDIR:-/tmp}/strength-ledger-testflight-native.XXXXXX")"
npx expo export --platform ios --output-dir "${release_export_dir}" --clear
node --input-type=module -e 'import {bindExportSource} from "./scripts/verify-testflight-release-integrity.mjs"; bindExportSource(process.cwd(),process.argv[1]);' "${release_export_dir}"
node scripts/assert-no-dev-artwork-export.mjs "${release_export_dir}"
node scripts/assert-ota-route-bundle.mjs "${release_export_dir}"
if [[ "${release_profile}" == "testflight31" ]]; then
  # The first 3.1 native binary establishes its runtime baseline. All source,
  # artifact and functional checks precede that owner-started compilation.
  npm run release:verify-testflight -- --source-only --candidate-root . \
    --export-dir "${release_export_dir}"
else
  npm run release:verify-testflight -- --export-dir "${release_export_dir}" \
    --runtime-receipt "${STRENGTH_LEDGER_RUNTIME_RECEIPT:?Actual runtime journey receipt is required}"
fi

echo "TestFlight native release candidate"
echo "  path: ${actual_root}"
echo "  branch: ${branch}"
echo "  commit: ${head_commit}"
echo "  profile: ${release_profile}"
echo "  release track: testflight"
echo "  API base: ${EXPO_PUBLIC_API_BASE}"
echo "  project ID: ${EXPECTED_PROJECT_ID}"
echo "  iOS bundle: ${EXPECTED_BUNDLE_ID}"

confirmation="${TESTFLIGHT_BUILD_CONFIRM:-}"
if [[ -z "${confirmation}" ]]; then
  read -r -p 'Type BUILD TESTFLIGHT to continue: ' confirmation
fi
if [[ "${confirmation}" != "BUILD TESTFLIGHT" ]]; then
  echo "Build cancelled." >&2
  exit 1
fi

if [[ "${release_profile}" == "testflight31" ]]; then
  npx eas-cli build --profile "${release_profile}" --platform ios --non-interactive
else
  npx eas-cli build --profile "${release_profile}" --platform ios --auto-submit --non-interactive
fi
