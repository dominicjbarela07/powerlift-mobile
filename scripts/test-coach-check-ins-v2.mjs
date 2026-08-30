#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const route = read('app/(tabs)/check-ins.tsx');
const surface = read('components/coach-mobile/CoachCheckInsV2.tsx');
const api = read('lib/api.ts');

assert.match(route, /activeMobileMode === 'coach' \|\| activeMobileMode === 'individual'/, 'coach and self-coach must share the command center');
assert.match(route, /<CoachCheckInsV2 initialAthleteId=/, 'coach route must render Check-Ins V2 with relationship-scoped context');
assert.doesNotMatch(route, /router\.replace\('\/(?:\(tabs\)\/)?athlete-dashboard/, 'self-coach must not be redirected away');

for (const contract of [
  'Forms', 'Athletes', 'Inbox', 'Create Check-In', 'ACTIVE FORMS', 'COVERAGE SUMMARY',
  'NEEDS REVIEW', 'OVERDUE', 'RECENTLY REVIEWED', 'Edit Form & Questions',
  'Assign Athletes & Schedule', 'QUESTIONS (', 'Reorder', 'Athlete local time',
  'CHECK-IN READ', 'CHANGED SINCE LAST CHECK-IN', 'RAW RESPONSES', 'No causal claim',
  'Completion Rate', 'Average Response Time', 'View Analytics',
]) assert.ok(surface.includes(contract), `missing Check-Ins V2 behavior: ${contract}`);

assert.match(surface, /StrengthLedgerBottomSheet[\s\S]*accessibilityLabel="Check-In form actions"/, 'form actions must use the canonical bottom sheet');
assert.match(surface, /StrengthLedgerBottomSheet[\s\S]*accessibilityLabel="Add Check-In question"/, 'question creation must use the canonical bottom sheet');
assert.match(surface, /style=\{\(\{ pressed \}\)/, 'visible actions must expose a pressed state');
assert.match(surface, /loading=\{saving\}/, 'mutations must expose in-flight state');
assert.match(surface, /disabled=\{!selected\.size\}/, 'assignment must fail closed without an athlete');
assert.match(surface, /prior_only_baseline/, 'interpretation must expose prior-only evidence');
assert.doesNotMatch(surface, /photo upload|video upload|muscle \/ body map/i, 'unsupported question types must not be faked');

for (const operation of [
  'getCoachCheckIns', 'getCoachCheckInReview', 'markCoachCheckInReviewed',
  'createCoachCheckInForm', 'updateCoachCheckInForm', 'duplicateCoachCheckInForm',
  'changeCoachCheckInFormState', 'updateCoachCheckInAssignments',
]) assert.match(api, new RegExp(`export async function ${operation}`), `missing bounded API operation: ${operation}`);

assert.match(api, /\/check-ins\/mobile\/coach/, 'command-center API must use the canonical coach Check-In namespace');

console.log('[coach-check-ins-v2] PASS — coach/self-coach route, command center, form lifecycle, coverage, review evidence, analytics, tactile sheets, and bounded APIs are protected');
