import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ledgerBarFraction, ledgerCalendar, ledgerDay, ledgerPreviewGeometry, ledgerTrainingWeeks } from '../lib/ledger-visuals.ts';

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
console.log('PASS: actual visual helpers; chronological scales, missing/zero data, exact rep bars, completed-only calendar, quantitative rhythm, governed anatomy, real product evidence and text contrast.');
