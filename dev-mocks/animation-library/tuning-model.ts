import { CANONICAL_RECORD_RECOGNITION_MOTION } from '../../lib/recognition-motion-registry';

export type MotionSpring = {
  stiffness: number;
  damping: number;
  mass: number;
};

export type MotionTuning = {
  entranceMs: number;
  stateMs: number;
  spatialMs: number;
  staggerMs: number;
  phaseDelayMs: number;
  spring: MotionSpring;
  /** Preview-only spatial travel. Production components may ignore it. */
  distancePx: number;
  /** Preview-only arrival overshoot. Production components may ignore it. */
  overshootPx: number;
  /** Preview-only entrance emphasis. Production components may ignore it. */
  emphasisScale: number;
};

export const LOCKED_ANIMATION_LIBRARY_MOTION: MotionTuning = CANONICAL_RECORD_RECOGNITION_MOTION;

export type DesignerControl = 'feel' | 'speed' | 'bounce' | 'overshoot' | 'distance' | 'stagger' | 'energy' | 'emphasis';
export type DesignerChoice = {
  id: string;
  label: string;
  description: string;
};

export const DESIGNER_CONTROLS: Record<DesignerControl, {
  label: string;
  description: string;
  choices: readonly DesignerChoice[];
}> = {
  feel: {
    label: 'Overall feel',
    description: 'The combined weight and responsiveness of the motion.',
    choices: [
      { id: 'snappy', label: 'Snappy', description: 'Very quick response with a firm stop.' },
      { id: 'responsive', label: 'Responsive', description: 'Fast and connected without feeling abrupt.' },
      { id: 'natural', label: 'Natural', description: 'Balanced motion using the production character.' },
      { id: 'soft', label: 'Soft', description: 'Calmer arrival with a cushioned stop.' },
      { id: 'heavy', label: 'Heavy', description: 'More mass and a deliberate settle.' },
      { id: 'bouncy', label: 'Bouncy', description: 'Lively spring with a visible rebound.' },
      { id: 'deliberate', label: 'Deliberate', description: 'Measured movement with strong control.' },
    ],
  },
  speed: {
    label: 'Speed',
    description: 'How quickly the animation communicates that the interface changed.',
    choices: [
      { id: 'instant', label: 'Instant', description: 'No transitional delay.' },
      { id: 'fast', label: 'Fast', description: 'Quick feedback for frequent actions.' },
      { id: 'normal', label: 'Normal', description: 'Production-paced and easy to follow.' },
      { id: 'slow', label: 'Slow', description: 'More time to read the transition.' },
      { id: 'dramatic', label: 'Dramatic', description: 'Long, intentional presentation.' },
    ],
  },
  bounce: {
    label: 'Bounce',
    description: 'How much the spring rebounds before it settles.',
    choices: [
      { id: 'none', label: 'None', description: 'Firm stop with no visible rebound.' },
      { id: 'slight', label: 'Slight', description: 'A restrained hint of elasticity.' },
      { id: 'moderate', label: 'Moderate', description: 'A clearly lively spring.' },
      { id: 'high', label: 'High', description: 'Playful, obvious rebound.' },
    ],
  },
  overshoot: {
    label: 'Overshoot',
    description: 'How far an entering surface travels past its resting point.',
    choices: [
      { id: 'none', label: 'None', description: 'Arrives directly at rest.' },
      { id: 'small', label: 'Small', description: 'Subtle 3 px pass beyond rest.' },
      { id: 'medium', label: 'Medium', description: 'Visible 7 px pass beyond rest.' },
      { id: 'large', label: 'Large', description: 'Expressive 12 px pass beyond rest.' },
    ],
  },
  distance: {
    label: 'Distance',
    description: 'How far spatial entrances travel before reaching rest.',
    choices: [
      { id: 'tiny', label: 'Tiny', description: '4 px: nearly a fade.' },
      { id: 'small', label: 'Small', description: '8 px: restrained movement.' },
      { id: 'medium', label: 'Medium', description: '12 px: production-like travel.' },
      { id: 'large', label: 'Large', description: '18 px: clearly spatial movement.' },
    ],
  },
  stagger: {
    label: 'Stagger',
    description: 'How tightly a group of elements follows one another.',
    choices: [
      { id: 'together', label: 'Together', description: 'Every item begins at once.' },
      { id: 'tight', label: 'Tight', description: 'A quick 28 ms sequence.' },
      { id: 'relaxed', label: 'Relaxed', description: 'A readable 55 ms sequence.' },
      { id: 'cascading', label: 'Cascading', description: 'A pronounced 90 ms sequence.' },
    ],
  },
  energy: {
    label: 'Energy',
    description: 'The force of the response: spring strength plus arrival pace.',
    choices: [
      { id: 'calm', label: 'Calm', description: 'Low-force, unhurried response.' },
      { id: 'balanced', label: 'Balanced', description: 'Production-level force.' },
      { id: 'energetic', label: 'Energetic', description: 'Faster, stronger response.' },
      { id: 'explosive', label: 'Explosive', description: 'Maximum force for rare celebrations.' },
    ],
  },
  emphasis: {
    label: 'Emphasis',
    description: 'How much visual importance an entrance receives.',
    choices: [
      { id: 'quiet', label: 'Quiet', description: 'Barely scales; suitable for background changes.' },
      { id: 'standard', label: 'Standard', description: 'No added scale emphasis.' },
      { id: 'prominent', label: 'Prominent', description: 'A small scale arrival for important feedback.' },
      { id: 'hero', label: 'Hero', description: 'Strong scale arrival for rare peak moments.' },
    ],
  },
};

const FEEL_VALUES: Record<string, MotionSpring> = {
  snappy: { stiffness: 360, damping: 30, mass: 0.55 },
  responsive: { stiffness: 310, damping: 24, mass: 0.62 },
  natural: { stiffness: 250, damping: 22, mass: 0.72 },
  soft: { stiffness: 185, damping: 26, mass: 0.82 },
  heavy: { stiffness: 205, damping: 28, mass: 1.05 },
  bouncy: { stiffness: 260, damping: 14, mass: 0.68 },
  deliberate: { stiffness: 170, damping: 30, mass: 0.92 },
};

const SPEED_VALUES: Record<string, Pick<MotionTuning, 'entranceMs' | 'stateMs' | 'spatialMs' | 'phaseDelayMs'>> = {
  instant: { entranceMs: 0, stateMs: 0, spatialMs: 0, phaseDelayMs: 0 },
  fast: { entranceMs: 160, stateMs: 130, spatialMs: 220, phaseDelayMs: 300 },
  normal: { entranceMs: 240, stateMs: 190, spatialMs: 320, phaseDelayMs: 440 },
  slow: { entranceMs: 330, stateMs: 260, spatialMs: 430, phaseDelayMs: 580 },
  dramatic: { entranceMs: 480, stateMs: 340, spatialMs: 620, phaseDelayMs: 760 },
};

const BOUNCE_DAMPING: Record<string, number> = { none: 32, slight: 25, moderate: 18, high: 12 };
const OVERSHOOT_VALUES: Record<string, number> = { none: 0, small: 3, medium: 7, large: 12 };
const DISTANCE_VALUES: Record<string, number> = { tiny: 4, small: 8, medium: 12, large: 18 };
const STAGGER_VALUES: Record<string, number> = { together: 0, tight: 28, relaxed: 55, cascading: 90 };
const EMPHASIS_VALUES: Record<string, number> = { quiet: 0.99, standard: 1, prominent: 1.035, hero: 1.07 };
const ENERGY_VALUES: Record<string, { stiffness: number; timingScale: number }> = {
  calm: { stiffness: 185, timingScale: 1.18 },
  balanced: { stiffness: 250, timingScale: 1 },
  energetic: { stiffness: 320, timingScale: 0.86 },
  explosive: { stiffness: 390, timingScale: 0.72 },
};

export const MOTION_PRESETS = [
  { id: 'apple', name: 'Apple', description: 'Restrained, responsive, and softly settled.', choices: { feel: 'responsive', speed: 'fast', bounce: 'slight', overshoot: 'none', distance: 'small', stagger: 'tight', energy: 'balanced', emphasis: 'standard' } },
  { id: 'material', name: 'Material', description: 'Clear spatial movement with a firm arrival.', choices: { feel: 'natural', speed: 'normal', bounce: 'none', overshoot: 'small', distance: 'medium', stagger: 'tight', energy: 'balanced', emphasis: 'standard' } },
  { id: 'gentle', name: 'Gentle', description: 'Soft, calm motion for low-pressure moments.', choices: { feel: 'soft', speed: 'slow', bounce: 'none', overshoot: 'none', distance: 'small', stagger: 'relaxed', energy: 'calm', emphasis: 'quiet' } },
  { id: 'crisp', name: 'Crisp', description: 'Fast feedback with a decisive stop.', choices: { feel: 'snappy', speed: 'fast', bounce: 'none', overshoot: 'none', distance: 'tiny', stagger: 'tight', energy: 'energetic', emphasis: 'standard' } },
  { id: 'playful', name: 'Playful', description: 'Visible bounce and expressive travel.', choices: { feel: 'bouncy', speed: 'normal', bounce: 'high', overshoot: 'medium', distance: 'large', stagger: 'relaxed', energy: 'energetic', emphasis: 'prominent' } },
  { id: 'premium', name: 'Premium', description: 'Deliberate pace with controlled, weighted motion.', choices: { feel: 'heavy', speed: 'slow', bounce: 'slight', overshoot: 'small', distance: 'medium', stagger: 'relaxed', energy: 'balanced', emphasis: 'prominent' } },
  { id: 'athletic', name: 'Athletic', description: 'Strong, fast response without excess bounce.', choices: { feel: 'responsive', speed: 'fast', bounce: 'slight', overshoot: 'small', distance: 'medium', stagger: 'tight', energy: 'energetic', emphasis: 'prominent' } },
  { id: 'celebration', name: 'Celebration', description: 'High-energy motion reserved for peak recognition.', choices: { feel: 'bouncy', speed: 'dramatic', bounce: 'high', overshoot: 'large', distance: 'large', stagger: 'cascading', energy: 'explosive', emphasis: 'hero' } },
  { id: 'minimal', name: 'Minimal', description: 'Quiet, short travel with almost no flourish.', choices: { feel: 'natural', speed: 'fast', bounce: 'none', overshoot: 'none', distance: 'tiny', stagger: 'together', energy: 'calm', emphasis: 'quiet' } },
  { id: 'instant', name: 'Instant', description: 'No transition time; useful for accessibility checks.', choices: { feel: 'snappy', speed: 'instant', bounce: 'none', overshoot: 'none', distance: 'tiny', stagger: 'together', energy: 'balanced', emphasis: 'standard' } },
] as const;

export function normalizeMotionTuning(value: Partial<MotionTuning>, fallback: MotionTuning): MotionTuning {
  return {
    ...fallback,
    ...value,
    spring: { ...fallback.spring, ...value.spring },
  };
}

export function normalizeAnimationTuningEntries(
  value: unknown,
  validIds: readonly string[],
  fallback: MotionTuning,
): Record<string, MotionTuning> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set(validIds);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, tuning]) => allowed.has(id) && Boolean(tuning) && typeof tuning === 'object' && !Array.isArray(tuning))
      .map(([id, tuning]) => [id, normalizeMotionTuning(tuning as Partial<MotionTuning>, fallback)]),
  );
}

export function applyDesignerChoice(motion: MotionTuning, control: DesignerControl, choice: string): MotionTuning {
  if (control === 'feel') return { ...motion, spring: { ...FEEL_VALUES[choice] } };
  if (control === 'speed') return { ...motion, ...SPEED_VALUES[choice] };
  if (control === 'bounce') return { ...motion, spring: { ...motion.spring, damping: BOUNCE_DAMPING[choice] } };
  if (control === 'overshoot') return { ...motion, overshootPx: OVERSHOOT_VALUES[choice] };
  if (control === 'distance') return { ...motion, distancePx: DISTANCE_VALUES[choice] };
  if (control === 'stagger') return { ...motion, staggerMs: STAGGER_VALUES[choice] };
  if (control === 'emphasis') return { ...motion, emphasisScale: EMPHASIS_VALUES[choice] };
  const energy = ENERGY_VALUES[choice];
  return {
    ...motion,
    entranceMs: Math.round(motion.entranceMs * energy.timingScale),
    stateMs: Math.round(motion.stateMs * energy.timingScale),
    spatialMs: Math.round(motion.spatialMs * energy.timingScale),
    spring: { ...motion.spring, stiffness: energy.stiffness },
  };
}

export function applyMotionPreset(id: string, production: MotionTuning): MotionTuning {
  const preset = MOTION_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return production;
  let next = { ...production, spring: { ...production.spring } };
  for (const control of ['feel', 'speed', 'bounce', 'overshoot', 'distance', 'stagger', 'energy', 'emphasis'] as const) {
    next = applyDesignerChoice(next, control, preset.choices[control]);
  }
  return next;
}

function closestKey(value: number, choices: Record<string, number>) {
  return Object.entries(choices).reduce((closest, candidate) =>
    Math.abs(candidate[1] - value) < Math.abs(closest[1] - value) ? candidate : closest
  )[0];
}

export function inferDesignerChoices(motion: MotionTuning): Record<DesignerControl, string> {
  const feel = Object.entries(FEEL_VALUES).reduce((closest, candidate) => {
    const score = Math.abs(candidate[1].stiffness - motion.spring.stiffness) / 100
      + Math.abs(candidate[1].damping - motion.spring.damping) / 10
      + Math.abs(candidate[1].mass - motion.spring.mass);
    return score < closest.score ? { id: candidate[0], score } : closest;
  }, { id: 'natural', score: Number.POSITIVE_INFINITY }).id;
  const speed = Object.entries(SPEED_VALUES).reduce((closest, candidate) => {
    const score = Math.abs(candidate[1].entranceMs - motion.entranceMs)
      + Math.abs(candidate[1].stateMs - motion.stateMs)
      + Math.abs(candidate[1].spatialMs - motion.spatialMs);
    return score < closest.score ? { id: candidate[0], score } : closest;
  }, { id: 'normal', score: Number.POSITIVE_INFINITY }).id;
  const energy = closestKey(motion.spring.stiffness, Object.fromEntries(Object.entries(ENERGY_VALUES).map(([key, value]) => [key, value.stiffness])));
  return {
    feel,
    speed,
    bounce: closestKey(motion.spring.damping, BOUNCE_DAMPING),
    overshoot: closestKey(motion.overshootPx, OVERSHOOT_VALUES),
    distance: closestKey(motion.distancePx, DISTANCE_VALUES),
    stagger: closestKey(motion.staggerMs, STAGGER_VALUES),
    energy,
    emphasis: closestKey(motion.emphasisScale, EMPHASIS_VALUES),
  };
}

export function scaleMotionTiming(motion: MotionTuning, multiplier: number): MotionTuning {
  const scale = (value: number) => Math.max(0, Math.round(value * multiplier));
  return {
    ...motion,
    entranceMs: scale(motion.entranceMs),
    stateMs: scale(motion.stateMs),
    spatialMs: scale(motion.spatialMs),
    staggerMs: scale(motion.staggerMs),
    phaseDelayMs: scale(motion.phaseDelayMs),
  };
}

export function resetMotionSection(motion: MotionTuning, production: MotionTuning, section: 'feel' | 'choreography') {
  if (section === 'feel') {
    return {
      ...motion,
      spring: { ...production.spring },
      overshootPx: production.overshootPx,
      emphasisScale: production.emphasisScale,
    };
  }
  return {
    ...motion,
    entranceMs: production.entranceMs,
    stateMs: production.stateMs,
    spatialMs: production.spatialMs,
    staggerMs: production.staggerMs,
    phaseDelayMs: production.phaseDelayMs,
    distancePx: production.distancePx,
  };
}

export function phaseTimeline(motion: MotionTuning) {
  return [
    { id: 'entrance', label: 'Entrance', duration: motion.entranceMs },
    { id: 'hold', label: 'Hold', duration: motion.phaseDelayMs },
    { id: 'replacement', label: 'Replacement', duration: motion.spatialMs },
    { id: 'evidence', label: 'Evidence settles', duration: motion.stateMs },
  ] as const;
}
