import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';

import {
  BARBELL_EMPTY_WEIGHT_LB,
  SYMMETRICAL_LOADING_INCREMENT_LB,
  loadingForTotalWeightLb,
} from '../lib/barbell/loading.ts';

const { PNG } = pngjs;
const root = process.cwd();
const rendererVersion = 'blender-cycles-catalog-v1';
const artifactRoot = path.join(
  root,
  'artifacts/plate-stack-catalog',
  rendererVersion,
  'lb',
);
const assetRoot = path.join(
  root,
  'assets/images/plate-stack-catalog',
  rendererVersion,
  'lb',
);
const batchOneManifest = JSON.parse(
  fs.readFileSync(path.join(artifactRoot, 'manifest.json'), 'utf8'),
);
const continuationManifest = JSON.parse(
  fs.readFileSync(path.join(artifactRoot, 'manifest-410-945.json'), 'utf8'),
);
const registry = JSON.parse(
  fs.readFileSync(path.join(artifactRoot, 'registry.json'), 'utf8'),
);
const sha256 = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const enumerateLoads = (minimum, maximum) =>
  Array.from(
    { length: (maximum - minimum) / SYMMETRICAL_LOADING_INCREMENT_LB + 1 },
    (_, index) => minimum + index * SYMMETRICAL_LOADING_INCREMENT_LB,
  );

const expectedBatchOneLoads = enumerateLoads(45, 400);
const expectedContinuationLoads = enumerateLoads(410, 945);
const expectedCatalogLoads = enumerateLoads(45, 945);
const expectedCatalogAssetLoads = expectedCatalogLoads.filter(
  (load) => load !== 405,
);

assert.equal(expectedContinuationLoads.length, 108);
assert.equal(expectedContinuationLoads[0], 410);
assert.equal(expectedContinuationLoads.at(-1), 945);
assert.ok(
  expectedContinuationLoads
    .slice(1)
    .every((load, index) => load - expectedContinuationLoads[index] === 5),
  'every adjacent continuation load must differ by exactly 5 lb',
);

assert.equal(batchOneManifest.rendererVersion, rendererVersion);
assert.deepEqual(
  batchOneManifest.loads.map((entry) => entry.totalWeightLb),
  expectedBatchOneLoads,
  'the original Batch 1 manifest must remain exact and unchanged in scope',
);
assert.equal(continuationManifest.rendererVersion, rendererVersion);
assert.equal(
  continuationManifest.loadingRules.barWeightLb,
  BARBELL_EMPTY_WEIGHT_LB,
);
assert.equal(
  continuationManifest.batch.supportedIncrementLb,
  SYMMETRICAL_LOADING_INCREMENT_LB,
);
assert.deepEqual(
  continuationManifest.loads.map((entry) => entry.totalWeightLb),
  expectedContinuationLoads,
  'the continuation regression guard must enumerate every 5 lb load from 410 through 945',
);
assert.deepEqual(continuationManifest.nonRepresentableLoads, []);
assert.equal(continuationManifest.summary.candidateCount, 108);
assert.equal(continuationManifest.summary.representableCount, 108);
assert.equal(continuationManifest.summary.nonRepresentableCount, 0);

const preserved405 = continuationManifest.preservedCanonicalLoads.find(
  (entry) => entry.totalWeightLb === 405,
);
assert.ok(preserved405, 'the manifest must preserve the canonical 405 entry');
assert.deepEqual(preserved405.platesPerSide, loadingForTotalWeightLb(405));
assert.equal(preserved405.preserved, true);

assert.deepEqual(
  Object.keys(registry.loads).map(Number),
  expectedCatalogLoads,
  'registry coverage must be continuous from 45 through 945 with no gaps or extras',
);

const assetFilenames = fs
  .readdirSync(assetRoot)
  .filter((filename) => filename.endsWith('.png'))
  .sort((left, right) => Number.parseInt(left) - Number.parseInt(right));
assert.deepEqual(
  assetFilenames,
  expectedCatalogAssetLoads.map((load) => `${load}.png`),
  'catalog assets must contain every expected load except the separately preserved 405 and no extras',
);

const edgeAlphaStatistics = (png) => {
  const edges = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };
  const alphaAt = (x, y) => png.data[(y * png.width + x) * 4 + 3];
  for (let x = 0; x < png.width; x += 1) {
    edges.top.push(alphaAt(x, 0));
    edges.bottom.push(alphaAt(x, png.height - 1));
  }
  for (let y = 0; y < png.height; y += 1) {
    edges.left.push(alphaAt(0, y));
    edges.right.push(alphaAt(png.width - 1, y));
  }
  return Object.fromEntries(
    Object.entries(edges).map(([edge, values]) => [
      edge,
      {
        maximum: Math.max(...values),
        opaquePixels: values.filter((alpha) => alpha >= 250).length,
      },
    ]),
  );
};

const outputHashes = new Map();
let acceptedSleeveOverhangCount = 0;
for (const entry of [
  ...batchOneManifest.loads,
  ...continuationManifest.loads,
]) {
  const canonicalPlates = loadingForTotalWeightLb(entry.totalWeightLb);
  assert.deepEqual(
    entry.platesPerSide,
    canonicalPlates,
    `${entry.totalWeightLb} lb manifest must match the runtime loader`,
  );
  assert.equal(
    entry.perSideWeightLb,
    (entry.totalWeightLb - BARBELL_EMPTY_WEIGHT_LB) / 2,
  );

  const registryEntry = registry.loads[String(entry.totalWeightLb)];
  const assetPath = path.join(assetRoot, `${entry.totalWeightLb}.png`);
  const loadRoot = path.join(artifactRoot, `${entry.totalWeightLb}lb`);
  const masterPath = path.join(
    loadRoot,
    `strength-ledger-plate-stack-${entry.totalWeightLb}lb-master-2160x1440.png`,
  );
  const provenancePath = path.join(
    loadRoot,
    `strength-ledger-plate-stack-${entry.totalWeightLb}lb-provenance.json`,
  );
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  const asset = PNG.sync.read(fs.readFileSync(assetPath));
  const master = PNG.sync.read(fs.readFileSync(masterPath));

  assert.equal(asset.width, 720);
  assert.equal(asset.height, 480);
  assert.equal(asset.alpha, true);
  assert.equal(master.width, 2160);
  assert.equal(master.height, 1440);
  assert.equal(master.alpha, true);
  assert.deepEqual(provenance.loading.platesPerSide, canonicalPlates);
  assert.equal(provenance.loading.symmetricSides, true);
  assert.equal(provenance.loading.collarsIncluded, false);
  assert.equal(provenance.orientation.studioTransform, 'none');
  assert.equal(provenance.orientation.outputTransform, 'none');
  assert.equal(provenance.orientation.upright, true);
  if (!provenance.assembly.fitsAuthoredSleeve) {
    acceptedSleeveOverhangCount += 1;
    assert.ok(
      entry.totalWeightLb >= 410,
      'only continuation loads may use the accepted sleeve-overhang rule',
    );
    assert.ok(
      provenance.assembly.stackEndMeters >
        provenance.assembly.sleeveBoundsXMeters[1],
    );
  }
  assert.ok(
    provenance.outputs.loggerHero.alpha.partialPixels > 500,
    `${entry.totalWeightLb} lb must retain antialiased/contact-shadow alpha`,
  );
  assert.equal(
    provenance.outputs.master.sha256,
    sha256(masterPath),
    `${entry.totalWeightLb} lb master hash must match provenance`,
  );
  assert.equal(
    provenance.outputs.loggerHero.sha256,
    sha256(assetPath),
    `${entry.totalWeightLb} lb asset hash must match provenance`,
  );
  assert.equal(registryEntry.sha256, sha256(assetPath));
  assert.equal(registryEntry.width, 720);
  assert.equal(registryEntry.height, 480);

  const cornerAlpha = [
    asset.data[3],
    asset.data[(asset.width - 1) * 4 + 3],
    asset.data[(asset.height - 1) * asset.width * 4 + 3],
    asset.data[(asset.height * asset.width - 1) * 4 + 3],
  ];
  assert.ok(
    Math.max(...cornerAlpha) < 250,
    `${entry.totalWeightLb} lb must not have an opaque background`,
  );
  for (const [tier, image] of [
    ['logger', asset],
    ['master', master],
  ]) {
    const edges = edgeAlphaStatistics(image);
    assert.equal(
      edges.top.opaquePixels,
      0,
      `${entry.totalWeightLb} lb must not clip the ${tier} top edge`,
    );
    assert.equal(
      edges.left.opaquePixels,
      0,
      `${entry.totalWeightLb} lb must not clip the ${tier} left edge`,
    );
    if (edges.bottom.opaquePixels > 0) {
      assert.ok(
        provenance.assembly.stackEndMeters >= 0.2798,
        `${entry.totalWeightLb} lb bottom-edge contact must only result from the accepted fixed-camera depth growth`,
      );
    }
    if (edges.right.opaquePixels > 0) {
      assert.equal(
        provenance.assembly.fitsAuthoredSleeve,
        false,
        `${entry.totalWeightLb} lb right-edge contact must only result from accepted sleeve overhang`,
      );
    }
  }

  const hash = sha256(assetPath);
  const prior = outputHashes.get(hash);
  assert.equal(
    prior,
    undefined,
    `${entry.totalWeightLb} lb unexpectedly duplicates ${prior} lb`,
  );
  outputHashes.set(hash, entry.totalWeightLb);
}

const canonical405AssetPath = path.join(
  root,
  'assets/images',
  preserved405.assetPath,
);
const canonical405MasterPath = path.join(
  root,
  'artifacts',
  preserved405.artifactPath,
);
const canonical405ProvenancePath = path.join(
  root,
  'artifacts',
  preserved405.provenancePath,
);
const canonical405Asset = PNG.sync.read(
  fs.readFileSync(canonical405AssetPath),
);
const canonical405Master = PNG.sync.read(
  fs.readFileSync(canonical405MasterPath),
);
assert.equal(canonical405Asset.width, 720);
assert.equal(canonical405Asset.height, 480);
assert.equal(canonical405Asset.alpha, true);
assert.equal(canonical405Master.width, 2160);
assert.equal(canonical405Master.height, 1440);
assert.equal(canonical405Master.alpha, true);
assert.equal(sha256(canonical405AssetPath), preserved405.sha256);
assert.equal(sha256(canonical405MasterPath), preserved405.masterSha256);
assert.equal(
  sha256(canonical405ProvenancePath),
  preserved405.provenanceSha256,
);
assert.deepEqual(
  registry.loads['405'].platesPerSide,
  loadingForTotalWeightLb(405),
);
assert.equal(registry.loads['405'].sha256, preserved405.sha256);
assert.equal(
  outputHashes.get(preserved405.sha256),
  undefined,
  'the canonical 405 asset must remain unique',
);
outputHashes.set(preserved405.sha256, 405);

console.log(
  `Canonical plate-stack catalog passed: 108 exact continuation loads, ${expectedCatalogLoads.length} continuous registry entries, runtime plate-math parity, master/logger dimensions, alpha and framing, provenance hashes, orientation metadata, unique outputs, preserved 405, and ${acceptedSleeveOverhangCount} accepted sleeve-overhang loads.`,
);
