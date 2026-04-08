/**
 * Virtual mission clock for Artemis II mode.
 *
 * In 'realtime' mode it returns wall-clock time.
 * In 'simulation' mode it advances a virtual clock by frameDt * warp,
 * clamped to the ephemeris time bounds.
 */
export class MissionClock {
  private mode: 'realtime' | 'simulation' = 'realtime';
  private virtualTimeMs: number;
  private paused = false;

  constructor(
    private epochStartMs: number,
    private epochEndMs: number,
  ) {
    // Start virtual time at mission start
    this.virtualTimeMs = epochStartMs;
  }

  setMode(mode: 'realtime' | 'simulation') {
    this.mode = mode;
    if (mode === 'simulation') {
      // If current wall time is within bounds, sync to it; otherwise start from beginning
      const now = Date.now();
      if (now >= this.epochStartMs && now <= this.epochEndMs) {
        this.virtualTimeMs = now;
      }
      // else keep current virtualTimeMs
    }
  }

  getMode(): 'realtime' | 'simulation' {
    return this.mode;
  }

  /** Advance virtual time. Call once per frame. */
  tick(frameDtSeconds: number, warp: number) {
    if (this.mode === 'realtime' || this.paused) return;
    this.virtualTimeMs += frameDtSeconds * warp * 1000;
    // Clamp to ephemeris bounds
    if (this.virtualTimeMs > this.epochEndMs) {
      this.virtualTimeMs = this.epochEndMs;
    }
    if (this.virtualTimeMs < this.epochStartMs) {
      this.virtualTimeMs = this.epochStartMs;
    }
  }

  /** Current time as a Date. */
  now(): Date {
    if (this.mode === 'realtime') return new Date();
    return new Date(this.virtualTimeMs);
  }

  /** Current time as Unix milliseconds. */
  nowMs(): number {
    if (this.mode === 'realtime') return Date.now();
    return this.virtualTimeMs;
  }

  /** Jump to a specific time (Unix ms). */
  seekTo(timeMs: number) {
    this.virtualTimeMs = Math.max(this.epochStartMs, Math.min(this.epochEndMs, timeMs));
    // Auto-switch to simulation on seek
    if (this.mode === 'realtime') {
      this.mode = 'simulation';
    }
  }

  /** Mission Elapsed Time in seconds from epoch start. */
  getMET(): number {
    const nowMs = this.mode === 'realtime' ? Date.now() : this.virtualTimeMs;
    return (nowMs - this.epochStartMs) / 1000;
  }

  /** Fractional progress through the mission [0, 1]. */
  getProgress(): number {
    const nowMs = this.mode === 'realtime' ? Date.now() : this.virtualTimeMs;
    const total = this.epochEndMs - this.epochStartMs;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, (nowMs - this.epochStartMs) / total));
  }

  /** Whether current virtual time is within ephemeris bounds. */
  isInBounds(): boolean {
    const nowMs = this.mode === 'realtime' ? Date.now() : this.virtualTimeMs;
    return nowMs >= this.epochStartMs && nowMs <= this.epochEndMs;
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getEpochStartMs(): number {
    return this.epochStartMs;
  }

  getEpochEndMs(): number {
    return this.epochEndMs;
  }
}
