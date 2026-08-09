#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bootstrap = fs.readFileSync(path.join(root, 'app', '(tabs)', 'create-workout.tsx'), 'utf8');
const workspaceRoute = fs.readFileSync(path.join(root, 'app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'components', 'coach-mobile', 'SessionEditingWorkspace.tsx'), 'utf8');

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`[adaptive-session-workspace-policy] ${message}`);
    process.exit(1);
  }
}

assertMatch(bootstrap, /status: 'draft'[\s\S]*core_items: \[\][\s\S]*acc_items: \[\]/, 'creation must bootstrap a server-backed draft instead of a local movement builder.');
assertMatch(bootstrap, /pathname: '\/workout\/session-workspace\/\[workoutId\]'/, 'created and legacy edit Sessions must enter the Adaptive Session Workspace.');
assertMatch(workspaceRoute, /TOP_BACKDOWN[\s\S]*FULL_CUSTOM/, 'the Adaptive Session Workspace must own Core pattern selection.');
assertMatch(workspace, /function FullCustomSetEditor/, 'Full Custom planned-set editing must remain in the persistent movement workspace.');
assertMatch(workspace, /function SessionEditorModeSelector[\s\S]*label="Athlete View"[\s\S]*label="Reorder"/, 'the workspace must expose only valid mode actions.');
assertMatch(workspaceRoute, /\/core-lifts/, 'Core movement creation must remain wired to the authoritative Session API.');

console.log('[adaptive-session-workspace-policy] ok');
