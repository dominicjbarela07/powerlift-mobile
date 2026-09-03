export type SmartWarmupPlate = Readonly<{ denomination: number; count: number }>;

export type SmartWarmupLoading = Readonly<{
  total_kg: number;
  total: number;
  unit: 'kg' | 'lb';
  bar_key: string;
  bar_weight_kg: number;
  collar_key: string;
  collar_weight_kg: number;
  plates_per_side: readonly SmartWarmupPlate[];
  plate_stack_known: boolean;
  loadability: 'verified' | 'unverified_no_plate_catalog';
  equation: Readonly<{ bar_kg: number; collars_kg: number; plates_kg: number | null }>;
}>;

export type SmartWarmupStep = SmartWarmupLoading & Readonly<{
  sequence: number;
  phase: 'prepare' | 'ramp' | 'assess';
  reps: string;
  diagnostic: boolean;
  rest_seconds: number;
}>;

export type SmartWarmupFeedback = 'flies' | 'expected' | 'heavy' | 'very_heavy' | 'fast' | 'slow';

export type SmartWarmupRecommendation = Readonly<{
  recommended_target_kg: number;
  signal: 'strong' | 'expected' | 'conservative' | 'protective';
  loading: SmartWarmupLoading;
  weighted_score?: number;
  confidence?: number;
  explanation?: string;
  evidence?: readonly Readonly<{
    sequence: number;
    response: SmartWarmupFeedback;
    total_kg: number | null;
    intensity: number | null;
    weight: number;
    score: number;
  }>[];
}>;

export type SmartWarmupSession = Readonly<{
  id: number;
  status: 'active' | 'completed' | 'skipped';
  generator_version: string;
  preference: 'minimal' | 'standard' | 'gradual';
  loading_configuration: Readonly<{
    unit: 'kg' | 'lb';
    bar_key: string;
    bar_weight_kg: number;
    collar_key: string;
    collar_weight_kg: number;
    plates: readonly number[];
  }>;
  progression: Readonly<{
    steps: readonly SmartWarmupStep[];
    current_target_kg?: number;
    adaptations?: readonly Readonly<{
      after_sequence: number;
      response: SmartWarmupFeedback;
      previous_future_kg: readonly number[];
      adapted_future_kg: readonly number[];
      recommended_target_kg: number;
      evidence_weight: number;
      reason: string;
    }>[];
    provisional_recommendation?: SmartWarmupRecommendation;
    recommendation?: SmartWarmupRecommendation;
    validation?: Readonly<{
      strictly_ascending: boolean;
      heavy_end_converges: boolean;
      post_rounding_valid: boolean;
      no_filler_steps: boolean;
      rep_decay: boolean;
    }>;
  }>;
  completed_steps: readonly number[];
  last_completed_sequence: number | null;
  diagnostic_feedback: readonly Readonly<{ sequence: number; response: SmartWarmupFeedback; total_kg: number }>[];
  active_step_index: number;
  prescribed_low_kg: number;
  prescribed_high_kg: number;
  initial_target_kg: number;
  recommended_target_kg: number | null;
  selected_target_kg: number | null;
  allowed_working_loads: readonly SmartWarmupLoading[];
  completed_at: string | null;
}>;

export type SmartWarmupEnvelope = Readonly<{
  eligible: boolean;
  blocked_reason?: string | null;
  session: SmartWarmupSession | null;
}>;

const KG_PER_LB = 0.45359237;

function formatPhysicalWeight(weightKg: number, unit: 'kg' | 'lb', precision = 2) {
  const displayed = unit === 'kg' ? weightKg : weightKg / KG_PER_LB;
  return `${Number(displayed.toFixed(precision))} ${unit}`;
}

function naturalConfigurationLabel(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export function formatWarmupPhysicalConfiguration(
  config: SmartWarmupSession['loading_configuration'],
  displayUnit: 'kg' | 'lb' = config.unit,
) {
  const bar = `${formatPhysicalWeight(config.bar_weight_kg, displayUnit)} Bar`;
  const collars = config.collar_key === 'none'
    ? 'No Collars'
    : config.collar_key === 'competition'
      ? 'Competition Collars (5 kg)'
      : config.collar_key === 'light'
        ? `Collars (${formatPhysicalWeight(config.collar_weight_kg, displayUnit)} pair)`
        : `${naturalConfigurationLabel(config.collar_key)} Collars (${formatPhysicalWeight(config.collar_weight_kg, displayUnit)} pair)`;
  return `${bar} · ${collars}`;
}

export function formatWarmupCollarWeight(
  collarKey: string,
  collarWeightKg: number,
  unit: 'kg' | 'lb',
) {
  const total = formatPhysicalWeight(collarWeightKg, unit);
  const each = formatPhysicalWeight(collarWeightKg / 2, unit);
  if (collarKey === 'competition' && unit === 'lb') {
    return `${total} total · ${each} each · 5 kg pair`;
  }
  return `${total} total · ${each} each`;
}

export function warmupStyleDescription(preference: SmartWarmupSession['preference']) {
  if (preference === 'minimal') return 'Fewer warmup sets · larger jumps.';
  if (preference === 'gradual') return 'More warmup sets · smaller jumps.';
  return 'Balanced progression with familiar gym jumps.';
}
