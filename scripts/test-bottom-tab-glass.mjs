import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const tabLayout = read('app/(tabs)/_layout.tsx');
const tabRowControl = read('components/navigation/sl-tab-row-control.tsx');
const mockRoute = read('app/(tabs)/dev-mocks/navigation-bottom-tab-glass.tsx');
const registry = read('dev-mocks/live-screen-registry.ts');
const workspaceAudit = read('scripts/audit-workspace-system.mjs');
const packageJson = JSON.parse(read('package.json'));
const appConfig = JSON.parse(read('app.json'));

assert.match(
  tabLayout,
  /GlassView,[\s\S]*isGlassEffectAPIAvailable,[\s\S]*isLiquidGlassAvailable,[\s\S]*from ['"]expo-glass-effect['"]/,
  'the shared tab shell must import Expo’s native iOS 26 Liquid Glass bridge',
);
assert.match(
  tabLayout,
  /function supportsNativeLiquidGlass\(\)[\s\S]*Platform\.OS !== ['"]ios['"][\s\S]*isGlassEffectAPIAvailable\(\) && isLiquidGlassAvailable\(\)/,
  'native Liquid Glass must be gated by platform, runtime API, compiler, and app availability',
);
const nativeGlassBranch = tabLayout.match(
  /\{usesNativeLiquidGlass \? \(([\s\S]*?)\) : Platform\.OS === ['"]ios['"]/,
)?.[1] ?? '';
assert.match(
  nativeGlassBranch,
  /<GlassView[\s\S]*colorScheme=['"]dark['"][\s\S]*glassEffectStyle=['"]regular['"][\s\S]*tintColor=['"]rgba\(103, 82, 132, 0\.045\)['"]/,
  'supported iOS 26 must render one neutral native regular GlassView',
);
assert.doesNotMatch(
  nativeGlassBranch,
  /LinearGradient|backgroundColor|BlurView/,
  'no simulated blur, color wash, or sheen may cover the native glass plane',
);
assert.match(
  tabLayout,
  /usesNativeLiquidGlass && styles\.tabBarNativeMaterial[\s\S]*tabBarNativeMaterial:\s*\{[\s\S]*borderColor:\s*['"]transparent['"]/,
  'the simulated fallback edge must not cover the native adaptive glass edge',
);
assert.equal(
  (tabLayout.match(/<GlassView\b/g) ?? []).length,
  1,
  'the selected lens must not stack a second Liquid Glass plane over the tab glass',
);
assert.match(
  tabLayout,
  /\) : Platform\.OS === ['"]ios['"] && !reduceTransparency \? \([\s\S]*<BlurView[\s\S]*tint=['"]systemThinMaterialDark['"]/,
  'older supported iOS versions must retain the existing blur fallback',
);
assert.match(
  tabLayout,
  /AccessibilityInfo\.isReduceTransparencyEnabled\(\)[\s\S]*reduceTransparencyChanged/,
  'the tab shell must read and subscribe to the iOS reduced-transparency setting',
);
assert.match(
  tabLayout,
  /tabBar:\s*\{[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.shellHeight[\s\S]*?backgroundColor:\s*['"]transparent['"][\s\S]*?borderColor:\s*SL_TAB_ROW_CONTROL\.shellBorderColor/,
  'the production capsule must consume the shared tab-row geometry and edge treatment',
);
assert.match(
  tabRowControl,
  /shellBorderColor:\s*['"]rgba\(244, 240, 249, 0\.20\)['"]/,
  'the shared tab-row source must retain the restrained approved edge highlight',
);
assert.doesNotMatch(
  tabLayout.match(/tabBar:\s*\{[\s\S]*?\n  \},/)?.[0] ?? '',
  /SLColors\.object|#[0-9a-f]{6}|rgba\([^)]*,\s*1\)/i,
  'the tab capsule must not place an opaque color over the backdrop material',
);
assert.match(
  tabLayout,
  /tabBarTranslucentFallback:\s*\{[\s\S]*?SL_TAB_ROW_CONTROL\.translucentFallback/,
  'non-iOS platforms must consume the shared translucent dark fallback',
);
assert.match(
  tabRowControl,
  /translucentFallback:\s*['"]rgba\(13, 9, 19, 0\.82\)['"][\s\S]*reducedTransparencyFallback:\s*['"]rgba\(13, 10, 19, 0\.96\)['"]/,
  'the shared control system must retain both approved fallback materials',
);
assert.match(
  tabLayout,
  /tabBarReducedTransparency:\s*\{[\s\S]*?SL_TAB_ROW_CONTROL\.reducedTransparencyFallback/,
  'reduced transparency must consume the shared high-contrast fallback',
);
assert.match(
  tabLayout,
  /colors=\{SL_TAB_ROW_SELECTED_LENS\}[\s\S]*style=\{styles\.activeTabMarker\}/,
  'the selected tab must remain a translucent lens within the single native glass plane',
);
assert.match(
  tabLayout,
  /tabBarItem:\s*\{[\s\S]*?width:\s*SL_TAB_ROW_CONTROL\.itemSize[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.itemSize[\s\S]*?borderRadius:\s*SL_TAB_ROW_CONTROL\.itemRadius/,
  'the production tab items must consume the shared tab-row item geometry',
);
assert.match(
  tabLayout,
  /activeTabMarker:\s*\{[\s\S]*?width:\s*SL_TAB_ROW_CONTROL\.indicatorSize[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.indicatorSize[\s\S]*?borderRadius:\s*SL_TAB_ROW_CONTROL\.indicatorRadius/,
  'the production selected lens must consume the shared tab-row indicator geometry',
);
assert.match(
  tabLayout,
  /hitSlop=\{SL_TAB_ROW_CONTROL\.hitSlop\}/,
  'the production tab items must consume the shared safe interaction inset',
);
assert.match(
  tabLayout,
  /SLColors\.textMuted/,
  'unselected icons must keep the established legible muted color',
);

for (const label of ['Today', 'Calendar', 'Ledger']) {
  assert.match(tabLayout, new RegExp(`label: ['"]${label}['"]`), `the ${label} destination must remain present`);
}
assert.match(
  tabLayout,
  /const trainingTabLabel = isIndividual \? ['"]Programming['"] : ['"]Training['"]/,
  'the athlete Training destination must remain present without renaming the individual-workspace variant',
);

assert.match(
  tabLayout,
  /navigation\.emit\(\{[\s\S]*?type:\s*['"]tabPress['"][\s\S]*?canPreventDefault:\s*true/,
  'tab navigation must retain its preventable tabPress behavior',
);
assert.match(
  tabLayout,
  /\{\s*height:\s*58 \+ bottomInset,\s*paddingBottom:\s*bottomInset \+ SLSpacing\.xs\s*\}/,
  'the existing bottom safe-area geometry must remain unchanged',
);
const tabDockBlock = tabLayout.match(/tabBarDock:\s*\{[\s\S]*?\n  \},/)?.[0] ?? '';
assert.equal(
  (tabDockBlock.match(/paddingHorizontal:\s*SLLayout\.screenGutter/g) ?? []).length,
  1,
  'the global tab dock must own its horizontal gutter exactly once',
);
assert.match(
  tabLayout,
  /const showsExpandedTabRow = isExpanded \|\| isBottomTabGlassPreviewPath/,
  'the deterministic preview must expose all four destinations',
);
assert.match(
  tabLayout,
  /usesCalendarPreviewSelection = isCalendarPreviewPath \|\| isBottomTabGlassPreviewPath/,
  'the deterministic preview must keep Calendar selected',
);
assert.equal(
  packageJson.dependencies['expo-glass-effect'],
  '~0.1.10',
  'Expo SDK 54’s compatible native GlassEffect module must remain installed',
);
assert.notEqual(
  appConfig.expo?.ios?.infoPlist?.UIDesignRequiresCompatibility,
  true,
  'the iOS app configuration must not opt out of the native Liquid Glass design',
);

assert.doesNotMatch(
  mockRoute,
  /\b(?:BlurView|GlassView)\b|from\s+['"]expo-(?:blur|glass-effect)['"]|backdropFilter/i,
  'the fixture content must not create a second glass surface',
);
assert.doesNotMatch(
  mockRoute,
  /paddingHorizontal/,
  'the fixture must not duplicate the horizontal gutter already owned by the app shell',
);
assert.match(
  mockRoute,
  /behindNavigation[\s\S]*underlayViolet[\s\S]*underlayBlue[\s\S]*underlayMagenta/,
  'the fixture must provide visible content behind the shared tab material',
);
assert.match(
  registry,
  /id:\s*['"]navigation-bottom-tab-glass-preview['"][\s\S]*?route:\s*['"]\/\(tabs\)\/dev-mocks\/navigation-bottom-tab-glass['"]/,
  'the preview must be registered in the UI Mock Library',
);

const approvedBlurBlock = workspaceAudit.match(/const approvedBlurFiles = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
assert.match(
  approvedBlurBlock,
  /['"]app\/\(tabs\)\/_layout\.tsx['"]/,
  'the workspace audit must explicitly approve the shared bottom-tab shell',
);
assert.equal(
  (approvedBlurBlock.match(/['"][^'"]+\.(?:ts|tsx|js|jsx)['"]/g) ?? []).length,
  1,
  'the bottom-tab shell must remain the only production blur exception',
);

const collectSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(path);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name)) ? [path] : [];
});
const glassSources = [join(root, 'app'), join(root, 'components')]
  .flatMap(collectSourceFiles)
  .filter((path) => (
    /from\s+['"]expo-(?:blur|glass-effect)['"]|\b(?:BlurView|GlassView)\b/
      .test(readFileSync(path, 'utf8'))
  ))
  .map((path) => relative(root, path));
assert.deepEqual(
  glassSources,
  ['app/(tabs)/_layout.tsx'],
  'no other app surface may receive native or simulated glass styling',
);

console.log('Bottom-tab liquid-glass contract tests passed.');
