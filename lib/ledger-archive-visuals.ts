import type { ArchiveItem } from './ledger-archive';
import type { AccomplishmentEvent, LedgerUnit } from './ledger-data';
import { ledgerDay } from './ledger-visuals';
import { kilogramsToDisplayValue } from './display-units';
export const finiteArchiveNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export const archiveDay=(item:ArchiveItem)=>item.occurred_on?.slice(0,10)??item.occurred_at?.slice(0,10)??'';
export const archiveItemKey=(item:ArchiveItem)=>`${item.archive_item_type}:${item.source_id}`;
export function archiveMonthBounds(month:string){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid archive month');
  const [year,m]=month.split('-').map(Number),last=new Date(Date.UTC(year,m,0)).getUTCDate();
  return {from:`${month}-01`,to:`${month}-${last}`};
}
export function shiftArchiveMonth(month:string,offset:number){
  archiveMonthBounds(month);const [year,m]=month.split('-').map(Number),d=new Date(Date.UTC(year,m-1+offset,1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
export function archiveMonthLabel(month:string){archiveMonthBounds(month);return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});}
export function latestArchiveMonth(items:readonly ArchiveItem[]){return items.map(archiveDay).filter(d=>ledgerDay(d)!=null).sort().at(-1)?.slice(0,7)??null;}
export function archiveMonthCells(month:string,items:readonly ArchiveItem[]){
  const {from,to}=archiveMonthBounds(month),first=(new Date(`${from}T12:00:00Z`).getUTCDay()+6)%7,last=Number(to.slice(-2));
  const byDay=new Map<string,ArchiveItem[]>();
  for(const item of items){const d=archiveDay(item);if(d.slice(0,7)!==month||ledgerDay(d)==null)continue;byDay.set(d,[...(byDay.get(d)??[]),item]);}
  return Array.from({length:Math.ceil((first+last)/7)*7},(_,i)=>{const day=i-first+1,date=day>0&&day<=last?`${month}-${String(day).padStart(2,'0')}`:null;return {date,day:date?day:null,items:date?byDay.get(date)??[]:[]};});
}
/** Initial recent pages can prove a month complete once they cross its start. */
export function archiveMonthComplete(month:string,items:readonly ArchiveItem[],hasMore:boolean){return !hasMore||items.some(i=>archiveDay(i)&&archiveDay(i)<`${month}-01`);}
export function archiveMonthItems(month:string,items:readonly ArchiveItem[]){return items.filter(i=>archiveDay(i).startsWith(month)&&ledgerDay(archiveDay(i))!=null);}
export function archiveSetTotal(items:readonly ArchiveItem[]):number|null{
  if(items.some(i=>!finiteArchiveNumber(i.performance?.set_count)))return null;
  return items.reduce((sum,i)=>sum+Number(i.performance!.set_count),0);
}
export function archiveYearGroups(items:readonly ArchiveItem[]){
  const groups=new Map<string,ArchiveItem[]>();for(const item of items){const d=archiveDay(item),year=ledgerDay(d)!=null?d.slice(0,4):'Undated';groups.set(year,[...(groups.get(year)??[]),item]);}
  return [...groups].sort((a,b)=>b[0].localeCompare(a[0])).map(([year,records])=>({year,records}));
}
export function archiveBestGroups(events:readonly AccomplishmentEvent[]){
  const groups=new Map<string,AccomplishmentEvent[]>();
  for(const e of events){const key=e.core_movement_key||`unresolved:${e.id}`;groups.set(key,[...(groups.get(key)??[]),e]);}
  return [...groups].map(([key,records])=>({key,label:records[0].movement_label||'Recorded movement',records}));
}
/** A load progression can contain only performed load PRs for one exact key.
 * Estimates and rep-task records stay available as separate evidence cards. */
export function archiveLoadRecordPoints(events:readonly AccomplishmentEvent[],key:string,unit:LedgerUnit){
  return events.filter(e=>e.core_movement_key===key&&e.event_type==='CORE_WEIGHT_PR'&&e.unit==='kg'&&finiteArchiveNumber(e.current_value)&&e.current_value>=0&&ledgerDay((e.workout_date||e.occurred_at||'').slice(0,10))!=null)
    .map(e=>({id:`pr:${e.id}`,date:(e.workout_date||e.occurred_at)!.slice(0,10),value:kilogramsToDisplayValue(e.current_value!,unit),event:e}))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.event.id-b.event.id);
}
export const MEET_LIFTS=[{key:'SQ',label:'Squat',tone:'squat'},{key:'BN',label:'Bench',tone:'bench'},{key:'DL',label:'Deadlift',tone:'deadlift'}] as const;
export function archiveMeetAttempts(item:ArchiveItem){
  const attempts=Array.isArray(item.meet_context?.attempts)?item.meet_context.attempts as Record<string,unknown>[]:[];
  return MEET_LIFTS.map(l=>({...l,attempts:[1,2,3].map(n=>{
    const a=attempts.find(a=>a.lift===l.key&&a.attempt_number===n),result=String(a?.result??'').toLowerCase();
    return {number:n,kg:finiteArchiveNumber(a?.weight_kg)?a!.weight_kg:null,state:['made','good'].includes(result)?'made':['missed','miss'].includes(result)?'missed':'unrecorded'};
  })}));
}
