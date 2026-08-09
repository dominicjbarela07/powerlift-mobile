type AccessoryPrescriptionSource = {
  reps?: number | string | null;
  reps_text?: string | null;
  rir_target?: number | string | null;
};

function compactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function accessoryPerSetPrescription(item: AccessoryPrescriptionSource) {
  const repsText = String(item.reps_text || '').trim();
  const numericReps = Number(item.reps);
  const reps = repsText || (
    Number.isFinite(numericReps) && numericReps > 0
      ? compactNumber(numericReps)
      : '—'
  );
  const numericRir = Number(item.rir_target);
  if (item.rir_target == null || !Number.isFinite(numericRir)) return reps;
  return `${reps} @${compactNumber(numericRir)} RIR`;
}

export function accessoryPerSetRepsLabel(item: AccessoryPrescriptionSource) {
  const prescription = accessoryPerSetPrescription({
    reps: item.reps,
    reps_text: item.reps_text,
    rir_target: null,
  });
  return prescription === '—' ? null : `${prescription} reps`;
}
