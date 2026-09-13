const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),ts=require('typescript');
const rows=JSON.parse(fs.readFileSync('docs/validation/sheet-gesture-2026-09-13/legacy-sheet-migration.json'));const files=[...new Set(rows.map(x=>x.file))];
function normalized(src){
 src=src.replace(/<StrengthLedgerSheetDragRegion\s*\/>/g,'').replace(/<\/?StrengthLedgerSheetDragRegion>/g,'').replace(/StrengthLedgerSheetModalAdapter/g,'Modal');
 const sf=ts.createSourceFile('source.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 for(const n of [...sf.statements].reverse())if(ts.isImportDeclaration(n))src=src.slice(0,n.pos)+src.slice(n.end);
 return ts.transpileModule(src,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,removeComments:true}}).outputText;
}
const result=files.map(file=>{assert.equal(normalized(fs.readFileSync(file,'utf8')),normalized(cp.execFileSync('git',['show','2afac51886ba7f00fc63ac1aab6b5b342f33fb70:'+file],{encoding:'utf8'})),file);return {file,content_and_handlers_unchanged:true};});
fs.writeFileSync('docs/validation/sheet-gesture-2026-09-13/source-fidelity.json',JSON.stringify({baseline:'2afac51886ba7f00fc63ac1aab6b5b342f33fb70',files:result,legacy_sheets:rows.length,method:'Whole emitted consumer JS identical after removing only imports, explicit top wrapper, and Modal adapter renaming.'},null,2)+'\n');console.log(result.length+' files / '+rows.length+' sheets: original props, handlers, scroll/content, subject mutations and styles preserved');
