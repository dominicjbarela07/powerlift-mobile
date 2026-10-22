import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('components/SetVideoPlayerModal.tsx','utf8');
const start = source.indexOf('  const refreshVideoUrl = useCallback(');
const end = source.indexOf('\n  const requestKey',start);
assert.ok(start > 0 && end > start);
const callback = ts.transpileModule(source.slice(start,end)+'\nrefreshVideoUrl;',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const requests = [], states = [];
const shared = { urlGeneration:{current:0}, activeVisibility:{current:true}, activeIdentity:{current:{videoId:1,owner:'7'}},
  restorePlayback:{current:null}, player:{currentTime:8,playing:false,pause(){},replaceAsync:async()=>{}},
  useCallback:fn=>fn, API_BASE:'https://api.test',
  fetchJson:async()=>new Promise(resolve=>requests.push(resolve)),
  setVideoUrl:value=>states.push(['url',value]),setVideo:value=>states.push(['video',value]),
  setUrlError:value=>states.push(['error',value]), setLoadingUrl:value=>states.push(['loading',value]),
};
function handler(id) { return vm.runInNewContext(callback,{...shared,videoId:id,user:{id:7},initialUrl:null,
  initialVideo:null,refreshPath:null,videoUrl:'https://old.test/clip'}); }
const old = handler(1)(true);
assert.equal(shared.restorePlayback.current.time,8);
shared.player.currentTime=0;
shared.activeIdentity.current={videoId:2,owner:'7'};
const current=handler(2)(true);
requests[1]({ok:true,status:200,json:{ok:true,video:{id:2,url:'https://new.test/clip'}}});
await current;
requests[0]({ok:true,status:200,json:{ok:true,video:{id:1,url:'https://stale.test/clip'}}});
await old;
assert.ok(!states.some(([,value])=>value==='https://stale.test/clip'),'late first response cannot replace the current video');
assert.equal(shared.restorePlayback.current.time,8,'repeated recovery does not replace saved position with a reset player time');

states.length=0;
const closed=handler(2)();
shared.activeVisibility.current=false;
requests.at(-1)({ok:true,status:200,json:{ok:true,video:{id:2,url:'https://closed.test/clip'}}});
await closed;
assert.ok(!states.some(([name])=>name==='url'),'closing prevents late response state writes');

shared.activeVisibility.current=true; states.length=0;
const denied=handler(2)(true);
requests.at(-1)({ok:false,status:403,json:{error:'access revoked'}});
await denied;
assert.ok(states.some(([name,value])=>name==='url'&&value===null),'revoked permission cannot fall back to cached playback URL');

const recoveryStart=source.indexOf("    if (!visible || !playbackError || loadingUrl || recoverAttempts.current >= 2) return;");
const recoveryEnd=source.indexOf('\n  }, [loadingUrl',recoveryStart);
const effect=ts.transpileModule('(function(){'+source.slice(recoveryStart,recoveryEnd)+'})()',{}).outputText;
let refreshes=0;const recoverAttempts={current:0};
for(let i=0;i<5;i++)vm.runInNewContext(effect,{visible:true,playbackError:'expired',loadingUrl:false,recoverAttempts,
  refreshVideoUrl:()=>refreshes++,setTimeout:fn=>{fn();return 0},clearTimeout(){}});
assert.equal(refreshes,2,'automatic recovery is bounded; manual retry remains explicit');
console.log('PASS: actual asynchronous URL handler rejects stale/closed responses, preserves playhead through retries, enforces revoked access and bounds automatic recovery.');
