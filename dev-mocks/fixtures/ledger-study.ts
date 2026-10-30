/** Fictional storyboard evidence. No identifiers here can resolve product APIs. */
export type StudyUnit = 'kg' | 'lb';
export type StudyTab = 'records' | 'history' | 'milestones';
export type StudyFamily = 'core' | 'variants' | 'accessories';
export type StudyScene = 'record' | 'lift' | 'movement' | 'history' | 'session' | 'milestones' | 'milestone' | 'context' | 'empty';
export type StudyMovement = {
  id: string; name: string; shortName: string; family: StudyFamily;
  parent: 'squat' | 'bench' | 'deadlift' | null; kg: number; reps: number;
  previousKg: number | null; date: string; equipment: string;
  assisted?: boolean; baseline?: boolean; sessions: number;
};
export const STUDY_MOVEMENTS: readonly StudyMovement[] = [
  { id: 'example-squat', name: 'Competition Squat', shortName: 'Squat', family: 'core', parent: 'squat', kg: 195, reps: 1, previousKg: 190, date: 'Oct 22', equipment: 'Barbell', sessions: 38 },
  { id: 'example-bench', name: 'Competition Bench Press', shortName: 'Bench press', family: 'core', parent: 'bench', kg: 120, reps: 1, previousKg: 117.5, date: 'Oct 24', equipment: 'Barbell', sessions: 42 },
  { id: 'example-deadlift', name: 'Competition Deadlift', shortName: 'Deadlift', family: 'core', parent: 'deadlift', kg: 225, reps: 1, previousKg: 220, date: 'Oct 19', equipment: 'Barbell', sessions: 34 },
  { id: 'example-pause-squat', name: '2-second Pause Squat', shortName: 'Pause squat', family: 'variants', parent: 'squat', kg: 142.5, reps: 5, previousKg: 140, date: 'Oct 26', equipment: 'Barbell · 2-second pause', sessions: 12 },
  { id: 'example-tempo-squat', name: 'Tempo Squat', shortName: 'Tempo squat', family: 'variants', parent: 'squat', kg: 125, reps: 5, previousKg: 120, date: 'Oct 21', equipment: 'Barbell · 3-second eccentric', sessions: 8 },
  { id: 'example-close-bench', name: 'Close-grip Bench Press', shortName: 'Close-grip bench', family: 'variants', parent: 'bench', kg: 97.5, reps: 5, previousKg: 95, date: 'Oct 25', equipment: 'Barbell · close grip', sessions: 16 },
  { id: 'example-pause-deadlift', name: 'Pause Deadlift', shortName: 'Pause deadlift', family: 'variants', parent: 'deadlift', kg: 175, reps: 3, previousKg: 172.5, date: 'Oct 23', equipment: 'Barbell · below knee', sessions: 9 },
  { id: 'example-assisted-pullup', name: 'Assisted Pull-up', shortName: 'Assisted pull-up', family: 'accessories', parent: null, kg: 32.5, reps: 8, previousKg: 35, date: 'Oct 27', equipment: 'Hammer Strength', assisted: true, sessions: 11 },
  { id: 'example-assisted-lifefitness', name: 'Assisted Pull-up', shortName: 'Assisted pull-up', family: 'accessories', parent: null, kg: 40, reps: 8, previousKg: null, date: 'Oct 13', equipment: 'Life Fitness', assisted: true, baseline: true, sessions: 1 },
  { id: 'example-row', name: 'Chest-supported Row', shortName: 'Chest-supported row', family: 'accessories', parent: null, kg: 60, reps: 10, previousKg: 55, date: 'Oct 27', equipment: 'Prime · neutral grip', sessions: 14 },
  { id: 'example-curl', name: 'Dumbbell Curl', shortName: 'Dumbbell curl', family: 'accessories', parent: null, kg: 15, reps: 12, previousKg: 12.5, date: 'Oct 25', equipment: 'Dumbbell · per hand', sessions: 19 },
];
export const STUDY_SERIES = [
  { date: '2026-08-10', top: 170, five: 150 },
  { date: '2026-08-24', top: 175, five: 152.5 },
  { date: '2026-09-07', top: 177.5, five: 155 },
  { date: '2026-09-18', top: 175, five: 165 },
  { date: '2026-09-22', top: 180, five: 165 },
  { date: '2026-10-02', top: 185, five: 165 },
  { date: '2026-10-12', top: 190, five: 167.5 },
  { date: '2026-10-22', top: 195, five: 167.5 },
  { date: '2026-10-28', top: 190, five: 170 },
] as const;
export const STUDY_HISTORY = [
  { id: 'example-history-1', date: 'Oct 28', day: 'WED', name: 'Lower · Week 4', detail: 'Squat, leg press, hamstring curl', type: 'session', sets: 14, time: '68 min', record: '170 kg × 5 · Squat 5-rep best' },
  { id: 'example-history-2', date: 'Oct 27', day: 'TUE', name: 'Upper · Week 4', detail: 'Bench press, assisted pull-up, row', type: 'session', sets: 16, time: '74 min', record: 'Less assistance · Pull-up 8-rep best' },
  { id: 'example-history-3', date: 'Oct 25', day: 'SUN', name: 'Upper · Week 3', detail: 'Bench press, close-grip bench, curl', type: 'session', sets: 15, time: '65 min', record: null },
  { id: 'example-history-4', date: 'Oct 22', day: 'THU', name: 'Lower · Week 3', detail: 'Squat, pause deadlift, leg curl', type: 'session', sets: 13, time: '71 min', record: '195 kg × 1 · Squat load best' },
  { id: 'example-history-5', date: 'Sep 22', day: 'TUE', name: 'Lower · Week 1', detail: 'Squat, leg press, hamstring curl', type: 'session', sets: 12, time: '62 min', record: '180 kg × 1 · Squat load best' },
] as const;
export const STUDY_TOUR: readonly { key: StudyScene; title: string; task: string; why: string; path: string }[] = [
  { key: 'record', title: 'The record comes first', task: 'Open the Ledger and immediately find your lifts and latest improvement.', why: 'The landing screen is useful on its own. Three clearly named destinations replace a page of chapter doorways.', path: 'Ledger → Records' },
  { key: 'lift', title: 'One lift, one place', task: 'Open Squat. Change the range, inspect the trend and check rep bests.', why: 'Progression, rep records and source context live together. A lift no longer needs its own Overview / Records / Analysis maze.', path: 'Records → Squat' },
  { key: 'movement', title: 'Comparable means exact', task: 'Inspect an assisted pull-up and change the manufacturer context.', why: 'The record says assistance, so less is better. Each brand keeps a separate history; a first machine set stays a quiet baseline.', path: 'Records → Accessories → Assisted pull-up' },
  { key: 'history', title: 'One chronological history', task: 'Find a Session or filter to the performances that set records.', why: 'Journey and Archive become one timeline with block context. Search and filters change the visible evidence, not the destination.', path: 'Ledger → History' },
  { key: 'session', title: 'The proof is close', task: 'Open a Session and inspect the exact set behind a personal best.', why: 'A concise set sheet provides provenance without another permanent navigation layer. Closing it returns to the same context.', path: 'History → Session → Recorded set' },
  { key: 'milestones', title: 'Recognition gets its place', task: 'See earned clubs, strength tiers and volume awards in one collection.', why: 'Celebration is retained, but it no longer competes with everyday strength reading or repeats every record screen.', path: 'Ledger → Milestones' },
  { key: 'milestone', title: 'Recognition with meaning', task: 'Inspect a club, what qualified and the supporting performance.', why: 'A typographic milestone puts the earned threshold and qualifying set first. Existing approved image files are preserved while their future placement is reviewed.', path: 'Milestones → Squat club' },
  { key: 'context', title: 'Context stays contextual', task: 'Inspect bodyweight and training volume without leaving the record.', why: 'Body and muscle context remain available under named entry points. Neither becomes another parallel navigation system.', path: 'Records → Training context' },
  { key: 'empty', title: 'A first week still makes sense', task: 'Switch to the first-week example and start an honest record.', why: 'The same navigation remains visible. Missing history gets a useful explanation rather than fake progress or locked-looking trophies.', path: 'Ledger → First-week example' },
];
export function studyWeight(kg: number, unit: StudyUnit) {
  const n = unit === 'lb' ? kg * 2.2046226218487757 : kg;
  return Number(n.toFixed(1)).toLocaleString('en-US', { maximumFractionDigits: 1 });
}
export function studyImprovement(m: StudyMovement) {
  return m.previousKg == null ? null : m.assisted ? m.previousKg - m.kg : m.kg - m.previousKg;
}
export function studyPoints(range: '6w' | '12w' | 'all') {
  return STUDY_SERIES.filter(p => range !== '6w' || p.date >= '2026-09-18');
}

/** Explicit fictional observations, not scaled copies of another lift. */
export const STUDY_CORE_DETAILS: Record<string, {
  dates: readonly string[]; top: readonly number[]; five: readonly number[];
  repBests: readonly { reps: number; kg: number; date: string; rpe: number }[];
}> = {
  'example-squat': {
    dates: ['2026-08-10','2026-08-24','2026-09-07','2026-09-18','2026-09-22','2026-10-02','2026-10-12','2026-10-22','2026-10-28'],
    top: [170, 175, 177.5, 175, 180, 185, 190, 195, 190],
    five: [150, 152.5, 155, 165, 165, 165, 165, 165, 170],
    repBests: [{ reps: 1, kg: 195, date: '2026-10-22', rpe: 9 }, { reps: 3, kg: 182.5, date: '2026-10-17', rpe: 8.5 }, { reps: 5, kg: 170, date: '2026-10-28', rpe: 8 }, { reps: 8, kg: 145, date: '2026-10-09', rpe: 8 }],
  },
  'example-bench': {
    dates: ['2026-08-11','2026-08-25','2026-09-08','2026-09-19','2026-09-23','2026-10-03','2026-10-13','2026-10-24','2026-10-29'],
    top: [100, 105, 105, 107.5, 110, 112.5, 115, 120, 115],
    five: [85, 87.5, 90, 90, 92.5, 95, 97.5, 100, 102.5],
    repBests: [{ reps: 1, kg: 120, date: '2026-10-24', rpe: 9 }, { reps: 3, kg: 110, date: '2026-10-20', rpe: 8 }, { reps: 5, kg: 102.5, date: '2026-10-28', rpe: 8.5 }, { reps: 8, kg: 90, date: '2026-10-11', rpe: 8 }],
  },
  'example-deadlift': {
    dates: ['2026-08-09','2026-08-23','2026-09-06','2026-09-17','2026-09-21','2026-10-01','2026-10-11','2026-10-19','2026-10-27'],
    top: [195, 200, 200, 205, 207.5, 215, 220, 225, 220],
    five: [170, 172.5, 175, 177.5, 180, 180, 185, 190, 195],
    repBests: [{ reps: 1, kg: 225, date: '2026-10-19', rpe: 9 }, { reps: 3, kg: 210, date: '2026-10-23', rpe: 8.5 }, { reps: 5, kg: 195, date: '2026-10-28', rpe: 8 }, { reps: 8, kg: 172.5, date: '2026-10-15', rpe: 8 }],
  },
};

export type StudySessionMovement = { name: string; equipment: string; assisted?: boolean; sets: readonly { kg: number; reps: number; rpe: number; record?: string }[] };
const sets = (values: readonly number[], reps: number, rpe = 8) => values.map(kg => ({ kg, reps, rpe }));
export const STUDY_SESSION_DETAILS: Record<string, readonly StudySessionMovement[]> = {
  'example-history-1': [
    { name: 'Competition Squat', equipment: 'Barbell', sets: [...sets([60, 100, 140, 160, 165], 5, 7), { kg: 170, reps: 5, rpe: 8, record: '5-rep best' }] },
    { name: 'Leg press', equipment: 'Hammer Strength', sets: sets([120, 140, 160, 180], 12) },
    { name: 'Seated hamstring curl', equipment: 'Life Fitness', sets: sets([30, 35, 40, 40], 12) },
  ],
  'example-history-2': [
    { name: 'Competition Bench Press', equipment: 'Barbell', sets: sets([60, 80, 100, 110, 112.5, 115], 3) },
    { name: 'Assisted Pull-up', equipment: 'Hammer Strength', assisted: true, sets: [...sets([45, 40, 35, 35], 8), { kg: 32.5, reps: 8, rpe: 8, record: 'Less assistance at 8 reps' }] },
    { name: 'Chest-supported Row', equipment: 'Prime · neutral grip', sets: [...sets([40, 50, 55], 10), { kg: 60, reps: 10, rpe: 8, record: '10-rep best' }, { kg: 60, reps: 10, rpe: 8.5 }] },
  ],
  'example-history-3': [
    { name: 'Competition Bench Press', equipment: 'Barbell', sets: sets([60, 70, 80, 90, 100, 100], 5) },
    { name: 'Close-grip Bench Press', equipment: 'Barbell · close grip', sets: sets([60, 70, 80, 90, 95], 5) },
    { name: 'Dumbbell Curl', equipment: 'Dumbbell · per hand', sets: sets([10, 12.5, 12.5, 12.5], 12) },
  ],
  'example-history-4': [
    { name: 'Competition Squat', equipment: 'Barbell', sets: [...sets([60, 100, 150, 190], 1), { kg: 195, reps: 1, rpe: 9, record: 'Load best' }] },
    { name: 'Pause Deadlift', equipment: 'Barbell · below knee', sets: sets([100, 140, 160, 170], 3) },
    { name: 'Seated hamstring curl', equipment: 'Life Fitness', sets: sets([30, 35, 40, 40], 12) },
  ],
  'example-history-5': [
    { name: 'Competition Squat', equipment: 'Barbell', sets: [...sets([60, 100, 150], 1), { kg: 180, reps: 1, rpe: 8, record: 'Load best' }] },
    { name: 'Leg press', equipment: 'Hammer Strength', sets: sets([100, 120, 140, 150], 12) },
    { name: 'Seated hamstring curl', equipment: 'Life Fitness', sets: sets([25, 30, 35, 35], 12) },
  ],
};
