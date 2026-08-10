export type RestTimerCompletionDelivery = 'logger' | 'modal' | 'notification';

export function restTimerCompletionId(
  workoutId: string | number,
  endAtMs: number,
): string {
  return `${String(workoutId)}:${Math.trunc(endAtMs)}`;
}

export function isActiveSessionLoggerPath(
  pathname: string | null | undefined,
  workoutId: string | number,
): boolean {
  const normalizedPath = String(pathname || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  const encodedWorkoutId = encodeURIComponent(String(workoutId));
  return normalizedPath.endsWith(`/workout/${encodedWorkoutId}`);
}

export function resolveRestTimerCompletionDelivery({
  appState,
  pathname,
  workoutId,
  completedWhileBackgrounded = false,
}: {
  appState: string;
  pathname: string | null | undefined;
  workoutId: string | number;
  completedWhileBackgrounded?: boolean;
}): RestTimerCompletionDelivery {
  if (completedWhileBackgrounded || appState !== 'active') return 'notification';
  return isActiveSessionLoggerPath(pathname, workoutId) ? 'logger' : 'modal';
}

export type RestTimerAudioAction = Readonly<{
  acquire: boolean;
  play: 'short' | 'finish' | null;
  release: boolean;
}>;

const NO_AUDIO_ACTION: RestTimerAudioAction = Object.freeze({
  acquire: false,
  play: null,
  release: false,
});

/**
 * Owns the audio-focus state for one 3-2-1-0 completion sequence.
 * Short tones never release focus. The final tone's playback-complete event,
 * cancellation, or a replacement sequence is the only release boundary.
 */
export class RestTimerAudioSequenceGate {
  private sequenceId: string | null = null;
  private focusHeld = false;
  private finalToneStarted = false;

  isActiveSequence(sequenceId: string): boolean {
    return this.sequenceId === sequenceId && this.focusHeld;
  }

  cue(sequenceId: string, tone: 'short' | 'finish'): RestTimerAudioAction {
    if (this.sequenceId !== sequenceId) {
      this.sequenceId = sequenceId;
      this.focusHeld = false;
      this.finalToneStarted = false;
    }
    if (tone === 'finish' && this.finalToneStarted) return NO_AUDIO_ACTION;
    if (tone === 'finish') this.finalToneStarted = true;
    const acquire = !this.focusHeld;
    this.focusHeld = true;
    return { acquire, play: tone, release: false };
  }

  finalToneFinished(sequenceId: string): RestTimerAudioAction {
    if (
      this.sequenceId !== sequenceId
      || !this.focusHeld
      || !this.finalToneStarted
    ) {
      return NO_AUDIO_ACTION;
    }
    this.focusHeld = false;
    this.sequenceId = null;
    this.finalToneStarted = false;
    return { acquire: false, play: null, release: true };
  }

  cancel(sequenceId?: string): RestTimerAudioAction {
    if (sequenceId && this.sequenceId && sequenceId !== this.sequenceId) {
      return NO_AUDIO_ACTION;
    }
    const release = this.focusHeld;
    this.focusHeld = false;
    this.sequenceId = null;
    this.finalToneStarted = false;
    return { acquire: false, play: null, release };
  }
}

export class RestTimerCompletionGate {
  private claimed = new Set<string>();

  claim(completionId: string): boolean {
    if (this.claimed.has(completionId)) return false;
    this.claimed.add(completionId);
    return true;
  }
}
