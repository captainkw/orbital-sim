/**
 * Uses satellite.js to propagate ISS position from TLE data fetched
 * from CelesTrak.
 */

import * as satellite from 'satellite.js';

const CELESTRAK_ISS_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

/** Refetch interval: 2 hours in milliseconds */
const REFETCH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export class ISSTracker {
  private satrec: satellite.SatRec | null = null;
  private refetchTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Fetches the ISS TLE from CelesTrak, parses it, and stores the
   * propagation record. Sets up a 2-hour refetch interval.
   */
  async fetchTLE(): Promise<void> {
    try {
      const response = await fetch(CELESTRAK_ISS_URL);
      if (!response.ok) {
        console.warn(
          `[ISSTracker] TLE fetch failed: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const text = await response.text();
      const lines = text.trim().split('\n').map((l) => l.trim());

      if (lines.length < 3) {
        console.warn('[ISSTracker] TLE response has fewer than 3 lines');
        return;
      }

      // Line 0 = name, Line 1 + Line 2 = TLE
      const line1 = lines[1];
      const line2 = lines[2];

      this.satrec = satellite.twoline2satrec(line1, line2);
    } catch (err) {
      console.warn('[ISSTracker] TLE fetch error:', err);
      // Keep the last TLE if we had one
    }

    // Set up periodic refetch (clear any existing timer first)
    if (this.refetchTimer !== null) {
      clearInterval(this.refetchTimer);
    }
    this.refetchTimer = setInterval(() => {
      void this.fetchTLE();
    }, REFETCH_INTERVAL_MS);
  }

  /**
   * Propagates the ISS position and velocity for the given date.
   * Returns ECI Y-up coordinates in meters (position) and m/s (velocity),
   * or null if TLE has not been loaded or propagation fails.
   *
   * satellite.js returns ECI in km (Z-up). We convert:
   *   sim_x =  eci.x * 1000
   *   sim_y =  eci.z * 1000
   *   sim_z = -eci.y * 1000
   */
  getPositionECI(
    date: Date,
  ): {
    position: [number, number, number];
    velocity: [number, number, number];
  } | null {
    if (this.satrec === null) {
      return null;
    }

    const positionAndVelocity = satellite.propagate(this.satrec, date);

    const posEci = positionAndVelocity.position;
    const velEci = positionAndVelocity.velocity;

    // propagate returns false on error
    if (
      typeof posEci === 'boolean' ||
      typeof velEci === 'boolean' ||
      !posEci ||
      !velEci
    ) {
      return null;
    }

    // Convert from km Z-up to meters Y-up
    const position: [number, number, number] = [
      posEci.x * 1000,
      posEci.z * 1000,
      -posEci.y * 1000,
    ];

    // Convert from km/s Z-up to m/s Y-up
    const velocity: [number, number, number] = [
      velEci.x * 1000,
      velEci.z * 1000,
      -velEci.y * 1000,
    ];

    return { position, velocity };
  }

  /** Whether TLE data has been loaded and is ready for propagation. */
  isReady(): boolean {
    return this.satrec !== null;
  }
}
