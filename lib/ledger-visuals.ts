import type { ArchiveItem } from './ledger-archive';
import type { LedgerProgression, StrengthProgressionPoint } from './ledger-data';
import { recordProfile, RECORD_LIFTS } from './ledger-records';

const DAY = 86_400_000;
export function ledgerDay(value?: string | null) {
  const ymd = value?.slice(0, 10);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const time = Date.parse(`${ymd}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === ymd ? time : null;
}
export function ledgerPreviewGeometry(points: readonly Pick<StrengthProgressionPoint, 'date'|'value_kg'>[], width = 140, height = 65) {
  const real = points.filter(p => ledgerDay(p.date) != null && Number.isFinite(p.value_kg)).slice().sort((a,b) => ledgerDay(a.date)!-ledgerDay(b.date)!);
  if (!real.length) return null;
  const times = real.map(p => ledgerDay(p.date)!);
  const low = Math.min(...real.map(p => p.value_kg)), high = Math.max(...real.map(p => p.value_kg));
  const dots = real.map((p,i) => ({x: times.at(-1) === times[0] ? width/2 : 4+(times[i]-times[0])/(times.at(-1)!-times[0])*(width-8), y:high===low?height/2:5+(high-p.value_kg)/(high-low)*(height-12)}));
  return { dots, path:dots.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '), low, high, first:real[0].date, last:real.at(-1)!.date, count:real.length, lastValue:real.at(-1)!.value_kg };
}
export function ledgerTrainingWeeks(progression: LedgerProgression | null) {
  return (progression?.consistency?.weeks ?? []).filter(w => ledgerDay(w.week_start) != null && typeof w.completed === 'number' && Number.isFinite(w.completed) && w.completed >= 0)
    .slice().sort((a,b)=>ledgerDay(a.week_start)!-ledgerDay(b.week_start)!).slice(-12);
}
/** An archive preview describes loaded Sessions, never an exhaustive calendar. */
export function ledgerCalendar(items: readonly ArchiveItem[]) {
  const sessions = items.filter(i=>i.archive_item_type==='session' && ledgerDay(i.occurred_on)!=null && i.status==='completed' && !i.unavailable);
  if (!sessions.length) return null;
  const latest = Math.max(...sessions.map(i=>ledgerDay(i.occurred_on)!));
  const day = new Date(latest).getUTCDay(), monday = latest-((day+6)%7)*DAY;
  const start = monday-3*7*DAY;
  const counts = new Map<string,number>();
  sessions.forEach(i=>counts.set(i.occurred_on!.slice(0,10),(counts.get(i.occurred_on!.slice(0,10))??0)+1));
  return Array.from({length:4},(_,week)=>Array.from({length:7},(_,d)=>{const ymd=new Date(start+(week*7+d)*DAY).toISOString().slice(0,10);return {date:ymd,count:counts.get(ymd)??0};}));
}
export function ledgerBarFraction(value: number | null | undefined, maximum: number) {
  return value != null && Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0 ? Math.min(1,Math.max(0,value/maximum)) : 0;
}

/** Stack only actual, exact Competition-lift volume. Do not label it total
 * training volume or infer performed set counts from aggregate tonnage. */
export function ledgerCompetitionVolume(progression: LedgerProgression | null) {
  const weeks=new Map<string,{date:string;squat:number;bench:number;deadlift:number;total:number}>();
  for(const lift of RECORD_LIFTS){
    const points=recordProfile(lift.key,progression,[]).lenses?.training_volume.points??[];
    for(const point of points){
      const stamp=ledgerDay(point.date);
      if(stamp==null||!Number.isFinite(point.value_kg)||point.value_kg<0)continue;
      const monday=stamp-((new Date(stamp).getUTCDay()+6)%7)*DAY;
      const date=new Date(monday).toISOString().slice(0,10);
      const row=weeks.get(date)??{date,squat:0,bench:0,deadlift:0,total:0};
      row[lift.key]+=point.value_kg;row.total+=point.value_kg;weeks.set(date,row);
    }
  }
  return [...weeks.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
}

export function ledgerSessionTotal(progression:LedgerProgression|null){const count=progression?.consistency?.sessions_completed;return typeof count==='number'&&Number.isFinite(count)&&count>=0?count:null;}
