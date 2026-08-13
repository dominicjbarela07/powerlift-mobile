#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(process.cwd());
const prohibitedProperties = new Set([
  'margin',
  'marginEnd',
  'marginHorizontal',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginStart',
  'padding',
  'paddingEnd',
  'paddingHorizontal',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
]);

const prohibitedExternalInsetProperties = new Set([
  'margin',
  'marginEnd',
  'marginHorizontal',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginStart',
]);

const canonicalRootContracts = new Map(Object.entries({
  'app/(tabs)/_layout.tsx': ['tabScene'],
  'components/ui/sl-screen.tsx': ['safe', 'content', 'scroll', 'scrollContent', 'scrollMotion', 'padded'],
  'app/(tabs)/coach-videos.tsx': ['screen'],
  'components/reviews/review-list-screen.tsx': ['screen'],
  'app/(tabs)/coach-session-review.tsx': ['screen'],
  'app/(tabs)/coach-video-review.tsx': ['screen', 'scrollContent'],
  'app/(tabs)/coach-video-archive.tsx': ['screen', 'scrollContent'],
  'app/(tabs)/coach-calendar.tsx': ['screen', 'monthContent', 'agendaContent'],
  'app/(tabs)/athlete-calendar.tsx': ['root'],
  'components/calendar/AthleteCalendarExperience.tsx': [
    'root',
    'body',
    'v2ScrollContent',
    'monthScrollContent',
    'dayScrollContent',
  ],
  'components/coach-mobile/SessionEditingWorkspace.tsx': ['root', 'content'],
  'components/ledger/primitives.tsx': ['screen', 'content'],
  'components/ledger/v2/index-screen.tsx': ['page'],
  'components/ledger/v2/journey-screen.tsx': ['page'],
  'components/ledger/v2/strength-screen.tsx': ['page'],
  'components/ledger/v2/achievements-screen.tsx': ['page'],
  'components/ledger/v2/catalog-screen.tsx': ['page'],
  'components/ledger/v2/muscle-screen.tsx': ['page'],
  'components/ledger/v2/archive-screen.tsx': ['page'],
  'app/(tabs)/create-workout.tsx': ['screen', 'content'],
  'app/(tabs)/accessory-catalog-review.tsx': ['screen', 'content'],
  'app/coach-team-brief.tsx': ['screenContent', 'content'],
  'app/(tabs)/coach-invite-athlete.tsx': ['content'],
  'app/(tabs)/link-coach.tsx': ['screen', 'content'],
  'app/login.tsx': ['screen', 'scrollContent'],
  'app/verify-email.tsx': ['screen', 'content'],
}));

const fullBleedSurfaceContracts = new Map(Object.entries({
  'components/calendar/AthleteCalendarExperience.tsx': [
    'focusedWeekSection',
    'lensHandleButton',
    'trainingLens',
    'journeyWrap',
  ],
}));

const genericRouteRootStyleNames = new Set([
  'canvas',
  'container',
  'gateScreen',
  'gestureRoot',
  'page',
  'root',
  'safe',
  'safeArea',
  'screen',
  'scrollScreen',
  'tabScene',
  'workspace',
]);

function propertyName(node) {
  if (!node?.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function styleObjects(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return null;
  const source = fs.readFileSync(absolute, 'utf8');
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const styles = new Map();

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(sourceFile) === 'StyleSheet'
      && node.expression.name.text === 'create'
      && node.arguments.length
      && ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const property of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
        const name = propertyName(property);
        if (name) styles.set(name, property.initializer);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { sourceFile, styles };
}

function horizontalInsets(styleObject) {
  return styleObject.properties
    .filter((property) => ts.isPropertyAssignment(property))
    .map(propertyName)
    .filter((name) => name && prohibitedProperties.has(name));
}

function externalHorizontalInsets(styleObject) {
  return styleObject.properties
    .filter((property) => ts.isPropertyAssignment(property))
    .map(propertyName)
    .filter((name) => name && prohibitedExternalInsetProperties.has(name));
}

const findings = [];
for (const [relative, styleNames] of canonicalRootContracts) {
  const parsed = styleObjects(relative);
  if (!parsed) {
    findings.push(`${relative} is missing`);
    continue;
  }
  for (const styleName of styleNames) {
    const styleObject = parsed.styles.get(styleName);
    if (!styleObject) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    const insets = horizontalInsets(styleObject);
    if (insets.length) {
      findings.push(`${relative}::${styleName} adds page-level horizontal inset(s): ${insets.join(', ')}`);
    }
  }
}

for (const [relative, styleNames] of fullBleedSurfaceContracts) {
  const parsed = styleObjects(relative);
  if (!parsed) {
    findings.push(`${relative} is missing`);
    continue;
  }
  for (const styleName of styleNames) {
    const styleObject = parsed.styles.get(styleName);
    if (!styleObject) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    const insets = externalHorizontalInsets(styleObject);
    if (insets.length) {
      findings.push(`${relative}::${styleName} adds an outer horizontal inset: ${insets.join(', ')}`);
    }
  }
}

const appRoot = path.join(root, 'app');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

for (const absolute of walk(appRoot)) {
  const relative = path.relative(root, absolute);
  const parsed = styleObjects(relative);
  if (!parsed) continue;
  for (const [styleName, styleObject] of parsed.styles) {
    if (!genericRouteRootStyleNames.has(styleName)) continue;
    const insets = horizontalInsets(styleObject);
    if (insets.length) {
      findings.push(`${relative}::${styleName} adds page-level horizontal inset(s): ${insets.join(', ')}`);
    }
  }
}

const uniqueFindings = [...new Set(findings)].sort();
if (uniqueFindings.length) {
  console.error('Mobile horizontal-layout audit failed:');
  uniqueFindings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Mobile horizontal-layout audit passed (${canonicalRootContracts.size} canonical files plus all app route roots checked).`);
console.log('Screen/page roots are edge-to-edge; horizontal spacing is owned by child surfaces.');
