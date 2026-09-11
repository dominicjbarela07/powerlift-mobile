import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root = new URL('../../', import.meta.url);
function loadModule(relative) {
  const module = { exports: {} };
  const source = fs.readFileSync(new URL(relative, root), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module });
  return module.exports;
}
export const source = fs.readFileSync(new URL('components/coach-mobile/SessionEditingWorkspace.tsx', root), 'utf8');
export const route = fs.readFileSync(new URL('app/(tabs)/workout/session-workspace/[workoutId].tsx', root), 'utf8');
const file = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['ensureCoreVariantManualLoad', 'createSessionWorkspaceDraft', 'cloneSessionWorkspaceDraft', 'sessionWorkspaceDraftIsDirty', 'buildSessionWorkspaceSavePlan', 'addSessionDraftMovement', 'removeSessionDraftMovement', 'movementItemWithDraft'];
const functions = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map((node) => node.getText(file)).join('\n');
const code = ts.transpileModule(`let draftMovementSequence = -Date.now() * 1000;\n${functions}\nObject.assign(result, {${names.join(',')}});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
export const model = {};
vm.runInNewContext(code, { ...loadModule('lib/coach-session-editor.ts'), ...loadModule('lib/session-workspace-persistence.ts'), result: model, Date, Math, JSON, Object, Set });
export const plain = (value) => JSON.parse(JSON.stringify(value));
export function fixture() {
  return model.createSessionWorkspaceDraft({ title: 'Lower A', athleteId: 12, scheduledDate: '2026-09-12', storageUnit: 'lb', notes: '', coreItems: [{ id: 1, lift: 'SQ', variant: 'STRAIGHT', movement: 'Squat', core_movement: { id: 101 }, designation: 'PRIMARY', sets: 3, reps: 5, mode: 'RPE', rpe_target: 7 }], accessoryItems: [{ id: 2, lift: 'ACC', variant: 'ACC', movement: 'Pulldown', movement_identity: { id: 202 }, sets: 3, reps_text: '10-12', rir_target: 2 }, { id: 3, lift: 'ACC', variant: 'ACC', movement: 'Row', movement_identity: { id: 203 }, sets: 3, reps_text: '12', rir_target: 2 }] });
}
