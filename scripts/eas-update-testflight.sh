#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_ROOT="/Users/dominic/powerlifting_app/powerlift_mobile_testflight"
readonly EXPECTED_CHANNEL="testflight"
readonly EXPECTED_API_BASE="https://app.strengthledger.fit"
readonly EXPECTED_PROJECT_ID="7afb1a4b-46b6-4295-b33f-816b05589e81"
readonly EXPECTED_BUNDLE_ID="com.dominicbarela.strengthcoachui"

release_message="${1:-}"
actual_root="$(pwd -P)"
branch="$(git branch --show-current)"

if [[ "${actual_root}" != "${EXPECTED_ROOT}" ]]; then
  echo "Refusing to publish outside ${EXPECTED_ROOT}." >&2
  exit 1
fi

if [[ "${branch}" != release/testflight/* ]]; then
  echo "Refusing to publish from non-TestFlight release branch: ${branch}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to publish from a dirty worktree." >&2
  git status --short >&2
  exit 1
fi

if [[ -z "${release_message}" ]]; then
  echo "Usage: scripts/eas-update-testflight.sh \"release message\"" >&2
  exit 1
fi

export EXPO_PUBLIC_API_BASE="${EXPECTED_API_BASE}"

node <<'NODE'
const app = require('./app.json').expo;
const eas = require('./eas.json');

const expected = {
  projectId: '7afb1a4b-46b6-4295-b33f-816b05589e81',
  bundleIdentifier: 'com.dominicbarela.strengthcoachui',
  apiBase: 'https://app.strengthledger.fit',
};

const failures = [];
if (app.extra?.eas?.projectId !== expected.projectId) failures.push('canonical EAS project ID');
if (app.ios?.bundleIdentifier !== expected.bundleIdentifier) failures.push('canonical iOS bundle ID');
if (app.runtimeVersion?.policy !== 'appVersion') failures.push('appVersion runtime policy');
if (!/^2\.1\.\d+$/.test(String(app.version || ''))) failures.push('2.1.x app version');
if (!Number.isInteger(app.extra?.appRevision) || app.extra.appRevision < 1) failures.push('positive app revision');
if (eas.build?.testflight?.channel !== 'testflight') failures.push('testflight build channel');
if (eas.build?.testflight?.env?.EXPO_PUBLIC_API_BASE !== expected.apiBase) failures.push('production API base');
if (eas.build?.testflight?.ios?.distribution !== 'store') failures.push('App Store distribution');

if (failures.length) {
  console.error(`Refusing to publish: invalid ${failures.join(', ')}.`);
  process.exit(1);
}
NODE

if git ls-files app | rg -q '(^|/)(dev-mocks|fixtures)(/|$)'; then
  echo "Refusing to publish with tracked development-only app routes." >&2
  exit 1
fi

commit="$(git rev-parse HEAD)"
version="$(node -p "require('./app.json').expo.version")"
runtime_policy="$(node -p "require('./app.json').expo.runtimeVersion.policy")"
app_revision="$(node -p "require('./app.json').expo.extra.appRevision")"

echo "TestFlight OTA release candidate"
echo "  path: ${actual_root}"
echo "  branch: ${branch}"
echo "  commit: ${commit}"
echo "  channel: ${EXPECTED_CHANNEL}"
echo "  version: ${version}"
echo "  runtime policy: ${runtime_policy}"
echo "  app revision: ${app_revision}"
echo "  API base: ${EXPO_PUBLIC_API_BASE}"
echo "  project ID: ${EXPECTED_PROJECT_ID}"
echo "  iOS bundle: ${EXPECTED_BUNDLE_ID}"
echo "  message: ${release_message}"

read -r -p 'Type PUBLISH TESTFLIGHT to continue: ' confirmation
if [[ "${confirmation}" != "PUBLISH TESTFLIGHT" ]]; then
  echo "Publish cancelled." >&2
  exit 1
fi

npx eas-cli update \
  --channel "${EXPECTED_CHANNEL}" \
  --platform all \
  --message "${release_message}" \
  --non-interactive \
  --json
