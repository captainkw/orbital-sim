/**
 * CCSDS OEM (Orbital Ephemeris Message) KVN text format parser.
 *
 * Parses ephemeris data and converts from EME2000 (Z-up) to the
 * simulator's ECI Y-up coordinate system.
 *
 * Coordinate transform (EME2000 Z-up -> sim Y-up):
 *   sim_x =  oem_x
 *   sim_y =  oem_z
 *   sim_z = -oem_y
 *
 * Unit conversion: km -> meters, km/s -> m/s (multiply by 1000).
 */

export interface EphemerisPoint {
  epoch: number; // Unix timestamp in milliseconds
  position: [number, number, number]; // meters, ECI Y-up
  velocity: [number, number, number]; // m/s, ECI Y-up
}

export interface OEMEphemeris {
  objectName: string;
  centerName: string;
  refFrame: string;
  startTime: number; // Unix ms
  stopTime: number; // Unix ms
  points: EphemerisPoint[];
}

const KM_TO_M = 1000;

/**
 * Parse a CCSDS OEM KVN text string into an OEMEphemeris object.
 * Returns null if parsing fails or no valid data lines are found.
 */
export function parseOEM(text: string): OEMEphemeris | null {
  try {
    const lines = text.split(/\r?\n/);

    let objectName = '';
    let centerName = '';
    let refFrame = '';
    const points: EphemerisPoint[] = [];

    let inMeta = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip empty lines and comments
      if (line === '' || line.startsWith('COMMENT')) {
        continue;
      }

      // Track metadata block
      if (line === 'META_START') {
        inMeta = true;
        continue;
      }
      if (line === 'META_STOP') {
        inMeta = false;
        continue;
      }

      // Parse metadata key-value pairs
      if (inMeta) {
        const match = line.match(/^(\S+)\s*=\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          const trimmedValue = value.trim();
          switch (key) {
            case 'OBJECT_NAME':
              objectName = trimmedValue;
              break;
            case 'CENTER_NAME':
              centerName = trimmedValue;
              break;
            case 'REF_FRAME':
              refFrame = trimmedValue;
              break;
          }
        }
        continue;
      }

      // Skip header key-value lines (e.g., CCSDS_OEM_VERS = 2.0)
      if (line.match(/^[A-Z_]+\s*=/)) {
        continue;
      }

      // Try to parse as a data line: epoch X Y Z VX VY VZ
      const parts = line.split(/\s+/);
      if (parts.length >= 7) {
        const epochStr = parts[0];
        const epoch = Date.parse(epochStr);
        if (isNaN(epoch)) {
          continue;
        }

        const oemX = parseFloat(parts[1]);
        const oemY = parseFloat(parts[2]);
        const oemZ = parseFloat(parts[3]);
        const oemVX = parseFloat(parts[4]);
        const oemVY = parseFloat(parts[5]);
        const oemVZ = parseFloat(parts[6]);

        if (
          [oemX, oemY, oemZ, oemVX, oemVY, oemVZ].some((v) => isNaN(v))
        ) {
          continue;
        }

        // Convert EME2000 Z-up to sim Y-up and km to meters
        const position: [number, number, number] = [
          oemX * KM_TO_M,
          oemZ * KM_TO_M,
          -oemY * KM_TO_M,
        ];
        const velocity: [number, number, number] = [
          oemVX * KM_TO_M,
          oemVZ * KM_TO_M,
          -oemVY * KM_TO_M,
        ];

        points.push({ epoch, position, velocity });
      }
    }

    if (points.length === 0) {
      return null;
    }

    // Sort by epoch
    points.sort((a, b) => a.epoch - b.epoch);

    const startTime = points[0].epoch;
    const stopTime = points[points.length - 1].epoch;

    return {
      objectName,
      centerName,
      refFrame,
      startTime,
      stopTime,
      points,
    };
  } catch {
    return null;
  }
}
