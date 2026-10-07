import assert from 'node:assert/strict';

export const legacyArtBundleCondition = "(__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight')";
export const production3ArtBundleCondition = "(__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight' || (process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'production3' && process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION === '3.0.0'))";
export const artBundlePolicyFiles = ['lib/canonical-movement-artwork-assets.ts', 'lib/equipment-type-artwork.ts'];

// This exception permits only the version-scoped inclusion condition. Every
// image require, ownership mapping, approval, crop and remaining byte is pinned.
export function assertArtBundlePolicyProgression(file, original, current) {
  assert.ok(artBundlePolicyFiles.includes(file));
  const count = original.split(legacyArtBundleCondition).length - 1;
  assert.equal(count, file === artBundlePolicyFiles[0] ? 1 : 2);
  assert.equal(current, original.replaceAll(legacyArtBundleCondition, production3ArtBundleCondition), 'art bundle policy cannot change approved references or any other source bytes');
}
