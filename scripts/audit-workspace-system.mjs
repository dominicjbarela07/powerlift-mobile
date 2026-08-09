import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const sourceRoots = [join(root, 'app'), join(root, 'components')];

const collectSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(path);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name)) ? [path] : [];
});

const sourceFiles = sourceRoots.flatMap(collectSourceFiles);
const productionFiles = sourceFiles.filter((file) => !relative(root, file).includes('/dev-mocks/'));
const approvedGradientFiles = new Set([
  'app/(tabs)/_layout.tsx',
  'components/ui/sl-button.tsx',
  'components/ui/sl-workspace.tsx',
]);
const approvedBlurFiles = new Set([
  // Explicit product exception: the global bottom tab row alone uses native
  // backdrop material. No other workspace surface may adopt glass styling.
  'app/(tabs)/_layout.tsx',
]);
const read = (file) => readFileSync(file, 'utf8');

for (const file of sourceFiles) {
  const source = read(file);
  const label = relative(root, file);
  if (!approvedBlurFiles.has(label)) {
    assert.doesNotMatch(
      source,
      /\b(?:BlurView|LiquidGlass|GlassView|glassmorph(?:ic|ism)?|backdropFilter)\b|from\s+['"]expo-blur['"]/i,
      `${label} reintroduces a retired translucent or Liquid Glass primitive`,
    );
  }
  if (!approvedGradientFiles.has(label)) {
    assert.doesNotMatch(source, /from\s+['"]expo-linear-gradient['"]|require\(['"]expo-linear-gradient['"]\)/, `${label} bypasses the shared OLED energy primitives`);
  }
  assert.doesNotMatch(source, /\b(?:RadialGradient|ConicGradient)\b/, `${label} renders a decorative radial or conic gradient`);
  assert.doesNotMatch(source, /\bSLAtmosphere\b/, `${label} uses the retired atmosphere component`);
  assert.doesNotMatch(source, /variant=['"](?:hero|command|raised|muted)['"]/, `${label} uses an obsolete SLCard variant`);
}

for (const file of productionFiles) {
  const source = read(file);
  const label = relative(root, file);
  const localElevation = source.match(/\b(?:shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation)\s*:/g) ?? [];
  const isMediaZOrderException = label === 'components/SetVideoPlayerModal.tsx'
    && localElevation.length === 4
    && localElevation.every((token) => token.startsWith('elevation'));
  assert.equal(localElevation.length === 0 || isMediaZOrderException, true, `${label} defines a feature-local elevation recipe`);
  assert.doesNotMatch(source, /\b(?:sideRail|accentRail|statusRail|colorRail)\b|borderLeftWidth\s*:\s*[2-9]/i, `${label} defines a decorative side rail`);
}

const theme = read(join(root, 'constants/theme.ts'));
assert.doesNotMatch(theme, /\b(?:gradientHero|shellGradient|shellGlow|glassNav|surfaceTranslucent)\b/, 'retired glow, glass, or atmosphere tokens remain');
assert.match(theme, /level0:[\s\S]*level1:[\s\S]*level2:[\s\S]*level3:/, 'the exact four-level elevation contract is missing');
assert.match(theme, /canvas:\s*['"]#020205['"]/, 'the OLED workspace canvas token changed');
assert.match(theme, /primary:\s*\[['"]#6928D0['"],\s*['"]#7C226E['"],\s*['"]#C42D78['"],\s*['"]#E05261['"]\]/, 'the constrained primary energy ramp is missing');
assert.match(theme, /export const SLMaterials\s*=\s*\{[\s\S]*face:[\s\S]*topEdge:[\s\S]*sideEdge:[\s\S]*lowerEdge:/, 'the manufactured object material contract is missing');
assert.match(theme, /innerLight:[\s\S]*innerDark:/, 'the geometry-aware inner-light and inner-shadow material contract is missing');
assert.match(theme, /total:\s*['"]#C84FE2['"]/, 'Total must remain in the violet-magenta brand family');
assert.match(theme, /squat:\s*['"]#A85CFF['"]/, 'Squat must retain its violet identity');
assert.match(theme, /bench:\s*['"]#ED4F91['"]/, 'Bench must use the rose family rather than success green');
assert.match(theme, /deadlift:\s*['"]#F05A63['"]/, 'Deadlift must use the athletic warm-red family');
assert.doesNotMatch(theme, /bench:\s*['"]#33D68A['"]/, 'Bench regressed to the success color family');

const workspace = read(join(root, 'components/ui/sl-workspace.tsx'));
assert.match(workspace, /from ['"]@shopify\/react-native-skia['"]/, 'full-quality object material must use the shared Skia renderer');
assert.match(workspace, /<BoxShadow[\s\S]*inner/, 'full-quality object material must include geometry-aware inner depth');
assert.doesNotMatch(workspace, /accentEnergy|width:\s*(?:120|52)\b/, 'the rejected fixed-width corner energy splotch returned');
for (const primitive of ['SLWorkspaceBackground', 'SLMaterialOverlay', 'SLSurface', 'SLSection', 'SLMediaStage', 'SLFloatingUtilityClearance']) {
  assert.match(workspace, new RegExp(`export function ${primitive}\\b`), `${primitive} is missing from the workspace primitive layer`);
}

const button = read(join(root, 'components/ui/sl-button.tsx'));
assert.match(button, /variant === 'primary'[\s\S]*SLGradients\.primary/, 'primary actions must use the shared constrained energy gradient');
assert.doesNotMatch(button, /endpointHighlight/, 'the rejected fixed endpoint lighting shape returned');
assert.match(button, /danger:[\s\S]*surfaceDestructive/, 'destructive actions must use the shared destructive surface');
assert.match(button, /accessibilityState=\{\{[\s\S]*busy: loading[\s\S]*disabled: isDisabled/, 'shared buttons must expose loading and disabled state');
for (const primitiveFile of ['sl-button.tsx', 'sl-icon-button.tsx', 'sl-action-chip.tsx', 'sl-field.tsx', 'sl-status-pill.tsx', 'sl-priority-badge.tsx']) {
  assert.match(
    read(join(root, 'components/ui', primitiveFile)),
    /SLMaterialOverlay/,
    `${primitiveFile} bypasses the shared manufactured material response`,
  );
}

assert.equal(existsSync(join(root, 'components/AppHeader.tsx')), false, 'the duplicate AppHeader model returned');

for (const [asset, expected] of Object.entries({
  'assets/images/16:9.png': '86997ed5515c3c937944fff9a82fcb537d5831833152ba17bdb98d99eb17e7f0',
  'assets/images/app_logo.png': '79fda9904d4622c0c70bfe34e9aa98cf0106db0445f124ab351eda84e6e8b8a3',
})) {
  const actual = createHash('sha256').update(readFileSync(join(root, asset))).digest('hex');
  assert.equal(actual, expected, `locked production asset changed: ${asset}`);
}

console.log('[workspace-system] quiet OLED workspace, manufactured object material, constrained internal energy, shared elevation, side-rail policy, typography adapters, header consolidation, and locked assets passed');
