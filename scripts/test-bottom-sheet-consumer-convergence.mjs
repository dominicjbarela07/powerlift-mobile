import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const inventory=JSON.parse(fs.readFileSync('config/bottom-sheet-consumer-inventory.json','utf8'));
const files=execFileSync('rg',['--files','app','components'],{encoding:'utf8'}).trim().split('\n').filter(file=>file.endsWith('.tsx'));
let modalCount=0,sharedCount=0,inlineCount=0;
for(const file of files){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,99,true,4);let index=0;
 const tag=n=>(n.openingElement||n).tagName?.getText(ast);
 function descendants(n,predicate){const out=[];function visit(x){if(predicate(x))out.push(x);ts.forEachChild(x,visit);}visit(n);return out;}
 function visit(n){
  if(ts.isJsxElement(n)&&['Modal','StrengthLedgerSheetModalAdapter'].includes(tag(n))){
   const currentIndex=index++;const record=inventory.modalConsumers.find(row=>row.file===file&&row.index===currentIndex);assert.ok(record,`Unclassified modal ${file} #${index-1}: classify its actual presentation`);modalCount++;
   assert.equal(tag(n),record.presentation==='legacy-bottom-sheet'?'StrengthLedgerSheetModalAdapter':'Modal',`${file}: preserve the classified boundary`);
   if(record.presentation==='legacy-bottom-sheet'){
    const regions=descendants(n,x=>(ts.isJsxElement(x)||ts.isJsxSelfClosingElement(x))&&tag(x)==='StrengthLedgerSheetDragRegion');assert.equal(regions.length,1,`${file}: exactly one top drag region`);
    assert.equal(descendants(regions[0],x=>(ts.isJsxElement(x)||ts.isJsxSelfClosingElement(x))&&/^(ScrollView|FlatList|SectionList|TextInput|LoggerWheelPicker|StrengthLedgerBottomSheetScrollView)$/.test(tag(x))).length,0,`${file}: no body/list/input/wheel in chrome`);
   }
  }
  if((ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n))&&tag(n)==='StrengthLedgerBottomSheet')sharedCount++;
  if(ts.isJsxElement(n)&&tag(n)==='StrengthLedgerSheetGestureSurface'){
   inlineCount++;assert.ok(inventory.inlineBottomPanels.some(row=>row.file===file));
   const regions=descendants(n,x=>ts.isJsxElement(x)&&tag(x)==='StrengthLedgerSheetDragRegion');assert.equal(regions.length,1);
   assert.equal(descendants(regions[0],x=>(ts.isJsxElement(x)||ts.isJsxSelfClosingElement(x))&&/ScrollView|FlatList|SectionList|TextInput/.test(tag(x))).length,0);
  }
  ts.forEachChild(n,visit);
 }visit(ast);
}
assert.equal(modalCount,inventory.modalConsumers.length,'no missing classified consumers');assert.equal(inlineCount,3);
const shared=fs.readFileSync('components/sheets/StrengthLedgerBottomSheet.tsx','utf8');assert.doesNotMatch(shared,/Gesture\.Simultaneous|Gesture\.Native|bodyDismissGesture|contentSwipeEnabled|scrollOffsetY|onTouchesUp/,'no competing body/cancel gesture authority');
const preview=fs.readFileSync('components/training-hub/TrainingHubSessionPreviewSheet.tsx','utf8');assert.match(preview,/style=\{styles.dragArea\} \{\.\.\.dragResponder.panHandlers\}/);assert.equal((preview.match(/\.panHandlers/g)||[]).length,1);assert.match(preview,/shouldCaptureBottomSheetDismissGesture\(\{ dx: gesture.dx, dy: gesture.dy, origin: 'chrome' \}\)/);assert.match(preview,/shouldDismissBottomSheet\(\{ dy: gesture.dy, vy: gesture.vy \}\)/);
console.log(`Bottom-sheet inventory: ${modalCount} classified modal presentations, ${sharedCount} canonical sheet consumers, ${inlineCount} embedded bottom panels; top regions exclude scroll/input/wheel content PASS`);
