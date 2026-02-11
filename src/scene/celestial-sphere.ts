import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const OBLIQUITY = 23.44 * DEG_TO_RAD;

// ~150 brightest stars: [RA_hours, Dec_degrees, apparent_magnitude]
const STAR_CATALOG: [number, number, number][] = [
  // Navigation / brightest stars
  [6.752, -16.72, -1.46],   // Sirius
  [6.399, -52.70, -0.74],   // Canopus
  [14.660, -60.84, -0.27],  // Alpha Centauri
  [14.261, 19.18, -0.05],   // Arcturus
  [18.616, 38.78, 0.03],    // Vega
  [5.242, -8.20, 0.13],     // Rigel
  [7.655, 5.23, 0.34],      // Procyon
  [1.628, -57.24, 0.46],    // Achernar
  [5.920, 7.41, 0.50],      // Betelgeuse
  [14.064, -60.37, 0.61],   // Hadar
  [12.443, -63.10, 0.77],   // Acrux
  [19.846, 8.87, 0.77],     // Altair
  [4.598, 16.51, 0.85],     // Aldebaran
  [13.398, -11.16, 0.98],   // Spica
  [16.490, -26.43, 0.96],   // Antares
  [5.438, -1.20, 1.64],     // Alnilam
  [1.163, -10.18, 2.04],    // Diphda
  [2.120, 89.26, 1.98],     // Polaris
  [7.577, -26.39, 1.84],    // Wezen
  [22.960, -29.62, 1.16],   // Fomalhaut
  [20.690, 45.28, 1.25],    // Deneb
  [12.519, -57.11, 1.30],   // Mimosa
  [10.140, 11.97, 1.35],    // Regulus
  [6.378, -17.96, 1.50],    // Adhara
  [22.137, -43.00, 1.74],   // Al Na'ir
  [5.679, -1.94, 1.70],     // Alnitak
  [6.629, 16.40, 1.93],     // Alhena
  [8.375, -59.51, 1.68],    // Miaplacidus
  [17.562, -37.10, 1.63],   // Sargas (Theta Scorpii)
  [3.038, 40.96, 2.09],     // Mirfak
  [0.726, -17.99, 2.04],    // Deneb Kaitos
  [12.900, 55.96, 1.77],    // Alioth
  [13.792, 49.31, 1.86],    // Alkaid
  [20.427, -56.74, 1.94],   // Peacock
  [6.977, -28.97, 1.98],    // Wezen
  [17.582, 12.56, 2.08],    // Rasalhague
  [2.065, 42.33, 2.06],     // Mirach
  [0.439, 29.09, 2.06],     // Alpheratz
  [17.944, -40.05, 1.62],   // Kaus Australis
  [5.418, 6.35, 1.64],      // Bellatrix
  [5.920, -5.91, 2.06],     // Mintaka
  [9.460, -8.66, 1.99],     // Alphard
  [5.268, 45.99, 1.65],     // Elnath
  [4.330, -62.47, 1.91],    // Acamar — actually lower mag, using placeholder
  [11.818, 14.57, 2.14],    // Denebola
  [3.405, 49.86, 1.80],     // Algol region
  [18.921, -34.38, 1.85],   // Nunki
  [16.836, -34.29, 2.29],   // Dschubba
  [17.622, 35.39, 2.23],    // Sarin
  [5.795, 44.95, 1.90],     // Menkalinan

  // Zodiac / major constellation stars
  [0.139, 29.09, 2.06],     // Sirrah
  [1.907, 20.81, 2.00],     // Hamal
  [3.792, 24.11, 2.87],     // Alcyone
  [5.533, -0.30, 2.09],     // Mintaka approx
  [7.167, 22.51, 3.36],     // Tejat
  [8.726, 21.47, 3.52],     // Kappa Geminorum
  [9.764, 23.77, 3.61],     // Rho Leonis
  [11.235, 20.52, 2.56],    // Zosma
  [11.845, 53.69, 2.37],    // Merak
  [12.257, 57.03, 2.44],    // Dubhe approx
  [13.064, 10.96, 2.83],    // Vindemiatrix
  [14.846, -16.04, 2.75],   // Zubenelgenubi
  [15.283, -9.38, 2.61],    // Zubeneschamali
  [16.006, -22.62, 2.62],   // Graffias
  [16.353, -25.59, 2.29],   // Dschubba
  [17.208, -43.24, 1.87],   // Shaula
  [18.350, -29.83, 2.82],   // Kaus Media
  [19.044, -27.67, 2.89],   // Ascella
  [20.188, -12.51, 2.87],   // Dabih
  [20.794, -9.50, 2.91],    // Sadalsuud area
  [22.096, -0.32, 2.94],    // Sadalmelik area
  [23.063, 15.35, 2.49],    // Markab

  // Southern sky
  [0.438, -42.31, 2.39],    // Ankaa
  [1.906, -67.23, 2.80],    // Beta Hydri
  [4.233, -42.29, 2.97],    // Zaurak
  [5.593, -34.07, 2.65],    // Arneb
  [6.111, -35.28, 3.02],    // Furud
  [8.159, -47.34, 1.86],    // Avior
  [9.220, -69.72, 1.67],    // Beta Carinae
  [10.716, -49.42, 2.21],   // Lambda Velorum
  [12.140, -50.72, 2.76],   // Delta Centauri
  [12.691, -48.96, 2.55],   // Muhlifain
  [13.340, -36.37, 2.55],   // Menkent
  [14.111, -36.37, 2.06],   // Theta Centauri
  [15.586, -41.17, 2.30],   // Epsilon Lupi
  [16.120, -19.81, 2.56],   // Beta Scorpii
  [17.421, -55.53, 1.69],   // Alpha Trianguli Australis
  [18.401, -62.68, 1.92],   // Alpha Pavonis approx
  [19.398, -40.62, 1.79],   // Gamma Sagittarii approx
  [21.264, -65.37, 2.86],   // Alpha Tucanae
  [22.711, -46.96, 1.73],   // Alnair
  [23.875, -29.36, 3.27],   // Deneb Kaitos Shemali

  // Northern sky fill
  [3.083, 53.51, 2.24],     // Mirfak region
  [5.108, 41.23, 3.17],     // Lambda Aurigae
  [6.190, 22.51, 3.06],     // Eta Geminorum
  [7.399, 31.78, 1.58],     // Castor
  [7.455, 28.03, 1.14],     // Pollux
  [9.311, 36.40, 3.14],     // Tania Borealis
  [10.332, 19.84, 2.97],    // Algieba
  [11.062, 56.38, 2.34],    // Merak
  [11.897, 53.69, 1.77],    // Dubhe
  [12.540, 55.96, 1.77],    // Alioth
  [12.900, 55.96, 1.77],    // Mizar
  [13.399, 54.93, 1.86],    // Alkaid
  [14.177, 51.79, 3.31],    // Cor Caroli approx
  [15.578, 26.71, 2.23],    // Alphecca
  [16.696, 31.60, 2.07],    // Beta Herculis
  [17.244, 36.81, 3.16],    // Zeta Herculis
  [18.355, 36.07, 3.24],    // Eta Lyrae
  [19.280, 27.96, 3.05],    // Gamma Cygni
  [19.512, 27.96, 2.20],    // Sadr
  [20.370, 40.26, 2.48],    // Epsilon Cygni
  [21.309, 62.59, 2.44],    // Errai
  [23.079, 28.08, 2.42],    // Scheat
  [23.655, 77.63, 2.02],    // Gamma Cephei

  // Additional fill stars
  [0.945, 60.72, 2.24],     // Schedar
  [1.430, 60.24, 2.68],     // Caph area
  [2.295, 59.15, 2.47],     // Gamma Cassiopeiae area
  [3.787, 24.05, 2.85],     // Atlas region (Pleiades)
  [4.950, 33.17, 1.90],     // Capella
  [5.545, 28.61, 3.03],     // Theta Aurigae
  [6.725, -26.39, 2.45],    // Murzim
  [7.827, -14.69, 3.93],    // Sigma Canis Majoris
  [8.627, 20.34, 3.34],     // Kappa Cancri area
  [10.890, -16.20, 3.11],   // Gamma Corvi area
  [12.263, -22.68, 3.00],   // Gamma Corvii
  [15.737, -29.21, 2.56],   // Beta Librae
  [16.612, -10.57, 2.43],   // Delta Ophiuchi
  [17.171, -15.72, 2.43],   // Eta Ophiuchi
  [17.793, 4.57, 2.08],     // Cebalrai area
  [18.098, -30.42, 2.70],   // Lambda Sagittarii
  [19.771, 10.61, 2.72],    // Tarazed
  [20.246, -0.82, 2.99],    // Theta Aquilae
  [21.526, 9.88, 2.39],     // Enif
  [22.717, 10.83, 2.49],    // Markab area
  [23.568, 25.35, 2.83],    // Algenib region
  [0.220, 15.18, 2.83],     // Delta Piscium area
  [1.524, -10.18, 2.04],    // Diphda
  [2.833, -40.30, 2.39],    // Acamar region
  [3.720, -9.77, 2.54],     // Epsilon Eridani area
  [4.477, -30.56, 2.79],    // Gamma Eridani area
];

/**
 * Convert RA (hours) and Dec (degrees) to ECI Y-up unit vector.
 * ECI Y-up: Y = north pole, X/Z = equatorial plane
 * RA=0 → +X, RA=6h → -Z, RA=12h → -X, RA=18h → +Z
 */
function raDecToECI(raHours: number, decDeg: number): THREE.Vector3 {
  const ra = raHours * (Math.PI / 12);
  const dec = decDeg * DEG_TO_RAD;
  return new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    -Math.cos(dec) * Math.sin(ra)
  );
}

/**
 * Convert ecliptic longitude/latitude to ECI Y-up.
 */
function eclipticToECI(lonRad: number, latRad: number): THREE.Vector3 {
  // Ecliptic → equatorial: rotate around X by obliquity
  const xe = Math.cos(latRad) * Math.cos(lonRad);
  const ye = Math.cos(latRad) * Math.sin(lonRad);
  const ze = Math.sin(latRad);

  // Rotate ecliptic Y/Z by obliquity to get equatorial
  const xeq = xe;
  const yeq = ye * Math.cos(OBLIQUITY) - ze * Math.sin(OBLIQUITY);
  const zeq = ye * Math.sin(OBLIQUITY) + ze * Math.cos(OBLIQUITY);

  // Equatorial (RA/Dec system) → ECI Y-up
  // xeq = cos(dec)*cos(ra), yeq = cos(dec)*sin(ra), zeq = sin(dec)
  return new THREE.Vector3(xeq, zeq, -yeq);
}

export class CelestialSphere {
  private starPoints: THREE.Points;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;

  private static readonly STAR_RADIUS = 5000;
  private static readonly SUN_DISTANCE = 3000;
  private static readonly MOON_DISTANCE = 384.4; // 384,400 km in sim units

  constructor(scene: THREE.Scene, sunLight: THREE.DirectionalLight) {
    this.sunLight = sunLight;

    // --- Stars ---
    const count = STAR_CATALOG.length;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const [ra, dec, mag] = STAR_CATALOG[i];
      const dir = raDecToECI(ra, dec);
      positions[i * 3] = dir.x * CelestialSphere.STAR_RADIUS;
      positions[i * 3 + 1] = dir.y * CelestialSphere.STAR_RADIUS;
      positions[i * 3 + 2] = dir.z * CelestialSphere.STAR_RADIUS;
      // Size inversely proportional to magnitude: brighter = bigger
      sizes[i] = Math.max(1.0, 4.0 - mag * 0.8);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.5,
      sizeAttenuation: false,
    });

    this.starPoints = new THREE.Points(starGeo, starMat);
    scene.add(this.starPoints);

    // --- Sun ---
    const sunGeo = new THREE.SphereGeometry(40, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(this.sunMesh);

    // --- Moon ---
    const moonGeo = new THREE.SphereGeometry(1.737, 16, 16); // Moon radius ~1737km = 1.737 units
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    scene.add(this.moonMesh);
  }

  /**
   * Update sun and moon positions based on simulation time.
   * @param simTime Seconds since simulation start
   * @param epochJ2000Days Days since J2000 at simulation start (default 0 = J2000 epoch)
   */
  update(simTime: number, epochJ2000Days: number = 0) {
    const daysSinceJ2000 = epochJ2000Days + simTime / 86400;

    // --- Sun position (simplified) ---
    const sunPos = this.computeSunPosition(daysSinceJ2000);
    this.sunMesh.position.copy(sunPos.clone().multiplyScalar(CelestialSphere.SUN_DISTANCE));
    this.sunLight.position.copy(sunPos.clone().multiplyScalar(100));

    // --- Moon position (simplified) ---
    const moonPos = this.computeMoonPosition(daysSinceJ2000);
    this.moonMesh.position.copy(moonPos.clone().multiplyScalar(CelestialSphere.MOON_DISTANCE));
  }

  private computeSunPosition(d: number): THREE.Vector3 {
    // Mean longitude (degrees)
    const L = (280.460 + 0.9856474 * d) % 360;
    // Mean anomaly (degrees)
    const g = ((357.528 + 0.9856003 * d) % 360) * DEG_TO_RAD;
    // Ecliptic longitude
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG_TO_RAD;

    return eclipticToECI(lambda, 0);
  }

  private computeMoonPosition(d: number): THREE.Vector3 {
    // Simplified lunar position
    // Mean longitude (degrees)
    const L = (218.316 + 13.176396 * d) % 360;
    // Mean anomaly (degrees)
    const M = ((134.963 + 13.064993 * d) % 360) * DEG_TO_RAD;
    // Mean distance (degrees)
    const F = ((93.272 + 13.229350 * d) % 360) * DEG_TO_RAD;

    // Ecliptic longitude
    const lambda = (L + 6.289 * Math.sin(M)) * DEG_TO_RAD;
    // Ecliptic latitude
    const beta = 5.128 * Math.sin(F) * DEG_TO_RAD;

    return eclipticToECI(lambda, beta);
  }
}
