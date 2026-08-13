const COMPETITION_MOVEMENT_DISPLAY: Record<string, string> = {
  'competition squat': 'Squat',
  'competition bench': 'Bench',
  'competition deadlift': 'Deadlift',
  'comp squat': 'Squat',
  'comp bench': 'Bench',
  'comp deadlift': 'Deadlift',
};

export function simplifyMobileMovementName(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  return COMPETITION_MOVEMENT_DISPLAY[raw.toLowerCase()] || raw;
}

export function simplifyMobileMovementText(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  return raw
    .replace(/\bCompetition Squat\b/gi, 'Squat')
    .replace(/\bCompetition Bench\b/gi, 'Bench')
    .replace(/\bCompetition Deadlift\b/gi, 'Deadlift')
    .replace(/\bComp Squat\b/gi, 'Squat')
    .replace(/\bComp Bench\b/gi, 'Bench')
    .replace(/\bComp Deadlift\b/gi, 'Deadlift');
}

export function simplifyMobileMovementList(values?: string[] | null) {
  return (values || []).map((value) => simplifyMobileMovementName(value)).filter(Boolean);
}
