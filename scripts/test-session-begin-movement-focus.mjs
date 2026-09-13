import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
const ast=ts.createSourceFile('logger.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const firstIncomplete = orderedMovements.find'))effect=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(effect);
function run({status='in_progress',focused=null,manual=true,expanded={},complete=false,hydrated=true}={}){
 const calls=[];const rows=[{key:'acc:1',total:1,complete},{key:'acc:2',total:1,complete:false}];
 const ctx={data:{workout:{id:123,status}},journalHydrated:hydrated,getOrderedWorkoutMovements:()=>rows,autoExpandWorkoutIdRef:{current:123},manualMovementSelectionRef:{current:manual},pendingAutoAdvanceRef:{current:null},focusedMovementKey:focused,expandedCoreDetails:{},expandedCompletedMovements:expanded,openMovementCard:key=>calls.push(key),collapseMovementCard:()=>{},scheduleMovementFocus:()=>{},configureNextMovementLayoutTransition:()=>{}};
 vm.runInNewContext(ts.transpileModule(`(${effect})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return calls;
}
assert.deepEqual(run(),['acc:1'],'PRE browsing/manual flag plus cleared focus must not strand Begin Session on an empty active view');
assert.deepEqual(run({focused:'acc:deleted'}),['acc:1'],'stale focus falls back to a governed existing movement');
assert.deepEqual(run({focused:'acc:2',expanded:{2:true}}),[],'valid manual active selection is preserved');
assert.deepEqual(run({focused:'acc:2'}),['acc:2'],'remount restores the exact selected movement');
assert.deepEqual(run({complete:true}),['acc:2'],'fallback skips completed movements');
assert.deepEqual(run({status:'assigned'}),[],'PRE remains a plan');
assert.deepEqual(run({hydrated:false}),[],'journal restoration remains authoritative');
console.log('Begin Session focus: PRE browsing → ACTIVE fallback, stale focus, manual selection, remount, completion and hydration PASS');
