export type PrimaryHistoryObservation = Readonly<{
  exposure_id: string;
  set_log_id?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  e10rm_kg?: number | null;
}>;

export function samePrimaryHistoryObservation(
  left: PrimaryHistoryObservation,
  right: PrimaryHistoryObservation,
) {
  return left.exposure_id === right.exposure_id
    && left.set_log_id === right.set_log_id
    && left.weight_kg === right.weight_kg
    && left.reps === right.reps
    && left.rir === right.rir
    && left.e10rm_kg === right.e10rm_kg;
}
