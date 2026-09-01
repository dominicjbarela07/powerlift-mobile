import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRODUCTION_PLATFORMS,
  assertProductionPlatformParity,
  platformBaseline,
  readProductionBaseline,
} from './production-release-policy.mjs';

const root = process.cwd();
const baseline = readProductionBaseline(root);
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

function runEas(args) {
  return execFileSync('npx', ['eas-cli', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseJsonOutput(output) {
  for (let index = output.indexOf('{'); index >= 0; index = output.indexOf('{', index + 1)) {
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // EAS may print a human-readable preamble before its JSON object.
    }
  }
  throw new Error('Production parity check could not parse EAS JSON output.');
}

function parseMultipart(contentType, responseBody) {
  const boundary = contentType.match(/boundary="?([^";]+)"?/)?.[1];
  if (!boundary) throw new Error('Production parity check received no OTA multipart boundary.');
  return responseBody.split(`--${boundary}`).flatMap((part) => {
    const separator = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const body = part.split(separator).slice(1).join(separator).trim();
    if (!body.startsWith('{')) return [];
    try {
      return [JSON.parse(body)];
    } catch {
      return [];
    }
  });
}

async function inspectPlatform(platform) {
  const expected = platformBaseline(baseline, platform);
  const response = await fetch(app.updates.url, {
    headers: {
      accept: 'multipart/mixed',
      'expo-platform': platform,
      'expo-protocol-version': '1',
      'expo-runtime-version': baseline.runtimeVersion,
      'expo-channel-name': baseline.channel,
    },
  });
  if (response.status === 204) {
    return {
      platform,
      channel: baseline.channel,
      status: 204,
      embeddedFallback: true,
    };
  }
  if (!response.ok) {
    throw new Error(`PRODUCTION 2.0.2 PLATFORM PARITY: FAIL\n${platform}: manifest HTTP ${response.status}`);
  }

  const parts = parseMultipart(
    response.headers.get('content-type') ?? '',
    await response.text(),
  );
  const manifest = parts.find((part) => part.launchAsset);
  const extensions = parts.find((part) => part.assetRequestHeaders);
  if (!manifest || !extensions) {
    throw new Error(`PRODUCTION 2.0.2 PLATFORM PARITY: FAIL\n${platform}: unreadable manifest`);
  }
  const authorization = extensions.assetRequestHeaders?.[manifest.launchAsset.key]?.authorization;
  const assetResponse = await fetch(manifest.launchAsset.url, {
    headers: authorization ? { authorization } : {},
  });
  if (!assetResponse.ok) {
    throw new Error(
      `PRODUCTION 2.0.2 PLATFORM PARITY: FAIL\n${platform}: launch asset HTTP ${assetResponse.status}`,
    );
  }
  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  const group = JSON.parse(runEas(['update:view', expected.activeUpdateGroup, '--json']));
  const update = group.find((candidate) => candidate.id === manifest.id && candidate.platform === platform);

  return {
    platform,
    channel: baseline.channel,
    status: response.status,
    embeddedFallback: false,
    branch: manifest.metadata?.branchName,
    runtimeVersion: manifest.runtimeVersion,
    group: update?.group,
    updateId: manifest.id,
    sourceCommit: update?.gitCommitHash,
    launchAssetKey: manifest.launchAsset.key,
    launchAssetSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    launchAssetBytes: bytes.length,
  };
}

const channel = parseJsonOutput(runEas([
  'channel:view',
  baseline.channel,
  '--json',
  '--non-interactive',
]));
const channelState = channel.currentPage ?? channel;
const mappedBranches = (channelState.updateBranches ?? []).map((branch) => branch.name);
if (
  channelState.name !== baseline.channel
  || channelState.isPaused
  || mappedBranches.length !== 1
  || mappedBranches[0] !== baseline.branch
) {
  throw new Error(
    `PRODUCTION 2.0.2 PLATFORM PARITY: FAIL\n`
    + `channel mapping: resolved=${mappedBranches.join(', ') || '<none>'}, expected=${baseline.branch}`,
  );
}

const inspected = await Promise.all(PRODUCTION_PLATFORMS.map(inspectPlatform));
const states = Object.fromEntries(inspected.map((state) => [state.platform, state]));
const result = assertProductionPlatformParity({ baseline, states });
console.log(JSON.stringify({ result, channel: baseline.channel, branch: baseline.branch, states }, null, 2));
