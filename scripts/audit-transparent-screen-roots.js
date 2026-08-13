#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(process.cwd());
const scanRoots = ['app', 'components', 'dev-mocks'];
const routeRootStyleNames = new Set([
  'canvas',
  'gateScreen',
  'gestureRoot',
  'headerShell',
  'loadingWrap',
  'padded',
  'page',
  'root',
  'safe',
  'safeArea',
  'screen',
  'screenCentered',
  'scroll',
  'scrollView',
  'startupScreen',
  'tabScene',
  'transparentScene',
  'workspace',
]);
const transparentExpressions = new Set(["'transparent'", '"transparent"']);
const backgroundOwner = 'components/ui/sl-workspace.tsx::workspace';
const gutterOwners = new Set([
  'app/(tabs)/_layout.tsx::headerShell',
]);
const prohibitedHorizontalInsetProperties = new Set([
  'marginHorizontal',
  'paddingHorizontal',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
]);
const transparentRootStyles = new Set();

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function propertyName(node) {
  if (!node || !node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function backgroundExpression(styleObject, sourceFile) {
  const property = styleObject.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === 'backgroundColor',
  );
  return property ? property.initializer.getText(sourceFile) : null;
}

function horizontalInsetProperties(styleObject) {
  return styleObject.properties
    .filter((candidate) => ts.isPropertyAssignment(candidate))
    .map((candidate) => propertyName(candidate))
    .filter((name) => name && prohibitedHorizontalInsetProperties.has(name));
}

const findings = [];
const sourceFiles = scanRoots.flatMap((scanRoot) => walk(path.join(root, scanRoot)));
for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(sourceFile) === 'StyleSheet'
      && node.expression.name.text === 'create'
      && node.arguments.length
      && ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const styleProperty of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(styleProperty)) continue;
        const styleName = propertyName(styleProperty);
        if (!styleName || !routeRootStyleNames.has(styleName)) continue;
        if (!ts.isObjectLiteralExpression(styleProperty.initializer)) continue;

        const expression = backgroundExpression(styleProperty.initializer, sourceFile);
        const identity = `${relative}::${styleName}`;
        const horizontalInsets = horizontalInsetProperties(styleProperty.initializer);
        if (horizontalInsets.length && !gutterOwners.has(identity)) {
          findings.push(`${identity} adds prohibited page-level inset(s): ${horizontalInsets.join(', ')}`);
        }
        if (!expression) continue;
        if (identity === backgroundOwner) continue;
        if (transparentExpressions.has(expression)) transparentRootStyles.add(identity);
        if (!transparentExpressions.has(expression)) {
          findings.push(`${identity} paints ${expression}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (relative.startsWith(`app${path.sep}`) && source.includes('SLWorkspaceBackground')) {
    findings.push(`${relative} mounts SLWorkspaceBackground inside a route`);
  }
}

const requiredContracts = [
  {
    file: 'components/AppShell.tsx',
    snippets: ['<SLWorkspaceBackground />'],
  },
  {
    file: 'components/ui/sl-screen.tsx',
    snippets: [],
  },
  {
    file: 'app/_layout.tsx',
    snippets: [
      'contentStyle: styles.transparentScene',
      '<AppShell>',
    ],
  },
  {
    file: 'app/(tabs)/_layout.tsx',
    snippets: [
      'sceneStyle: styles.tabScene',
    ],
  },
];

for (const contract of requiredContracts) {
  const file = path.join(root, contract.file);
  const source = fs.readFileSync(file, 'utf8');
  for (const snippet of contract.snippets) {
    if (!source.includes(snippet)) {
      findings.push(`${contract.file} is missing required contract: ${snippet}`);
    }
  }
}

for (const identity of [
  'components/ui/sl-screen.tsx::safe',
  'components/ui/sl-screen.tsx::scroll',
  'app/_layout.tsx::transparentScene',
  'app/(tabs)/_layout.tsx::tabScene',
]) {
  if (!transparentRootStyles.has(identity)) {
    findings.push(`${identity} must explicitly declare a transparent background`);
  }
}

const workspaceConsumers = sourceFiles
  .filter((file) => path.relative(root, file) !== 'components/ui/sl-workspace.tsx')
  .filter((file) => fs.readFileSync(file, 'utf8').includes('<SLWorkspaceBackground'))
  .map((file) => path.relative(root, file));
if (workspaceConsumers.length !== 1 || workspaceConsumers[0] !== 'components/AppShell.tsx') {
  findings.push(
    `SLWorkspaceBackground must be mounted only by components/AppShell.tsx; found: ${workspaceConsumers.join(', ') || 'none'}`,
  );
}

if (findings.length) {
  console.error('Transparent screen-root audit failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Transparent screen-root audit passed (${sourceFiles.length} TypeScript files checked).`);
console.log('The global AppShell is the sole SLWorkspaceBackground owner.');
