import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as taxonomy from '../lib/major-volume-milestones.ts';
import { volumeMilestonesForContext, formatCompactVolumeLb, deriveVolumeAchievement, deriveVolumeComparisonPresentation } from '../lib/volume-achievements.ts';
import { recognitionPresentation, selectCelebrationEvents } from '../lib/logger-feedback.ts';
import { canonicalMajorVolumeMedallions, nextMajorVolumeThreshold } from '../lib/ledger-rewards.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const families = ['total','squat','bench','deadlift'];
const atlasScope = { exports: {}, require: path => path };
vm.runInNewContext(ts.transpileModule(read('lib/major-volume-medallion-kg-atlases.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, atlasScope);
const registryScope = { exports: {}, require: path => path === '@/lib/major-volume-milestones' ? taxonomy
  : path === './major-volume-medallion-kg-atlases' ? atlasScope.exports : path };
vm.runInNewContext(ts.transpileModule(read('lib/major-volume-medallion-assets.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, registryScope);
const { majorVolumeMedallionAsset } = registryScope.exports;
let assets=0;
for (const family of families) {
  const thresholds=taxonomy.majorVolumeThresholdsForFamily(family);
  assert.deepEqual(thresholds,volumeMilestonesForContext(family).map(m=>m.thresholdLb));
  assert.equal(thresholds.length,family==='total'?16:7);
  thresholds.forEach((threshold,index)=>{
    const event={id:index+1,event_type:family==='total'?'TOTAL_LIFETIME_VOLUME_MILESTONE':'CORE_LIFETIME_VOLUME_MILESTONE',
      occurred_at:'2025-01-01T12:00:00Z',source_set_log_id:5,
      evidence:{threshold_lb:threshold,lift_family:family==='total'?null:family}};
    const earned=canonicalMajorVolumeMedallions([event]);
    assert.equal(earned.length,1); assert.equal(earned[0].thresholdLb,threshold);
    const lb=majorVolumeMedallionAsset(family,threshold,'lb');
    const kg=majorVolumeMedallionAsset(family,threshold,'kg');
    assert.notEqual(lb,kg,'KG must select engraved KG art, never an LB asset');
    for (const asset of [lb,kg]) assert.ok(existsSync(new URL(`../${asset.source.slice(2)}`,import.meta.url)),asset.source);
    for (const tile of [lb,kg]) {
      assert.ok(tile.column >= 0 && tile.column < tile.columns);
      assert.ok(tile.row >= 0 && tile.row < tile.rows);
    }
    assert.match(kg.source,/\/kg-atlases\//);
    assert.deepEqual(majorVolumeMedallionAsset(family,threshold),lb,'old calls retain LB default');
    assert.equal(nextMajorVolumeThreshold(threshold,family),thresholds[index+1]??null);
    const rail=taxonomy.majorVolumeMedallionRail(threshold,family);
    assert.ok(rail.includes(threshold)); assert.equal(rail.length,7);
    assert.ok(rail.every(value=>thresholds.includes(value)));
    assets+=2;
  });
}
assert.equal(assets,74);
assert.throws(()=>majorVolumeMedallionAsset('squat',25_000_000,'kg'));
assert.throws(()=>majorVolumeMedallionAsset('total',45_000,'kg'),'converted label must never become event identity');
assert.equal(canonicalMajorVolumeMedallions([{id:1,event_type:'CORE_LIFETIME_VOLUME_MILESTONE',occurred_at:'2025-01-01',evidence:{threshold_lb:25_000_000,lift_family:'bench'}}]).length,0);
// The same evidence earns different round markers, never converted award labels.
for (const family of families) {
  const lbMarkers=taxonomy.majorVolumeThresholdsForFamily(family);
  const kgMarkers=volumeMilestonesForContext(family,'kg');
  assert.deepEqual(kgMarkers.map(m=>m.thresholdValue),lbMarkers);
  for(const marker of kgMarkers) {
    assert.equal(formatCompactVolumeLb(marker.thresholdLb,'kg'),marker.compactLabel);
    assert.equal(deriveVolumeAchievement(marker.thresholdLb-0.001,family,'kg').next?.thresholdValue,marker.thresholdValue);
    assert.equal(deriveVolumeAchievement(marker.thresholdLb,family,'kg').achieved?.thresholdValue,marker.thresholdValue);
    const presentation=deriveVolumeComparisonPresentation(marker,family,marker.thresholdLb);
    assert.equal(presentation.isUnlocked,true);
    assert.ok(presentation.comparison.approximateWeightLb<=marker.thresholdLb,'physical comparisons must fit the real KG milestone');
  }
}
assert.equal(deriveVolumeAchievement(5_000_000,'total','lb').achieved.thresholdLb,5_000_000);
assert.equal(deriveVolumeAchievement(5_000_000,'total','kg').achieved.thresholdValue,2_000_000);
assert.equal(deriveVolumeAchievement(5_000_000,'total','kg').next.thresholdValue,5_000_000);
const base={event_type:'TOTAL_LIFETIME_VOLUME_MILESTONE',occurred_at:'2025-01-01',newly_generated:true,
  current_value:2_000_000,prior_value:1_990_000,source_set_log_id:17,trigger_set_log_id:17,
  core_movement_key:'total_lifetime_volume',priority:36,valid:true};
const both=[{...base,id:51,evidence:{milestone_unit:'lb',threshold_value:5_000_000,threshold_lb:5_000_000,next_threshold_value:10_000_000}},
  {...base,id:52,evidence:{milestone_unit:'kg',threshold_value:2_000_000,threshold_kg:2_000_000,next_threshold_value:5_000_000}}];
const original=JSON.stringify(both);
for(const unit of ['lb','kg','lb']) {
  const owned=canonicalMajorVolumeMedallions(both,unit);
  assert.equal(owned.length,1);assert.equal(owned[0].milestoneUnit,unit);
  const celebrations=selectCelebrationEvents(both,unit);
  assert.equal(celebrations.length,1);assert.equal(celebrations[0].id,unit==='lb'?51:52);
  const shown=recognitionPresentation(celebrations[0],unit);
  assert.equal(shown.value,unit==='lb'?'5M LB':'2M KG');
  assert.equal(shown.progression,unit==='lb'?'Next 10,000,000 LB':'Next 5,000,000 KG');
  assert.equal(recognitionPresentation(both.find(e=>e.id!==celebrations[0].id),unit),null);
  assert.equal(JSON.stringify(both),original,'switching units cannot create or mutate earned evidence');
}
assert.equal(canonicalMajorVolumeMedallions([both[0]],'kg').length,0,'LB evidence is never a KG award');

const source=read('lib/ledger-data.ts');
const fn=source.slice(source.indexOf('export async function fetchLedgerAccomplishmentHistory('),source.indexOf('export async function fetchLedgerCurrentBests('));
const calls=[];
const historyScope={exports:{},fetchLedgerAccomplishmentPage:async(...args)=>{
  calls.push(args);
  assert.deepEqual(args[4],['CORE_LIFETIME_VOLUME_MILESTONE','TOTAL_LIFETIME_VOLUME_MILESTONE']);
  return args[1] ? {items:[{id:2}],hasMore:false,nextCursor:null}
    : {items:[{id:1}],hasMore:true,nextCursor:'historical-award-page'};
}};
vm.runInNewContext(ts.transpileModule(fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,historyScope);
const history=await historyScope.exports.fetchLedgerAccomplishmentHistory(20,91,['CORE_LIFETIME_VOLUME_MILESTONE','TOTAL_LIFETIME_VOLUME_MILESTONE']);
assert.equal(history.length,2);assert.equal(calls.length,2);assert.equal(calls[0][2],91);
const achievements=read('components/ledger/AchievementsExperience.tsx');
assert.match(achievements,/majorVolumeMedallionAsset\(item\.family, item\.thresholdLb, unit\)/);
assert.match(achievements,/section === 'medallions' \? \['CORE_LIFETIME_VOLUME_MILESTONE', 'TOTAL_LIFETIME_VOLUME_MILESTONE'\]/);
const ceremony=read('components/workout-logger/major-volume-milestone-recognition.tsx');
assert.match(ceremony,/majorVolumeMedallionAsset\(family, thresholdLb, unit\)/);
assert.match(ceremony,/majorVolumeMedallionRail\(presentation\.thresholdLb, presentation\.liftFamily/);
assert.match(read('lib/api.ts'),/'X-Strength-Ledger-Volume-Landmarks': '2'/);
console.log('PASS: 74 independent unit awards/assets, round KG markers, silent ownership and preferred-unit recognition, historical medallion pagination and client capability.');
