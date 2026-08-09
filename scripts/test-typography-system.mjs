import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const appRoots = [join(root, 'app'), join(root, 'components'), join(root, 'constants'), join(root, 'dev-mocks'), join(root, 'lib')];
const wordmarkPath = join(root, 'assets/images/16:9.png');
const selectedFonts = {
  Michroma: 'Michroma-Regular.ttf',
  'Exo2-Regular': 'Exo2-Regular.ttf',
  'Exo2-Medium': 'Exo2-Medium.ttf',
  'Exo2-SemiBold': 'Exo2-SemiBold.ttf',
  'Exo2-Bold': 'Exo2-Bold.ttf',
};

const collectSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(path);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name)) ? [path] : [];
});

for (const file of Object.values(selectedFonts)) {
  assert.equal(existsSync(join(root, 'assets/fonts', file)), true, `bundled font is missing: ${file}`);
}
for (const license of ['OFL.txt', 'OFL-Exo2.txt']) {
  const path = join(root, 'assets/fonts', license);
  assert.equal(existsSync(path), true, `font license is missing: ${license}`);
  assert.match(readFileSync(path, 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
}
assert.equal(existsSync(join(root, 'assets/fonts/README-Exo2.txt')), true, 'Exo 2 README is missing');

const rootLayout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
for (const [registeredName, file] of Object.entries(selectedFonts)) {
  assert.match(
    rootLayout,
    new RegExp(`['\"]?${registeredName.replace('-', '\\-')}['\"]?:\\s*require\\(['\"]@/assets/fonts/${file.replace('.', '\\.')}['\"]\\)`),
    `${registeredName} is not registered at the root font gate`,
  );
}
assert.doesNotMatch(rootLayout, /https?:\/\/[^'\"]+\.(?:ttf|otf|woff2?)/i, 'fonts must never be fetched at runtime');
assert.doesNotMatch(rootLayout, /@expo-google-fonts\//, 'runtime font packages must not replace bundled assets');
assert.match(rootLayout, /STARTUP_TIMEOUT_MS\s*=\s*6000/);
assert.match(rootLayout, /fontsLoaded \|\| fontError \|\| fontWaitExpired/);
assert.match(rootLayout, /Bundled Strength Ledger font loading failed/);

const theme = readFileSync(join(root, 'constants/theme.ts'), 'utf8');
for (const [alias, family] of Object.entries({
  display: 'Exo2-SemiBold', numeric: 'Michroma', technical: 'Exo2-Medium',
  body: 'Exo2-Regular', bodyMedium: 'Exo2-Medium', bodySemiBold: 'Exo2-SemiBold', bodyBold: 'Exo2-Bold', input: 'Exo2-Regular',
})) {
  assert.match(theme, new RegExp(`${alias}: ['\"]${family}['\"]`), `${alias} must resolve to ${family}`);
}

const requiredRoles = [
  'screenTitle', 'heroTitle', 'movementTitle', 'metricValue', 'metadata', 'metadataStrong', 'buttonLabel', 'micro',
  'pageTitle', 'sectionTitle', 'cardTitle', 'shortTechnicalLabel', 'navigationLabel', 'tabLabel',
  'shortButtonLabel', 'longButtonLabel', 'heroNumeric', 'numeric', 'percentage', 'unit',
  'milestoneThreshold', 'badge', 'body', 'supportingBody', 'caption', 'dynamicName',
  'workoutName', 'movementName', 'messageText', 'input', 'inputPlaceholder', 'modalTitle',
  'modalBody', 'errorText', 'emptyStateTitle', 'emptyStateBody',
];
for (const role of requiredRoles) {
  assert.match(theme, new RegExp(`\\n  ${role}: \\{`), `responsive typography role ${role} is missing`);
  assert.match(theme, new RegExp(`\\n  ${role}: (?:twoLineText|singleLineText|naturalText),`), `text behavior for ${role} is missing`);
}

for (const role of ['heroNumeric', 'numeric', 'percentage', 'milestoneThreshold']) {
  const roleBlock = theme.match(new RegExp(`\\n  ${role}: \\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
  assert.match(roleBlock, /fontFamily: SLFontFamilies\.numeric/, `${role} must use Michroma`);
}
for (const role of ['screenTitle', 'heroTitle', 'movementTitle', 'metadata', 'metadataStrong', 'buttonLabel', 'micro', 'pageTitle', 'sectionTitle', 'cardTitle', 'shortTechnicalLabel', 'navigationLabel', 'tabLabel', 'shortButtonLabel', 'longButtonLabel', 'unit', 'badge', 'body', 'supportingBody', 'caption', 'dynamicName', 'workoutName', 'movementName', 'messageText', 'input', 'inputPlaceholder', 'modalTitle', 'modalBody', 'errorText', 'emptyStateTitle', 'emptyStateBody']) {
  const roleBlock = theme.match(new RegExp(`\\n  ${role}: \\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
  assert.match(roleBlock, /fontFamily: SLFontFamilies\.(?:display|technical|body|bodyMedium|bodySemiBold|input)/, `${role} must use Exo 2`);
}
const metricValueBlock = theme.match(/\n  metricValue: \{([\s\S]*?)\n  \},/)?.[1] ?? '';
assert.match(metricValueBlock, /fontFamily: SLFontFamilies\.numeric/, 'metricValue must use Michroma');
assert.match(theme, /compactMax:\s*375/);
assert.match(theme, /standardMax:\s*429/);
assert.doesNotMatch(theme, /fontSize\s*\*\s*0\./, 'typography must use roles rather than a global scale factor');

const textPrimitive = readFileSync(join(root, 'components/ui/sl-text.tsx'), 'utf8');
assert.match(textPrimitive, /fontFamily: SLFontFamilies\.body/);
assert.match(textPrimitive, /typographyRole = 'input'/);
assert.match(textPrimitive, /SLTypographyTextBehaviors\[typographyRole\]/);
assert.match(textPrimitive, /ellipsizeMode=\{ellipsizeMode \?\? textBehavior\?\.ellipsizeMode\}/);
assert.match(textPrimitive, /style=\{\[SLAppTextStyle, style, typographyRole \? getSLTypographyRoleStyle\(typographyRole, width\) : null\]\}/);
assert.match(textPrimitive, /style=\{\[SLAppTextStyle, style, getSLTypographyRoleStyle\(typographyRole, width\)\]\}/);

const representativeChecks = [
  ['app/(tabs)/athlete-dashboard.tsx', /typographyRole="dynamicName"[^>]*style=\{styles\.athleteName\}/, 'athlete name'],
  ['app/(tabs)/athlete-dashboard.tsx', /typographyRole="workoutName"[^>]*style=\{\[styles\.todayTrainingTitle/, 'home workout name'],
  ['components/coach-mobile/SessionEditingWorkspace.tsx', /typographyRole="heroTitle"[^>]*style=\{styles\.identityTitle\}/, 'session workspace hero title'],
  ['app/(tabs)/messages/index.tsx', /typographyRole="messageText"/, 'message body'],
  ['app/(tabs)/messages/[threadId].tsx', /typographyRole="dynamicName"[^>]*style=\{styles\.headerTitle\}/, 'thread participant'],
  ['components/workout-logger/session-shell.tsx', /typographyRole="workoutName"/, 'logger workout name'],
  ['components/workout-logger/core-loggers.tsx', /typographyRole="movementName"/, 'logger movement name'],
  ['components/workout-logger/readiness-modal.tsx', /typographyRole="modalBody"[^>]*style=\{styles\.subtitle\}/, 'readiness explanation'],
  ['components/volume-achievements/VolumeAchievementExperience.tsx', /typographyRole="supportingBody"[^>]*style=\{styles\.totalCaption\}/, 'volume description'],
  ['app/(tabs)/dev-mocks/milestones.tsx', /typographyRole="heroNumeric"[^>]*style=\{styles\.heroValue\}/, 'milestone hero value'],
];
for (const [file, pattern, label] of representativeChecks) {
  assert.match(readFileSync(join(root, file), 'utf8'), pattern, `representative semantic role missing: ${label}`);
}

for (const file of appRoots.flatMap(collectSourceFiles)) {
  const source = readFileSync(file, 'utf8');
  const label = relative(root, file);
  if (label !== 'components/ui/sl-text.tsx') {
    assert.doesNotMatch(
      source,
      /import\s*\{[^;]*\b(?:Text|TextInput)\b[^;]*\}\s*from\s*['\"]react-native['\"]/s,
      `${label} bypasses the app-owned typography primitive`,
    );
  }
  assert.doesNotMatch(source, /https?:\/\/[^'\"]+\.(?:ttf|otf|woff2?)/i, `${label} fetches a runtime font`);
  assert.doesNotMatch(source, /fontFamily\s*:\s*['\"](?:Ionicons|MaterialIcons|FontAwesome)['\"]/, `${label} attempts to restyle an icon font`);
}

assert.equal(
  createHash('sha256').update(readFileSync(wordmarkPath)).digest('hex'),
  '86997ed5515c3c937944fff9a82fcb537d5831833152ba17bdb98d99eb17e7f0',
  'locked wordmark PNG changed',
);

console.log('[typography-system] bundled two-font assets, semantic roles, representative surfaces, wrappers, licenses, icon exclusions, startup gate, and locked wordmark checks passed');
