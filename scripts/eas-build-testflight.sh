#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_ROOT="/Users/dominic/powerlifting_app/powerlift_mobile_testflight"
readonly EXPECTED_API_BASE="https://app.strengthledger.fit"
readonly EXPECTED_PROJECT_ID="7afb1a4b-46b6-4295-b33f-816b05589e81"
readonly EXPECTED_BUNDLE_ID="com.dominicbarela.strengthcoachui"

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

node <<'NODE'
const app = require('./app.json').expo;
const eas = require('./eas.json');
const failures = [];

if (app.extra?.eas?.projectId !== '7afb1a4b-46b6-4295-b33f-816b05589e81') failures.push('canonical EAS project ID');
if (app.ios?.bundleIdentifier !== 'com.dominicbarela.strengthcoachui') failures.push('canonical iOS bundle ID');
if (app.extra?.releaseTrack !== 'testflight') failures.push('explicit TestFlight release track');
if (app.runtimeVersion?.policy !== 'appVersion') failures.push('appVersion runtime policy');
if (!/^2\.1\.\d+$/.test(String(app.version || ''))) failures.push('2.1.x app version');
if (eas.build?.testflight?.channel !== 'testflight') failures.push('testflight build channel');
if (eas.build?.testflight?.env?.EXPO_PUBLIC_API_BASE !== 'https://app.strengthledger.fit') failures.push('production API base');
if (eas.build?.testflight?.ios?.distribution !== 'store') failures.push('App Store distribution');

if (failures.length) {
  console.error(`Refusing to build: invalid ${failures.join(', ')}.`);
  process.exit(1);
}
NODE

node scripts/test-testflight-source-parity.mjs --release-projection .

echo "TestFlight native release candidate"
echo "  path: ${actual_root}"
echo "  branch: ${branch}"
echo "  commit: ${head_commit}"
echo "  channel: testflight"
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

npx eas-cli build \
  --profile testflight \
  --platform ios \
  --auto-submit \
  --non-interactive
