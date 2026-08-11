export const REST_TIMER_AUDIO_WINDOW_START_SECOND = 3;
export const REST_TIMER_AUDIO_SEQUENCE_TAIL_MS = 1_050;

export type RestTimerCountdownPlayer = {
  volume: number;
  play: () => void;
  pause?: () => void;
  seekTo?: (seconds: number) => Promise<void>;
  release: () => void;
};

type TimeoutHandle = ReturnType<typeof setTimeout>;

export type RestTimerCountdownAudioOptions = {
  createPlayer: () => RestTimerCountdownPlayer;
  onError?: (error: unknown) => void;
  schedule?: (callback: () => void, delayMs: number) => TimeoutHandle;
  cancelScheduled?: (handle: TimeoutHandle) => void;
};

function safelyReport(onError: ((error: unknown) => void) | undefined, error: unknown) {
  try {
    onError?.(error);
  } catch {
    // Audio diagnostics are presentation-only and must never affect Session execution.
  }
}

/**
 * Owns the native countdown player only during the Session Logger's final
 * countdown window. Constructing this controller performs no native work.
 */
export class RestTimerCountdownAudioWindow {
  private readonly createPlayer: () => RestTimerCountdownPlayer;
  private readonly onError?: (error: unknown) => void;
  private readonly schedule: (callback: () => void, delayMs: number) => TimeoutHandle;
  private readonly cancelScheduled: (handle: TimeoutHandle) => void;
  private player: RestTimerCountdownPlayer | null = null;
  private cleanupHandle: TimeoutHandle | null = null;
  private generation = 0;
  private started = false;
  private disposed = false;

  constructor(options: RestTimerCountdownAudioOptions) {
    this.createPlayer = options.createPlayer;
    this.onError = options.onError;
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelScheduled = options.cancelScheduled ?? ((handle) => clearTimeout(handle));
  }

  startAt(remainingSeconds: number) {
    if (
      this.disposed ||
      this.started ||
      !Number.isFinite(remainingSeconds) ||
      remainingSeconds < 0 ||
      remainingSeconds > REST_TIMER_AUDIO_WINDOW_START_SECOND
    ) {
      return false;
    }

    this.started = true;
    const generation = ++this.generation;

    try {
      const player = this.createPlayer();
      this.player = player;
      player.volume = 0.78;

      const offsetSeconds = REST_TIMER_AUDIO_WINDOW_START_SECOND - remainingSeconds;
      if (offsetSeconds > 0 && player.seekTo) {
        void player.seekTo(offsetSeconds)
          .then(() => {
            if (this.disposed || generation !== this.generation || this.player !== player) return;
            this.playAndScheduleCleanup(player, remainingSeconds, generation);
          })
          .catch((error) => this.fail(player, generation, error));
      } else {
        this.playAndScheduleCleanup(player, remainingSeconds, generation);
      }
      return true;
    } catch (error) {
      this.fail(this.player, generation, error);
      return false;
    }
  }

  reset() {
    this.generation += 1;
    this.started = false;
    this.releasePlayer();
  }

  dispose() {
    this.disposed = true;
    this.reset();
  }

  private playAndScheduleCleanup(
    player: RestTimerCountdownPlayer,
    remainingSeconds: number,
    generation: number,
  ) {
    try {
      player.play();
      const delayMs = Math.max(
        REST_TIMER_AUDIO_SEQUENCE_TAIL_MS,
        (remainingSeconds * 1_000) + REST_TIMER_AUDIO_SEQUENCE_TAIL_MS,
      );
      this.cleanupHandle = this.schedule(() => {
        if (generation !== this.generation || this.player !== player) return;
        this.releasePlayer();
      }, delayMs);
    } catch (error) {
      this.fail(player, generation, error);
    }
  }

  private fail(
    player: RestTimerCountdownPlayer | null,
    generation: number,
    error: unknown,
  ) {
    if (generation === this.generation && (!player || this.player === player)) {
      this.started = false;
      this.releasePlayer();
    } else if (player) {
      try {
        player.release();
      } catch {
        // Releasing failed audio must remain non-fatal.
      }
    }
    safelyReport(this.onError, error);
  }

  private releasePlayer() {
    if (this.cleanupHandle) {
      this.cancelScheduled(this.cleanupHandle);
      this.cleanupHandle = null;
    }
    const player = this.player;
    this.player = null;
    if (!player) return;
    try {
      player.pause?.();
    } catch {
      // Release remains best-effort.
    }
    try {
      player.release();
    } catch {
      // Audio cleanup must never affect the Logger.
    }
  }
}
