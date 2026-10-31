import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const code = ts.transpileModule(fs.readFileSync(new URL('../components/ledger/use-ledger-history.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness() {
  const slots=[],effects=[],calls=[]; let index=0,dirty=false,output;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;dirty=true;}];},
    useRef(initial){const i=index++;return slots[i]??(slots[i]={current:initial});},
    useCallback(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn};return slots[i].value;},
    useEffect(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
  };
  const request=(kind,args)=>{const pending=deferred();calls.push({kind,args,...pending});return pending.promise;};
  const deps={react,'@/lib/ledger-archive':{fetchArchiveCollection:(...args)=>request('archive',args)},'@/lib/ledger-data':{fetchLedgerAccomplishmentPage:(...args)=>request('prs',args)},'@/lib/ledger-rewards':{CAREER_PR_EVENT_TYPES:['CORE_WEIGHT_PR','CORE_E1RM_PR','CORE_REP_MAX_PR']},'./use-ledger-resource':{useEvidenceRevision:()=>state.revision}};
  const mod={exports:{}}; vm.runInNewContext(code,{module:mod,exports:mod.exports,require:key=>{assert.ok(key in deps,key);return deps[key];},Map,Promise});
  const state={subject:'athlete:68',athleteId:undefined,filter:'training',query:'',range:{},revision:0};
  async function render(){for(let i=0;i<20;i++){index=0;dirty=false;output=mod.exports.useLedgerHistory(state.subject,state.athleteId,state.filter,state.query,state.range);while(effects.length)effects.shift()();await new Promise(r=>setImmediate(r));if(!dirty)break;}return output;}
  return {state,calls,render,get output(){return output;}};
}
const item=id=>({archive_item_type:'session',source_id:id,title:`Session ${id}`});
const page=(ids,cursor=null)=>({items:ids.map(item),has_more:Boolean(cursor),next_cursor:cursor});
let h=harness();await h.render();assert.equal(h.calls.length,1);assert.equal(h.calls[0].args[1].athlete_id,undefined,'Own athlete history must use authenticated self');
assert.equal(h.calls[0].args[1].source_type,'session','Calendar must count completed Sessions, not imported rows');
h.calls[0].resolve(page([1,2],'older'));await h.render();assert.equal(h.output.items.length,2);
h.output.more();h.output.more();await h.render();assert.equal(h.calls.length,2,'Repeated taps cannot overlap cursor requests');
h.calls[1].resolve(page([2,3]));await h.render();assert.deepEqual(Array.from(h.output.items,i=>i.source_id),[1,2,3],'Cursor overlap must not duplicate evidence');

h=harness();await h.render();const obsolete=h.calls[0];h.state.subject='coach:78';h.state.athleteId=78;await h.render();assert.equal(h.output.items.length,0);obsolete.resolve(page([99]));await h.render();assert.equal(h.output.items.length,0,'Another subject cannot receive an obsolete response');h.calls[1].resolve(page([4],'next'));await h.render();assert.equal(h.output.items[0].source_id,4);
h.output.more();await h.render();h.calls[2].reject(Object.assign(new Error('offline'),{status:503}));await h.render();assert.equal(h.output.items[0].source_id,4);assert.equal(h.output.cursor,'next','A failed page remains retryable');
h.output.more();await h.render();h.calls[3].reject(Object.assign(new Error('revoked'),{status:403}));await h.render();assert.equal(h.output.items.length,0,'Denied access must clear retained evidence');assert.equal(h.output.cursor,null);
h.output.reload();await h.render();h.calls[4].resolve(page([5]));await h.render();assert.equal(h.output.items[0].source_id,5);
h.state.query='squat';await h.render();assert.equal(h.output.items.length,0);assert.equal(h.calls[5].args[1].q,'squat');assert.equal(h.calls[5].args[0],'training','Search stays inside the selected collection');h.calls[5].resolve(page([]));await h.render();
h.state.filter='prs';await h.render();const pr=h.calls[6];assert.equal(pr.kind,'prs');assert.equal(pr.args[0],50,'Use one bounded, canonical maximum page for a meaningful multi-movement record trail');assert.equal(pr.args[2],78);assert.deepEqual([...pr.args[4]],['CORE_WEIGHT_PR','CORE_E1RM_PR','CORE_REP_MAX_PR']);pr.resolve({items:[{id:8}],hasMore:true,nextCursor:'pr-next'});await h.render();assert.equal(h.output.events[0].id,8);assert.equal(h.output.cursor,'pr-next');
console.log('PASS: actual connected History hook; athlete self scope, cursor deduplication, repeated taps, obsolete subjects, transient retry, denial clearing, collection search and governed PR paging.');

h.state.filter='imports';h.state.range={from:'2026-01-01',to:'2026-02-01'};await h.render();
const imported=h.calls.at(-1);assert.equal(imported.args[0],'training');assert.equal(imported.args[1].source_type,'historical');assert.equal(imported.args[1].date_from,'2026-01-01');assert.equal(imported.args[1].date_to,'2026-02-01');
h.state.range={from:'2026-03-01',to:'2026-03-31'};await h.render();imported.resolve(page([999]));await h.render();assert.equal(h.output.items.length,0,'Obsolete date ranges cannot repopulate the new window');
h.calls.at(-1).resolve({items:[{archive_item_type:'historical_performance',source_id:9,title:'Original imported lift'}],has_more:false,next_cursor:null});await h.render();assert.equal(h.output.items[0].archive_item_type,'historical_performance');
console.log('PASS: actual History hook; imported/manual collection, server date bounds and obsolete-window rejection.');
