export const ANIMATION_CATEGORIES = [
  'Logging',
  'Recognition',
  'Movement and session completion',
  'Readiness and reflection',
  'Navigation and shell',
  'Controls and microinteractions',
] as const;

export type AnimationCategory = typeof ANIMATION_CATEGORIES[number];
export type AnimationPreviewKind =
  | 'logging-state'
  | 'row-insertion'
  | 'completed-set-swipe'
  | 'recognition'
  | 'major-milestone'
  | 'session-completion'
  | 'readiness-rail'
  | 'sheet'
  | 'navigation'
  | 'control';

export type PreviewHaptic = 'none' | 'light' | 'medium' | 'heavy' | 'success' | 'warning/error' | 'selection';

export type AnimationLibraryEntry = {
  id: string;
  title: string;
  category: AnimationCategory;
  description: string;
  kind: AnimationPreviewKind;
  variant: string;
  timings: readonly string[];
  haptic: PreviewHaptic;
  hapticSequence?: string;
  reducedMotion: string;
  interactive?: boolean;
};

const state = (id: string, title: string, description: string, variant: string, haptic: PreviewHaptic = 'none'): AnimationLibraryEntry => ({
  id, title, description, category: 'Logging', kind: 'logging-state', variant,
  timings: ['Press 140 ms', 'State 190 ms'], haptic, reducedMotion: 'State changes immediately; status text remains.',
});

export const ANIMATION_LIBRARY: readonly AnimationLibraryEntry[] = [
  state('log-set-press', 'Log Set pressed state', 'Confirms the primary logger action has been engaged.', 'pressed', 'light'),
  state('log-set-saving', 'Saving', 'Holds the accepted action while persistence is pending.', 'saving'),
  state('log-set-logged', 'Logged', 'Confirms an ordinary set save without overstating it.', 'logged', 'light'),
  state('log-set-failed', 'Failed save', 'Makes a failed save explicit without losing the athlete’s inputs.', 'failed', 'warning/error'),
  state('log-set-retry', 'Retry', 'Returns a failed action to a clear retryable state.', 'retry', 'light'),
  { id: 'completed-row-insertion', title: 'Completed-set row insertion', category: 'Logging', description: 'Places accepted evidence into the completed-set list.', kind: 'row-insertion', variant: 'insert', timings: ['Component 260 ms'], haptic: 'light', reducedMotion: 'The row appears in its final position.' },
  { id: 'completed-swipe-tooltip', title: 'Completed-set swipe tooltip', category: 'Logging', description: 'Teaches the bidirectional completed-set gesture once.', kind: 'completed-set-swipe', variant: 'tooltip', timings: ['Nudge 120 / 140 ms'], haptic: 'none', reducedMotion: 'Shows a short text alternative instead of nudging.', interactive: true },
  { id: 'completed-swipe-actions', title: 'Edit / Delete swipe reveal', category: 'Logging', description: 'Exposes Edit to the left and Delete to the right.', kind: 'completed-set-swipe', variant: 'actions', timings: ['Reveal direct manipulation', 'Settle 180 ms'], haptic: 'selection', reducedMotion: 'Gesture remains direct; settle is immediate.', interactive: true },

  { id: 'weight-pr', title: 'Weight PR', category: 'Recognition', description: 'Stages an eight-beat record takeover with adjustable movement, load, and units.', kind: 'recognition', variant: 'weight', timings: ['Establish 543 ms', 'Approach 307 ms', 'Impact 403 ms', 'Victory 244 ms', 'Hold 787 ms', 'Breathe 543 ms', 'Evidence 403 ms', 'Settle 244 ms'], haptic: 'success', hapticSequence: 'medium impact → success settle', reducedMotion: 'Skips displacement and atmosphere; shows the final factual comparison with static emphasis.' },
  { id: 'rep-max-pr', title: 'Rep-Max PR', category: 'Recognition', description: 'Uses the record-replacement choreography with adjustable rep count, movement, load, and units.', kind: 'recognition', variant: 'rep', timings: ['Establish 543 ms', 'Approach 307 ms', 'Impact 403 ms', 'Victory 244 ms', 'Hold 787 ms', 'Breathe 543 ms', 'Evidence 403 ms', 'Settle 244 ms'], haptic: 'success', hapticSequence: 'medium impact → success settle', reducedMotion: 'Shows the final adjustable Rep-Max comparison without displacement.' },
  { id: 'rpe-pr', title: 'Movement Efficiency', category: 'Recognition', description: 'Uses the calmer efficiency choreography with adjustable workload, movement, and RPE evidence.', kind: 'recognition', variant: 'rpe', timings: ['Former effort', 'New attempt', 'Takeover', 'More efficient', 'Hold', 'Evidence transition', 'Final evidence', 'Complete'], haptic: 'medium', hapticSequence: 'restrained impact', reducedMotion: 'Shows the adjustable workload, RPE comparison, and change without displacement or atmosphere.' },
  { id: 'recognition-reduced', title: 'Reduced Motion', category: 'Recognition', description: 'Previews the factual fallback for Weight PR, Rep-Max PR, or Movement Efficiency from one parameterized surface.', kind: 'recognition', variant: 'reduced', timings: ['Immediate'], haptic: 'success', reducedMotion: 'Always renders the selected family without travel, displacement, particles, or atmosphere.' },
  { id: 'major-volume-total', title: 'Major Milestone — Total Lifetime Volume', category: 'Recognition', description: 'Claims a major total lifetime-volume landmark, then locks in exact evidence and the next goal.', kind: 'major-milestone', variant: 'total', timings: ['Focus', 'Landmark system', 'Accumulation', 'Threshold impact', 'Landmark hero', 'Earned artifact', 'Evidence', 'Resolve'], haptic: 'heavy', hapticSequence: 'heavy impact at threshold crossing', reducedMotion: 'Shows the earned landmark artifact and factual evidence immediately.' },
  { id: 'major-volume-lift', title: 'Major Milestone — Per-Lift Lifetime Volume', category: 'Recognition', description: 'Claims a lift-specific lifetime-volume landmark with the selected lift identity and exact evidence.', kind: 'major-milestone', variant: 'lift', timings: ['Focus', 'Lift context', 'Accumulation', 'Threshold impact', 'Landmark hero', 'Earned artifact', 'Evidence', 'Resolve'], haptic: 'heavy', hapticSequence: 'heavy impact at threshold crossing', reducedMotion: 'Shows the lift landmark artifact and factual evidence immediately.' },

  { id: 'post-session-ledger-ceremony', title: 'Post-Session Ledger Ceremony', category: 'Movement and session completion', description: 'Enters the completed training into the ledger, acknowledges the session streak, then reveals the durable digest.', kind: 'session-completion', variant: 'ledger', timings: ['Fade to focus', 'Ledger materializes', 'Streak rises', 'Calm hold', 'Ledger recedes', 'Digest reveal'], haptic: 'success', reducedMotion: 'Shows the resolved streak and session digest immediately.' },

  { id: 'readiness-sheet', title: 'Readiness sheet entrance', category: 'Readiness and reflection', description: 'Presents the pre-session check-in as a focused sheet.', kind: 'sheet', variant: 'readiness', timings: ['Component 260 ms'], haptic: 'none', reducedMotion: 'Sheet appears without translation.' },
  { id: 'readiness-rail', title: 'Readiness rail interaction', category: 'Readiness and reflection', description: 'Tracks direct input continuously and settles on release.', kind: 'readiness-rail', variant: 'energy', timings: ['Direct spring'], haptic: 'light', reducedMotion: 'Live rail response remains; thumb scaling is removed.', interactive: true },
  { id: 'begin-session', title: 'Begin Session transition', category: 'Readiness and reflection', description: 'Confirms readiness and hands focus to the active logger.', kind: 'sheet', variant: 'begin', timings: ['Press 140 ms', 'Component 260 ms'], haptic: 'success', reducedMotion: 'State switches immediately.' },
  { id: 'reflection-entrance', title: 'Post-session reflection entrance', category: 'Readiness and reflection', description: 'Introduces optional reflection after completion evidence.', kind: 'sheet', variant: 'reflection', timings: ['Component 260 ms'], haptic: 'none', reducedMotion: 'Reflection appears in place.' },
  { id: 'notes-expansion', title: 'Notes expansion', category: 'Readiness and reflection', description: 'Reveals optional notes without changing the surrounding hierarchy.', kind: 'control', variant: 'accordion', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Notes open immediately.' },
  { id: 'complete-session', title: 'Complete Session transition', category: 'Readiness and reflection', description: 'Closes reflection and returns to the completed recap.', kind: 'sheet', variant: 'complete', timings: ['Component 260 ms'], haptic: 'success', reducedMotion: 'Recap replaces reflection immediately.' },

  { id: 'nav-expand', title: 'Floating navigation expand', category: 'Navigation and shell', description: 'Expands the focused tab anchor into the full destination row.', kind: 'navigation', variant: 'expand', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Width and destinations update immediately.' },
  { id: 'nav-collapse', title: 'Floating navigation collapse', category: 'Navigation and shell', description: 'Returns the row to the current destination anchor.', kind: 'navigation', variant: 'collapse', timings: ['State 190 ms'], haptic: 'none', reducedMotion: 'Width updates immediately.' },
  { id: 'active-tab', title: 'Active-tab transition', category: 'Navigation and shell', description: 'Moves emphasis between destinations while preserving orientation.', kind: 'navigation', variant: 'tab', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Selection color changes immediately.' },
  { id: 'screen-entrance', title: 'Screen content entrance', category: 'Navigation and shell', description: 'Introduces a new screen section with restrained spatial motion.', kind: 'row-insertion', variant: 'screen', timings: ['Component 260 ms'], haptic: 'none', reducedMotion: 'Content appears in place.' },
  { id: 'modal-motion', title: 'Modal entrance and dismissal', category: 'Navigation and shell', description: 'Moves a focused dialog above the current context.', kind: 'sheet', variant: 'modal', timings: ['Component 260 ms', 'Exit 190 ms'], haptic: 'none', reducedMotion: 'Dialog visibility changes immediately.' },
  { id: 'sheet-motion', title: 'Sheet entrance and dismissal', category: 'Navigation and shell', description: 'Presents a task surface from the lower edge.', kind: 'sheet', variant: 'sheet', timings: ['Spatial 320 ms', 'Exit 190 ms'], haptic: 'none', reducedMotion: 'Sheet visibility changes immediately.' },

  { id: 'primary-press', title: 'Primary button press', category: 'Controls and microinteractions', description: 'Gives immediate tactile confirmation to the dominant action.', kind: 'control', variant: 'primary', timings: ['Press 140 ms'], haptic: 'light', reducedMotion: 'Opacity feedback remains; scale is removed.' },
  { id: 'secondary-press', title: 'Secondary button press', category: 'Controls and microinteractions', description: 'Confirms a supporting action without competing with the primary.', kind: 'control', variant: 'secondary', timings: ['Press 140 ms'], haptic: 'light', reducedMotion: 'Opacity feedback remains; scale is removed.' },
  { id: 'danger-press', title: 'Destructive button press', category: 'Controls and microinteractions', description: 'Makes a destructive control deliberate and unmistakable.', kind: 'control', variant: 'danger', timings: ['Press 140 ms'], haptic: 'warning/error', reducedMotion: 'Opacity feedback remains; scale is removed.' },
  { id: 'segment-selection', title: 'Segmented-control selection', category: 'Controls and microinteractions', description: 'Moves selection between compact mutually exclusive options.', kind: 'control', variant: 'segment', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Selection updates immediately.' },
  { id: 'toggle', title: 'Toggle', category: 'Controls and microinteractions', description: 'Communicates a binary preference change.', kind: 'control', variant: 'toggle', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Toggle state updates immediately.' },
  { id: 'metric-transition', title: 'Metric transition', category: 'Controls and microinteractions', description: 'Updates a changing number without making the layout jump.', kind: 'control', variant: 'metric', timings: ['State 190 ms'], haptic: 'none', reducedMotion: 'Metric updates without scale.' },
  { id: 'accordion', title: 'Accordion expansion', category: 'Controls and microinteractions', description: 'Reveals secondary evidence in place.', kind: 'control', variant: 'accordion', timings: ['State 190 ms'], haptic: 'selection', reducedMotion: 'Content visibility changes immediately.' },
  { id: 'loading-content', title: 'Loading to content', category: 'Controls and microinteractions', description: 'Replaces a pending state with stable content.', kind: 'control', variant: 'loading', timings: ['Component 260 ms'], haptic: 'none', reducedMotion: 'Content replaces loading immediately.' },
  { id: 'error-retry', title: 'Error to retry', category: 'Controls and microinteractions', description: 'Recovers from a visible error after an explicit retry.', kind: 'control', variant: 'error', timings: ['State 190 ms'], haptic: 'warning/error', reducedMotion: 'State updates immediately.' },
] as const;

export function animationsByCategory(category: AnimationCategory) {
  return ANIMATION_LIBRARY.filter((entry) => entry.category === category);
}

export const ANIMATION_NAVIGATION_GROUPS = [
  'Recognition',
  'Session Logger',
  'Navigation',
  'Readiness',
  'Reflection',
  'Completion',
  'Controls',
  'Gestures',
  'Loading & States',
] as const;

export type AnimationNavigationGroup = typeof ANIMATION_NAVIGATION_GROUPS[number];

export function animationNavigationGroup(entry: AnimationLibraryEntry): AnimationNavigationGroup {
  if (entry.kind === 'recognition' || entry.kind === 'major-milestone') return 'Recognition';
  if (entry.kind === 'completed-set-swipe') return 'Gestures';
  if (entry.kind === 'session-completion') return 'Completion';
  if (entry.kind === 'navigation' || ['screen', 'modal', 'sheet'].includes(entry.variant)) return 'Navigation';
  if (entry.kind === 'readiness-rail' || ['readiness', 'begin'].includes(entry.variant)) return 'Readiness';
  if (['reflection', 'complete'].includes(entry.variant) || entry.id === 'notes-expansion') return 'Reflection';
  if (entry.kind === 'logging-state' || entry.id === 'completed-row-insertion') return 'Session Logger';
  if (['loading', 'error'].includes(entry.variant)) return 'Loading & States';
  return 'Controls';
}

export function animationsByNavigationGroup(group: AnimationNavigationGroup) {
  return ANIMATION_LIBRARY.filter((entry) => animationNavigationGroup(entry) === group);
}

export function animationUses(entry: AnimationLibraryEntry): readonly string[] {
  if (entry.kind === 'major-milestone') return ['MajorVolumeMilestoneRecognition', 'Canonical medallion asset registry', 'Lifetime volume rail', 'Post-session ledger artwork'];
  if (['weight-pr', 'rep-max-pr'].includes(entry.id)) return ['CanonicalRecordRecognition', 'SLTrophy', 'LinearGradient', 'Deterministic fragments'];
  if (entry.kind === 'recognition') return ['LoggerFeedbackSurface', entry.variant === 'weight' || entry.variant === 'multiple' ? 'RecordReplacementHero' : 'Recognition presentation'];
  if (entry.kind === 'completed-set-swipe') return ['CompletedSetSwipeRow', 'Gesture Handler', 'Reanimated'];
  if (entry.kind === 'session-completion') return ['SessionImpactPanel', 'PostSessionLedgerCeremony', 'Temporary ledger artwork'];
  if (entry.kind === 'readiness-rail') return ['ReadinessScale', 'Direct manipulation spring'];
  if (entry.kind === 'navigation') return ['useFloatingNavigationMotion', 'SLMotionPressable'];
  if (entry.kind === 'logging-state') return ['logSetActionPresentation', 'SLButton'];
  if (entry.kind === 'control') return ['SLButton / SLMotionPressable', 'Shared motion tokens'];
  return ['SLMotionEntrance', 'Shared motion tokens'];
}

export function animationMotionType(entry: AnimationLibraryEntry) {
  if (entry.kind === 'major-milestone') return 'Eight-phase accumulation → threshold impact → earned artifact → evidence';
  if (['weight-pr', 'rep-max-pr'].includes(entry.id)) return 'Eight-phase takeover → atmosphere → evidence settle';
  if (entry.interactive) return 'Direct manipulation + spring settle';
  if (entry.kind === 'recognition') return entry.variant === 'weight' || entry.variant === 'multiple' ? 'Multi-phase displacement' : 'Spring + evidence reveal';
  if (entry.kind === 'navigation') return 'Width interpolation + state transition';
  if (entry.kind === 'session-completion') return 'Ledger materialization → streak settle → digest reveal';
  return entry.timings.join(' · ');
}
