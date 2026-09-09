import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const tabLayout = read('app/(tabs)/_layout.tsx');
const tabRowControl = read('components/navigation/sl-tab-row-control.tsx');
const shippingNavigation = read('lib/shipping-navigation.ts');
const workspaceAudit = read('scripts/audit-workspace-system.mjs');
const packageJson = JSON.parse(read('package.json'));
const appConfig = JSON.parse(read('app.json'));

assert.match(
  tabRowControl,
  /GlassView,[\s\S]*isGlassEffectAPIAvailable,[\s\S]*isLiquidGlassAvailable,[\s\S]*from ['"]expo-glass-effect['"]/,
  'the shared tab shell must import Expo’s native iOS 26 Liquid Glass bridge',
);
assert.match(
  tabRowControl,
  /function supportsNativeLiquidGlass\(\)[\s\S]*Platform\.OS !== ['"]ios['"][\s\S]*isGlassEffectAPIAvailable\(\) && isLiquidGlassAvailable\(\)/,
  'native Liquid Glass must be gated by platform, runtime API, compiler, and app availability',
);
const nativeGlassBranch = tabRowControl.match(
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
  tabRowControl,
  /usesNativeLiquidGlass && styles\.navigationShellNativeMaterial[\s\S]*navigationShellNativeMaterial:\s*\{[\s\S]*borderColor:\s*['"]transparent['"]/,
  'the simulated fallback edge must not cover the native adaptive glass edge',
);
assert.equal(
  (tabRowControl.match(/<GlassView\b/g) ?? []).length,
  1,
  'the selected lens must not stack a second Liquid Glass plane over the tab glass',
);
assert.match(
  tabRowControl,
  /\) : Platform\.OS === ['"]ios['"] && !reduceTransparency \? \([\s\S]*<BlurView[\s\S]*tint=['"]systemThinMaterialDark['"]/,
  'older supported iOS versions must retain the existing blur fallback',
);
assert.match(
  tabRowControl,
  /AccessibilityInfo\.isReduceTransparencyEnabled\(\)[\s\S]*reduceTransparencyChanged/,
  'the tab shell must read and subscribe to the iOS reduced-transparency setting',
);
assert.match(
  tabRowControl,
  /navigationShell:\s*\{[\s\S]*?backgroundColor:\s*['"]transparent['"][\s\S]*?borderColor:\s*SL_TAB_ROW_CONTROL\.shellBorderColor[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.shellHeight/,
  'the production capsule must consume the shared tab-row geometry and edge treatment',
);
assert.match(
  tabRowControl,
  /shellBorderColor:\s*['"]rgba\(244, 240, 249, 0\.20\)['"]/,
  'the shared tab-row source must retain the restrained approved edge highlight',
);
assert.doesNotMatch(
  tabRowControl.match(/navigationShell:\s*\{[\s\S]*?\n  \},/)?.[0] ?? '',
  /SLColors\.object|#[0-9a-f]{6}|rgba\([^)]*,\s*1\)/i,
  'the tab capsule must not place an opaque color over the backdrop material',
);
assert.match(
  tabRowControl,
  /navigationTranslucentFallback:\s*\{[\s\S]*?SL_TAB_ROW_CONTROL\.translucentFallback/,
  'non-iOS platforms must consume the shared translucent dark fallback',
);
assert.match(
  tabRowControl,
  /translucentFallback:\s*['"]rgba\(13, 9, 19, 0\.82\)['"][\s\S]*reducedTransparencyFallback:\s*['"]rgba\(13, 10, 19, 0\.96\)['"]/,
  'the shared control system must retain both approved fallback materials',
);
assert.match(
  tabRowControl,
  /navigationReducedTransparency:\s*\{[\s\S]*?SL_TAB_ROW_CONTROL\.reducedTransparencyFallback/,
  'reduced transparency must consume the shared high-contrast fallback',
);
assert.match(
  tabRowControl,
  /colors=\{SL_TAB_ROW_SELECTED_LENS\}[\s\S]*style=\{styles\.navigationSelectedLens\}/,
  'the selected tab must remain a translucent lens within the single native glass plane',
);
assert.match(
  tabRowControl,
  /navigationItem:\s*\{[\s\S]*?borderRadius:\s*SL_TAB_ROW_CONTROL\.itemRadius[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.itemSize[\s\S]*?width:\s*SL_TAB_ROW_CONTROL\.itemSize/,
  'the production tab items must consume the shared tab-row item geometry',
);
assert.match(
  tabRowControl,
  /navigationSelectedLens:\s*\{[\s\S]*?borderRadius:\s*SL_TAB_ROW_CONTROL\.indicatorRadius[\s\S]*?height:\s*SL_TAB_ROW_CONTROL\.indicatorSize[\s\S]*?width:\s*SL_TAB_ROW_CONTROL\.indicatorSize/,
  'the production selected lens must consume the shared tab-row indicator geometry',
);
assert.match(
  tabRowControl,
  /hitSlop=\{SL_TAB_ROW_CONTROL\.hitSlop\}/,
  'the production tab items must consume the shared safe interaction inset',
);
assert.match(
  tabRowControl,
  /inactiveColor:\s*SLColors\.textMuted/,
  'unselected icons must keep the established legible muted color',
);

for (const label of ['Today', 'Calendar', 'Ledger']) {
  assert.match(shippingNavigation, new RegExp(`label: ['"]${label}['"]`), `the ${label} destination must remain present`);
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
  tabRowControl,
  /dockFrameHeight:\s*58[\s\S]*height:\s*SL_TAB_ROW_CONTROL\.dockFrameHeight \+ bottomInset[\s\S]*paddingBottom:\s*bottomInset \+ SLSpacing\.xs/,
  'the existing bottom safe-area geometry must remain unchanged',
);
const tabDockBlock = tabRowControl.match(/navigationDock:\s*\{[\s\S]*?\n  \},/)?.[0] ?? '';
assert.equal(
  (tabDockBlock.match(/paddingHorizontal:\s*SLLayout\.screenGutter/g) ?? []).length,
  1,
  'the global tab dock must own its horizontal gutter exactly once',
);
assert.match(
  tabLayout,
  /const displayedRoutes = visibleRoutes/,
  'every normal app shell must render its complete governed destination set',
);
assert.match(
  tabRowControl,
  /viewportWidth - \(SLLayout\.screenGutter \* 2\)[\s\S]*\{ width: expandedWidth \}/,
  'the normal app shell must occupy the persistent full-width navigation row',
);
assert.doesNotMatch(
  `${tabLayout}\n${tabRowControl}`,
  /setIsExpanded|showsExpandedTabRow|collapsedAnchorCfg|Open navigation/,
  'the global destination row must never collapse into one selected icon',
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

const approvedBlurBlock = workspaceAudit.match(/const approvedBlurFiles = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
assert.match(
  approvedBlurBlock,
  /['"]components\/navigation\/sl-tab-row-control\.tsx['"]/,
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
const navigationGlassSources = glassSources.filter((path) => (
  path === 'app/(tabs)/_layout.tsx' || path.includes('/navigation/')
));
assert.deepEqual(
  navigationGlassSources,
  ['components/navigation/sl-tab-row-control.tsx'],
  'no competing navigation surface may receive native or simulated glass styling',
);

assert.match(tabLayout, /<SLFloatingNavigationDock/);

console.log('Persistent bottom-tab shell and liquid-glass contract tests passed.');
