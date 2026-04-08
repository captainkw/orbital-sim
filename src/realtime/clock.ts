/**
 * Real-time clock that maps wall-clock time to simulation time.
 */

/** J2000 epoch: 2000-01-01T12:00:00.000Z */
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);

const SECONDS_PER_DAY = 86400;

export class RealTimeClock {
  /** Returns current real time. */
  now(): Date {
    return new Date();
  }

  /** Converts a Date to seconds since J2000 epoch (2000-01-01T12:00:00Z). */
  j2000Seconds(date?: Date): number {
    const d = date ?? this.now();
    return (d.getTime() - J2000_EPOCH_MS) / 1000;
  }

  /** Converts a Date to days since J2000 epoch. */
  j2000Days(date?: Date): number {
    return this.j2000Seconds(date) / SECONDS_PER_DAY;
  }

  /** Returns seconds elapsed since a launch epoch. */
  missionElapsedTime(launchEpoch: Date, date?: Date): number {
    const d = date ?? this.now();
    return (d.getTime() - launchEpoch.getTime()) / 1000;
  }

  /** Format elapsed seconds as "DDd HH:MM:SS". */
  formatMET(seconds: number): string {
    const totalSeconds = Math.floor(Math.abs(seconds));
    const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
    const remainder = totalSeconds % SECONDS_PER_DAY;
    const hours = Math.floor(remainder / 3600);
    const minutes = Math.floor((remainder % 3600) / 60);
    const secs = remainder % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');

    return `${days}d ${hh}:${mm}:${ss}`;
  }
}
