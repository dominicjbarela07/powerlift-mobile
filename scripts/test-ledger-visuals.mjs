import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ledgerBarFraction, ledgerCalendar, ledgerCompetitionVolume, ledgerDay, ledgerPreviewGeometry, ledgerSessionTotal, ledgerTrainingWeeks } from '../lib/ledger-visuals.ts';

assert.equal(ledgerDay('2026-02-30'),null,'Impossible dates cannot enter a chart');
assert.equal(ledgerDay('2024-02-29'),Date.parse('2024-02-29T12:00:00Z'));
assert.equal(ledgerPreviewGeometry([]),null,'Sparse records never get synthetic trend points');
const flat=ledgerPreviewGeometry([{date:'2026-10-02',value_kg:0}]);
assert.equal(flat.count,1);assert.equal(flat.dots[0].y,32.5,'Zero load is real evidence, not an empty chart');
const timed=ledgerPreviewGeometry([{date:'2026-10-11',value_kg:120},{date:'2026-10-01',value_kg:100},{date:'2026-10-02',value_kg:110},{date:'invalid',value_kg:999}]);
assert.equal(timed.count,3);assert.equal(timed.first,'2026-10-01');
assert.ok(Math.abs((timed.dots[1].x-timed.dots[0].x)/(timed.dots[2].x-timed.dots[0].x)-.1)<.001,'Sparklines retain chronological gaps');
assert.equal(ledgerBarFraction(100,125),.8);assert.equal(ledgerBarFraction(117.5,125),.94);assert.equal(ledgerBarFraction(null,125),0);assert.equal(ledgerBarFraction(150,125),1);
const session=(id,date,status='completed')=>({source_id:id,archive_item_type:'session',occurred_on:date,status});
const calendar=ledgerCalendar([session(1,'2026-10-12'),session(2,'2026-10-12'),session(3,'2026-10-18'),session(4,'2026-10-30','draft'),session(5,'2026-10-30','archived')]);
assert.equal(calendar.at(-1)[0].date,'2026-10-12');assert.equal(calendar.at(-1)[0].count,2);assert.equal(calendar.at(-1)[6].count,1);
assert.equal(ledgerCalendar([session(1,'2026-10-12','canceled')]),null,'A date never turns canceled work into a completed Session');
const weeks=ledgerTrainingWeeks({consistency:{weeks:[{week_start:'2026-10-12',completed:0},{week_start:'bad',completed:999},{week_start:'2026-10-05',completed:3},{week_start:'2026-10-19',completed:null}]}});
assert.deepEqual(weeks.map(w=>w.completed),[3,0],'Preserve recorded zero, exclude unknown completion counts');

assert.equal(timed.lastValue,120,'End labels must use the final dated observation, not the career maximum');
const decline=ledgerPreviewGeometry([{date:'2026-10-01',value_kg:150},{date:'2026-10-02',value_kg:100}]);
assert.equal(decline.lastValue,100);
const volume=ledgerCompetitionVolume({big_three_arc:{lifts:[
 {key:'Squat',strength_lenses:{training_volume:{points:[{date:'2026-10-05',value_kg:1000},{date:'2026-10-07',value_kg:500},{date:'bad',value_kg:9999}]}}},
 {key:'Bench press',strength_lenses:{training_volume:{points:[{date:'2026-10-06',value_kg:750},{date:'2026-10-12',value_kg:0}]}}},
 {key:'Deadlift',strength_lenses:{training_volume:{points:[{date:'2026-10-11',value_kg:900},{date:'2026-10-12',value_kg:-1}]}}},
 {key:'paused_squat',strength_lenses:{training_volume:{points:[{date:'2026-10-06',value_kg:9999}]}}},
]}});
assert.deepEqual(volume,[{date:'2026-10-05',squat:1500,bench:750,deadlift:900,total:3150},{date:'2026-10-12',squat:0,bench:0,deadlift:0,total:0}],'Stack exact Competition volume, retaining real zero and rejecting variants/invalid dates/negative volume');
assert.deepEqual(ledgerCompetitionVolume(null),[],'Unknown volume never produces decorative bars');
const {ledgerCanvasActive}=await import('../lib/ledger-surface-policy.ts');
for(const route of ['/ledger','/ledger/home','/(tabs)/ledger/strength','/ledger/muscle-groups'])assert.equal(ledgerCanvasActive(route),true);
for(const route of ['/today','/login','/ledger-study','/movement-history-sheet','/coach/ledger','/(tabs)/calendar'])assert.equal(ledgerCanvasActive(route),false,'Other surfaces retain their canonical canvas');

const source=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const product=source('components/ledger/LedgerExperience.tsx'),visuals=source('components/ledger/LedgerVisuals.tsx');
assert.match(product,/<LedgerRecordCard[\s\S]*points=\{p\.lenses\?\.weight_on_bar\.points/,'Landing charts must use performed load, not estimates');
assert.match(visuals,/isGovernedMuscleId\(g\.key\)/,'Broad body regions cannot become specific muscle evidence');
assert.match(visuals,/ProgrammingMuscleRegionArt/);assert.doesNotMatch(visuals,/anatomy-v2\/masters|anatomy-mask-registry|<MuscleMap/);
assert.doesNotMatch(product+visuals,/ledgerConcept|generated_images|STUDY_|sampleData|dummyData/,'Product visuals cannot substitute concept pixels or fictional records');
const palette=source('constants/theme.ts').split('export const SLLedgerMaterial = {')[1].split('} as const')[0];
const color=key=>new RegExp(`${key}: '(#[0-9A-Fa-f]{6})'`).exec(palette)?.[1];
const luminance=hex=>{const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
for(const foreground of ['text','secondary','muted','accent'])for(const background of ['face','top','bottom']){const a=luminance(color(foreground)),b=luminance(color(background));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${foreground} / ${background} must retain readable contrast`);}
for(const foreground of ['text','secondary','muted'])for(const background of ['squatFace','benchFace','deadliftFace','goldFace','selectionFace']){const a=luminance(color(foreground)),b=luminance(color(background));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${foreground} / ${background} stays readable on colored material`);}
function assertMaterialDepth(read){
 const levels=['canvas','bottom','face','top'].map(key=>luminance(read(key)));
 assert.ok(levels.every((level,i)=>i===0||level>levels[i-1]),'Canvas, lower face and illuminated face must remain distinct levels');
 const selected=read('controlTop').slice(1).match(/../g).map(c=>parseInt(c,16));
 assert.ok(selected[2]>selected[0]&&selected[0]>selected[1],'Selected control keeps the owner-directed violet role');
 const ratio=(luminance(read('text'))+.05)/(luminance(read('controlTop'))+.05);assert.ok(ratio>=4.5,'Selected controls retain readable labels');
}
assertMaterialDepth(color);
assert.throws(()=>assertMaterialDepth(key=>['canvas','bottom','face','top'].includes(key)?color('face'):color(key)),'Deliberately flattening all material levels must fail');
assert.throws(()=>assertMaterialDepth(key=>key==='controlTop'?'#353535':color(key)),'Restoring a gray selected control must fail');
console.log('PASS: actual visual helpers; chronological scales, missing/zero data, exact rep bars, completed-only calendar, quantitative rhythm, governed anatomy, real product evidence and text contrast.');

const background=source('components/ui/sl-workspace.tsx'),layout=source('app/(tabs)/ledger/_layout.tsx'),chart=source('components/charts/AnalyticalTimeSeriesChart.tsx');
const canvasGuard=(background,layout)=>{
 assert.match(background,/ledgerCanvasActive\(usePathname\(\)\)/);
 assert.match(background,/ledger && \{ backgroundColor: SLLedgerMaterial\.canvas \}/,'The actual canvas owner must apply the material, not an unused route token');
 assert.match(layout,/contentStyle: \{ backgroundColor: 'transparent' \}/,'Nested navigation must not cover the canvas');
};
canvasGuard(background,layout);
assert.throws(()=>canvasGuard(background.replace('ledger && { backgroundColor: SLLedgerMaterial.canvas }','null'),layout),'Deliberately subtracting the actual background must fail');
assert.throws(()=>canvasGuard(background,layout.replace("backgroundColor: 'transparent'","backgroundColor: 'black'")),'Deliberately covering the background must fail');
assert.match(visuals,/ledgerCompetitionVolume\(progression\)/);assert.match(product,/<LedgerTrainingRhythm unit=\{unit\}/,'Volume display follows the active surface unit');
assert.match(product,/event_type==='CORE_WEIGHT_PR'&&e.unit==='kg'/,'The medallion never relabels an estimated PR as a performed load');
assert.match(visuals,/resolvePlateStackRender\(\{weight:value,unit\}\)/,'Plate imagery must resolve the actual unit-aware threshold');
assert.doesNotMatch(visuals,/filter:|tintColor:/,'Native brightness compositing whitened alpha in the first visual pass; plate details must use readable source pixels');
assert.match(visuals,/LedgerEarnedMedallion/);assert.match(visuals,/g\.lastValue/);assert.match(chart,/fillArea = false/,'Area presentation is opt-in for other analytical consumers');
assert.match(product,/<AnalyticalTimeSeriesChart fillArea surfaceColor=/);
console.log('PASS: actual Ledger canvas owner and deliberate subtraction/opaque-navigation failures; exact performed-volume stacks, active units, performed-only medallion, and native-safe plate alpha.');

assert.match(product,/<Modal backdropColor=\{T.material.canvas\}/,'The native source sheet must use the same charcoal material');

assert.equal(ledgerSessionTotal({consistency:{sessions_completed:0,weeks:[{completed:99}]}}),0);assert.equal(ledgerSessionTotal({consistency:{sessions_completed:36,weeks:[{completed:3}]}}),36,'A shortened preview cannot redefine the server-reported range total');assert.equal(ledgerSessionTotal({consistency:{weeks:[{completed:3}]}}),null,'Missing range totals stay missing');
