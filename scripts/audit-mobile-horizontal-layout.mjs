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
  'app/(tabs)/athlete-dashboard.tsx': ['safeArea', 'scrollContent'],
  'app/(tabs)/athlete-meet-plan.tsx': ['safeArea', 'screen', 'scroll'],
  'app/(tabs)/athlete-progression.tsx': ['screen', 'scroll'],
  'app/(tabs)/check-in/[submissionId].tsx': ['screen', 'scroll'],
  'app/(tabs)/check-ins.tsx': ['screen', 'scroll'],
  'app/(tabs)/coach-kpi/[kind].tsx': ['screen', 'scrollContent'],
  'app/(tabs)/coach-reviews.tsx': ['screen', 'scrollContent'],
  'app/(tabs)/session-surveys.tsx': ['scroll', 'scrollContent'],
  'app/(tabs)/settings.tsx': ['screen', 'scrollContent'],
  'app/(tabs)/video-archive.tsx': ['screen', 'scrollContent'],
  'app/(tabs)/workout/[workoutId].tsx': ['screen', 'container'],
  'app/(tabs)/workout/block-details.tsx': ['screen', 'scroll'],
  'app/(tabs)/workout/create-program.tsx': ['screen', 'scroll'],
  'app/(tabs)/workout/index.tsx': ['root', 'screen', 'scroll', 'programmingScroll', 'programmingStoryboardHost'],
  'app/(tabs)/workout/session-workspace/[workoutId].tsx': ['screen', 'content'],
  'components/ui/sl-screen.tsx': ['safe', 'content', 'scroll', 'scrollContent', 'scrollMotion', 'padded'],
  'app/(tabs)/coach-videos.tsx': ['screen'],
  'components/reviews/review-list-screen.tsx': ['screen'],
  'components/coach-mobile/CoachSessionReviewerV3.tsx': ['screen', 'content'],
  'components/coach-mobile/CompletedSessionRecap.tsx': [
    'screen',
    'content',
    'sectionShell',
    'compareFilters',
    'compareMovementStack',
    'comparisonLegend',
  ],
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
  'app/(tabs)/create-workout.tsx': ['screen', 'content'],
  'app/(tabs)/accessory-catalog-review.tsx': ['screen', 'content'],
  'app/coach-team-brief.tsx': ['screen', 'content'],
  'app/coach-team-outliers.tsx': ['screen', 'content'],
  'app/coach-athlete-analytics/[athleteId].tsx': ['screen', 'content'],
  'app/(tabs)/coach-invite-athlete.tsx': ['content'],
  'app/(tabs)/link-coach.tsx': ['screen', 'content'],
  'app/login.tsx': ['screen', 'scrollContent'],
  'app/verify-email.tsx': ['screen', 'content'],
  'components/coach-mobile/CoachActivityHome.tsx': ['screen', 'content'],
  'components/coach-mobile/CoachAthleteHubV2.tsx': ['screen', 'content'],
  'components/coach-mobile/CoachAttentionDetailV2.tsx': ['screen', 'content'],
  'components/coach-mobile/CoachCheckInsV2.tsx': ['screen', 'page'],
  'components/coach-mobile/CoachHomeV2.tsx': ['screen', 'content'],
  'components/meet-packet/AthleteMeetPacketV2.tsx': ['screen', 'scrollBody'],
  'components/home/AthleteHomeV3.tsx': ['page'],
}));

const fullWidthSheetContracts = new Map(Object.entries({
  'components/sheets/StrengthLedgerBottomSheet.tsx': ['sheet'],
  'components/calendar/CalendarEventSheet.tsx': ['sheet'],
  'components/training-hub/TrainingHubSessionPreviewSheet.tsx': ['sheet'],
  'components/workout-logger/readiness-modal.tsx': ['sheet'],
  'components/workout-logger/substitution-confirmation-sheet.tsx': ['sheet'],
  'app/(tabs)/coach-calendar.tsx': ['sheet'],
}));

const sheetStageContracts = new Map(Object.entries({
  'components/workout-logger/readiness-modal.tsx': ['backdrop'],
}));

const fullBleedSurfaceContracts = new Map(Object.entries({
  'components/coach-mobile/CoachSessionReviewerV3.tsx': ['tabs'],
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
        if (name) styles.set(name, [...(styles.get(name) || []), property.initializer]);
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

function restrictedRootGeometry(styleObject, sourceFile) {
  const findings = [];
  for (const property of styleObject.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property);
    const value = property.initializer.getText(sourceFile);
    if (name === 'maxWidth') findings.push(`maxWidth: ${value}`);
    if (name === 'width' && !/^['\"]100%['\"]$/.test(value)) findings.push(`width: ${value}`);
    if (name === 'alignSelf' && /^['\"]center['\"]$/.test(value)) findings.push(`alignSelf: ${value}`);
  }
  return findings;
}

function hasFullWidth(styleObject, sourceFile) {
  return styleObject.properties.some((property) => (
    ts.isPropertyAssignment(property)
    && propertyName(property) === 'width'
    && /^['\"]100%['\"]$/.test(property.initializer.getText(sourceFile))
  ));
}

const findings = [];
for (const [relative, styleNames] of canonicalRootContracts) {
  const parsed = styleObjects(relative);
  if (!parsed) {
    findings.push(`${relative} is missing`);
    continue;
  }
  for (const styleName of styleNames) {
    const objects = parsed.styles.get(styleName);
    if (!objects?.length) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    for (const styleObject of objects) {
      const insets = horizontalInsets(styleObject);
      if (insets.length) {
        findings.push(`${relative}::${styleName} adds page-level horizontal inset(s): ${insets.join(', ')}`);
      }
      const geometry = restrictedRootGeometry(styleObject, parsed.sourceFile);
      if (geometry.length) {
        findings.push(`${relative}::${styleName} restricts page-level width: ${geometry.join(', ')}`);
      }
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
    const objects = parsed.styles.get(styleName);
    if (!objects?.length) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    for (const styleObject of objects) {
      const insets = externalHorizontalInsets(styleObject);
      if (insets.length) {
        findings.push(`${relative}::${styleName} adds an outer horizontal inset: ${insets.join(', ')}`);
      }
    }
  }
}

for (const [relative, styleNames] of fullWidthSheetContracts) {
  const parsed = styleObjects(relative);
  if (!parsed) {
    findings.push(`${relative} is missing`);
    continue;
  }
  for (const styleName of styleNames) {
    const objects = parsed.styles.get(styleName);
    if (!objects?.length) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    for (const styleObject of objects) {
      if (!hasFullWidth(styleObject, parsed.sourceFile)) {
        findings.push(`${relative}::${styleName} must explicitly use width: '100%'`);
      }
      const geometry = restrictedRootGeometry(styleObject, parsed.sourceFile);
      if (geometry.length) findings.push(`${relative}::${styleName} restricts sheet width: ${geometry.join(', ')}`);
    }
  }
}

for (const [relative, styleNames] of sheetStageContracts) {
  const parsed = styleObjects(relative);
  if (!parsed) {
    findings.push(`${relative} is missing`);
    continue;
  }
  for (const styleName of styleNames) {
    const objects = parsed.styles.get(styleName);
    if (!objects?.length) {
      findings.push(`${relative}::${styleName} is missing`);
      continue;
    }
    for (const styleObject of objects) {
      const insets = horizontalInsets(styleObject);
      if (insets.length) findings.push(`${relative}::${styleName} insets a bottom-sheet stage: ${insets.join(', ')}`);
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
  for (const [styleName, objects] of parsed.styles) {
    if (!genericRouteRootStyleNames.has(styleName)) continue;
    for (const styleObject of objects) {
      const insets = horizontalInsets(styleObject);
      if (insets.length) {
        findings.push(`${relative}::${styleName} adds page-level horizontal inset(s): ${insets.join(', ')}`);
      }
      const geometry = restrictedRootGeometry(styleObject, parsed.sourceFile);
      if (geometry.length) findings.push(`${relative}::${styleName} restricts page-level width: ${geometry.join(', ')}`);
    }
  }
}

const uniqueFindings = [...new Set(findings)].sort();
if (uniqueFindings.length) {
  console.error('Mobile horizontal-layout audit failed:');
  uniqueFindings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Mobile horizontal-layout audit passed (${canonicalRootContracts.size} canonical files, ${fullWidthSheetContracts.size} sheet contracts, plus all app route roots checked).`);
console.log('Screen/page roots are edge-to-edge; horizontal spacing is owned by child surfaces.');
