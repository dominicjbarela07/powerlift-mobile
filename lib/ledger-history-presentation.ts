import type { ArchiveItem } from './ledger-archive';
import type { AccomplishmentEvent, LedgerUnit } from './ledger-data';
import { formatCalculatedWeightValue, kilogramsToDisplayValue } from './display-units';
const displayCalculatedWeight=(kg:number,unit:LedgerUnit)=>formatCalculatedWeightValue(kilogramsToDisplayValue(kg,unit),unit)??'—';
import { ledgerDay } from './ledger-visuals';
import { performedWeightValue } from './ledger-records';
export type HistoryDateRange = Readonly<{from?:string;to?:string}>;
export function ledgerPrValue(event:AccomplishmentEvent,unit:LedgerUnit) {
 if(typeof event.current_value!=='number'||!Number.isFinite(event.current_value))return '—';
 if(event.unit!=='kg')return `${event.current_value} ${event.unit||''}`.trim();
 if(event.event_type.includes('E1RM'))return `${displayCalculatedWeight(event.current_value,unit)} ${unit}`;
 const reps=event.evidence?.actual_reps;
 return `${performedWeightValue(event.current_value,unit)} ${unit}${typeof reps==='number'&&Number.isFinite(reps)?` × ${reps}`:''}`;
}
const number=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export function ledgerArchiveFacts(item:ArchiveItem,unit:LedgerUnit) {
 const p=item.performance??{},facts:string[]=[];
 if(number(p.weight_kg))facts.push(`${performedWeightValue(p.weight_kg,unit)} ${unit}${number(p.reps)?` × ${p.reps}`:''}`);
 else if(number(p.reps))facts.push(`${p.reps} reps · load unrecorded`);
 if(number(p.rpe))facts.push(`RPE ${p.rpe}`);else if(number(p.rir))facts.push(`${p.rir} RIR`);
 if(number(p.set_count))facts.push(`${p.set_count} ${p.set_count===1?'set':'sets'}`);else if(number(p.sets))facts.push(`${p.sets} ${p.sets===1?'set':'sets'}`);
 if(number(p.movement_count))facts.push(`${p.movement_count} ${p.movement_count===1?'movement':'movements'}`);
 if(number(p.duration_seconds))facts.push(`${Math.round(p.duration_seconds/60)} min`);
 return facts;
}
export function ledgerSourceFacts(item:ArchiveItem,unit:LedgerUnit) {
 const p=item.performance??{},facts:{label:string;value:string}[]=[];
 for(const [key,label] of [['set_count','Recorded sets'],['sets','Recorded sets'],['movement_count','Movements'],['duration_seconds','Recorded duration']] as const){if(number(p[key])&&!facts.some(f=>f.label===label))facts.push({label,value:key==='duration_seconds'?`${Math.round((p[key] as number)/60)} min`:String(p[key])});}
 for(const key of ['total_volume_kg','volume_kg'])if(number(p[key])){facts.push({label:'Recorded volume',value:`${performedWeightValue(p[key] as number,unit)} ${unit} × reps`});break;}
 if(number(p.estimated_1rm_kg))facts.push({label:'Estimated 1RM · calculated',value:`${displayCalculatedWeight(p.estimated_1rm_kg,unit)} ${unit}`});
 if(number(p.bodyweight_kg))facts.push({label:'Bodyweight recorded with this history',value:`${performedWeightValue(p.bodyweight_kg,unit)} ${unit}`});
 return facts;
}
export function ledgerReflectionFacts(reflection?:Record<string,unknown>|null){
 return (['rpe','strength','fatigue'] as const).flatMap(key=>(number(reflection?.[key])||(typeof reflection?.[key]==='string'&&String(reflection[key]).trim()))?[{label:key==='rpe'?'Session RPE':key[0].toUpperCase()+key.slice(1),value:String(reflection![key])}]:[]);
}
export function historyItemDateWithin(date:string|undefined|null,range:HistoryDateRange){if(!range.from&&!range.to)return true;const d=date?.slice(0,10);return Boolean(d&&ledgerDay(d)!=null&&(!range.from||d>=range.from)&&(!range.to||d<=range.to));}

/** Only explicit pre-Session observations qualify; profile weight is not history. */
export function ledgerReportedBodyweightPoints(context:import('./ledger-exploration').LedgerExplorationContext|undefined|null,unit:LedgerUnit){
 return (context?.reported_bodyweight?.recent_observations??[]).flatMap((p,index)=>{const date=p.training_date||p.reported_at?.slice(0,10);return date&&ledgerDay(date)!=null&&number(p.reported_bodyweight_kg)?[{id:`check-in:${p.workout_id??p.reported_at??date}:${index}`,date,value:kilogramsToDisplayValue(p.reported_bodyweight_kg,unit),kg:p.reported_bodyweight_kg,workoutId:p.workout_id}]:[];}).sort((a,b)=>a.date.localeCompare(b.date));
}
