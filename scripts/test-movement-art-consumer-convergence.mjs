import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync('config/movement-art-consumers.json','utf8'));
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p);}}
walk('app');walk('components');
const actual=[];
const renderer='components/movement/CanonicalMovementArtwork.tsx';
const retired='components/workout-logger/accessory-muscle-region-medallion.tsx';
for(const file of files){
 const source=fs.readFileSync(file,'utf8');const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let rendererCount=0;
 function visit(node){
  if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(tree)==='CanonicalMovementArtwork'){
   rendererCount++;
   assert.ok(node.attributes.properties.some(a=>ts.isJsxAttribute(a)&&['surface','testID'].includes(a.name.getText(tree))),`${file}: unresolved diagnostics require an identifiable surface`);
   const movement=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)==='movement');
   const expression=movement?.initializer&&ts.isJsxExpression(movement.initializer)?movement.initializer.expression:null;
   if(expression&&ts.isObjectLiteralExpression(expression)){
    assert.ok(!expression.properties.some(p=>p.name?.getText(tree)==='id'),`${file}: generic row ID cannot cross the artwork boundary`);
    assert.ok(!expression.properties.some(p=>ts.isSpreadAssignment(p)),`${file}: untyped object spread requires a semantic definition/subject adapter`);
   }
  }
  if(file!==renderer&&ts.isJsxText(node))assert.notEqual(node.text.trim(),'?',`${file}: consumer-owned question-mark fallback is forbidden`);
  ts.forEachChild(node,visit);
 }
 visit(tree);
 if(rendererCount)actual.push({file,rendererCount});
 if(![renderer,retired,'components/coach-mobile/CoachCheckInsV2.tsx'].includes(file))assert.doesNotMatch(source,/['"]help-outline['"]|['"]help-circle['"]/,`${file}: unresolved art is owned by the canonical renderer`);
 if(file!==retired)assert.doesNotMatch(source,/import[\s\S]*?from ['"][^'"]*accessory-muscle-region-medallion['"]/,`${file}: retired consumer-owned artwork cannot return`);
}
assert.deepEqual(actual.sort((a,b)=>a.file.localeCompare(b.file)),manifest.consumers.toSorted((a,b)=>a.file.localeCompare(b.file)),'New/changed canonical consumers require inventory review');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.match(read(renderer),/normalizeCanonicalMovementArtSubject\(movement\)/);
assert.match(read(renderer),/resolveCanonicalMovementArtwork\(subject\)/);
assert.match(read(renderer),/resolveApprovedExactMovementArtwork\(subject\)/);
assert.match(read(renderer),/if \(!__DEV__ \|\| resolution.kind !== 'neutral'\) return/);
assert.match(read('lib/canonical-movement-artwork-assets.ts'),/accessoryMuscleRegionAsset\(resolution.regionKey\)/);
const subject=read('lib/canonical-movement-art-subject.ts');
assert.doesNotMatch(subject,/\brow\.id\b|display_name|movement_name|manufacturer/,'normalization never guesses from ambiguous IDs or display names');
console.log(`Movement art consumer convergence: ${actual.length} consumers / ${actual.reduce((sum,c)=>sum+c.rendererCount,0)} render sites; shared normalization, explicit IDs, central fallback and DEV diagnostics PASS`);
