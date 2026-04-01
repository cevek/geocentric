// Geocentric ephemeris using JPL Keplerian elements
// Reference: https://ssd.jpl.nasa.gov/planets/approx_pos.html

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

// Julian Day Number from Date (uses UTC)
function toJD(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + date.getUTCMinutes() / 1440;
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

// Julian centuries since J2000.0
function centuriesSinceJ2000(date: Date): number {
  return (toJD(date) - 2451545.0) / 36525.0;
}

// Solve Kepler's equation M = E - e*sin(E) by Newton's method
function solveKepler(M_deg: number, e: number): number {
  let M = normalize(M_deg) * DEG;
  let E = M;
  for (let i = 0; i < 20; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// JPL Keplerian elements for J2000.0 and rates per Julian century
// [a(AU), e, I(deg), L(deg), wbar(deg), Omega(deg)]
// [da, de, dI, dL, dwbar, dOmega] per century
interface KeplerianElements {
  a0: number; da: number;
  e0: number; de: number;
  I0: number; dI: number;
  L0: number; dL: number;
  w0: number; dw: number;
  O0: number; dO: number;
}

const elements: Record<string, KeplerianElements> = {
  mercury: {
    a0: 0.38709927, da: 0.00000037,
    e0: 0.20563593, de: 0.00001906,
    I0: 7.00497902, dI: -0.00594749,
    L0: 252.25032350, dL: 149472.67411175,
    w0: 77.45779628, dw: 0.16047689,
    O0: 48.33076593, dO: -0.12534081,
  },
  venus: {
    a0: 0.72333566, da: 0.00000390,
    e0: 0.00677672, de: -0.00004107,
    I0: 3.39467605, dI: -0.00078890,
    L0: 181.97909950, dL: 58517.81538729,
    w0: 131.60246718, dw: 0.00268329,
    O0: 76.67984255, dO: -0.27769418,
  },
  earth: {
    a0: 1.00000261, da: 0.00000562,
    e0: 0.01671123, de: -0.00004392,
    I0: -0.00001531, dI: -0.01294668,
    L0: 100.46457166, dL: 35999.37244981,
    w0: 102.93768193, dw: 0.32327364,
    O0: 0.0, dO: 0.0,
  },
  mars: {
    a0: 1.52371034, da: 0.00001847,
    e0: 0.09339410, de: 0.00007882,
    I0: 1.84969142, dI: -0.00813131,
    L0: -4.55343701, dL: 19140.30268499,
    w0: -23.94362959, dw: 0.44441088,
    O0: 49.55953891, dO: -0.29257343,
  },
  jupiter: {
    a0: 5.20288700, da: -0.00011607,
    e0: 0.04838624, de: -0.00013253,
    I0: 1.30439695, dI: -0.00183714,
    L0: 34.39644051, dL: 3034.74612775,
    w0: 14.72847983, dw: 0.21252668,
    O0: 100.47390909, dO: 0.20469106,
  },
  saturn: {
    a0: 9.53667594, da: -0.00125060,
    e0: 0.05386179, de: -0.00050991,
    I0: 2.48599187, dI: 0.00193609,
    L0: 49.95424423, dL: 1222.49362201,
    w0: 92.59887831, dw: -0.41897216,
    O0: 113.66242448, dO: -0.28867794,
  },
  uranus: {
    a0: 19.18916464, da: -0.00196176,
    e0: 0.04725744, de: -0.00004397,
    I0: 0.77263783, dI: -0.00242939,
    L0: 313.23810451, dL: 428.48202785,
    w0: 170.95427630, dw: 0.40805281,
    O0: 74.01692503, dO: 0.04240589,
  },
  neptune: {
    a0: 30.06992276, da: 0.00026291,
    e0: 0.00859048, de: 0.00005105,
    I0: 1.77004347, dI: 0.00035372,
    L0: -55.12002969, dL: 218.45945325,
    w0: 44.96476227, dw: -0.32241464,
    O0: 131.78422574, dO: -0.00508664,
  },
  pluto: {
    a0: 39.48211675, da: -0.00031596,
    e0: 0.24882730, de: 0.00005170,
    I0: 17.14001206, dI: 0.00004818,
    L0: 238.92903833, dL: 145.20780515,
    w0: 224.06891629, dw: -0.04062942,
    O0: 110.30393684, dO: -0.01183482,
  },
};

// Compute heliocentric ecliptic rectangular coordinates
function heliocentricXYZ(planet: string, T: number): [number, number, number] {
  const el = elements[planet];
  const a = el.a0 + el.da * T;
  const e = el.e0 + el.de * T;
  const I = (el.I0 + el.dI * T) * DEG;
  const L = el.L0 + el.dL * T;
  const wbar = el.w0 + el.dw * T;
  const O = (el.O0 + el.dO * T) * DEG;

  const w = (wbar - el.O0 - el.dO * T) * DEG; // argument of perihelion
  const M = normalize(L - wbar); // mean anomaly

  const E = solveKepler(M, e);

  // Heliocentric coordinates in orbital plane
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotate to ecliptic coordinates
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosO = Math.cos(O);
  const sinO = Math.sin(O);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const x = (cosW * cosO - sinW * sinO * cosI) * xp + (-sinW * cosO - cosW * sinO * cosI) * yp;
  const y = (cosW * sinO + sinW * cosO * cosI) * xp + (-sinW * sinO + cosW * cosO * cosI) * yp;
  const z = (sinW * sinI) * xp + (cosW * sinI) * yp;

  return [x, y, z];
}

// Geocentric ecliptic longitude for a planet
function geocentricLongitude(planet: string, T: number): number {
  const [xe, ye] = heliocentricXYZ('earth', T);
  const [xp, yp] = heliocentricXYZ(planet, T);

  const xg = xp - xe;
  const yg = yp - ye;

  return normalize(Math.atan2(yg, xg) * RAD);
}

// Sun's geocentric longitude
function sunGeocentricLongitude(T: number): number {
  const [xe, ye] = heliocentricXYZ('earth', T);
  // Sun is at origin, geocentric = direction from Earth to Sun = -Earth
  return normalize(Math.atan2(-ye, -xe) * RAD);
}

// Moon longitude — improved ELP2000-based simplified model
function moonLongitude(T: number): number {
  // Fundamental arguments (degrees)
  const Lp = normalize(218.3164477 + 481267.88123421 * T
    - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000);
  const D = normalize(297.8501921 + 445267.1114034 * T
    - 0.0018819 * T * T + T * T * T / 545868 - T * T * T * T / 113065000);
  const M = normalize(357.5291092 + 35999.0502909 * T
    - 0.0001536 * T * T + T * T * T / 24490000);
  const Mp = normalize(134.9633964 + 477198.8675055 * T
    + 0.0087414 * T * T + T * T * T / 69699 - T * T * T * T / 14712000);
  const F = normalize(93.2720950 + 483202.0175233 * T
    - 0.0036539 * T * T - T * T * T / 3526000 + T * T * T * T / 863310000);

  const A1 = normalize(119.75 + 131.849 * T);
  const A2 = normalize(53.09 + 479264.290 * T);

  // Sum of longitude terms (major terms from ELP2000)
  let Sl = 0;
  const lr: [number, number, number, number, number][] = [
    [0, 0, 1, 0, 6288774],
    [2, 0, -1, 0, 1274027],
    [2, 0, 0, 0, 658314],
    [0, 0, 2, 0, 213618],
    [0, 1, 0, 0, -185116],
    [0, 0, 0, 2, -114332],
    [2, 0, -2, 0, 58793],
    [2, -1, -1, 0, 57066],
    [2, 0, 1, 0, 53322],
    [2, -1, 0, 0, 45758],
    [0, 1, -1, 0, -40923],
    [1, 0, 0, 0, -34720],
    [0, 1, 1, 0, -30383],
    [2, 0, 0, -2, 15327],
    [0, 0, 1, 2, -12528],
    [0, 0, 1, -2, 10980],
    [4, 0, -1, 0, 10675],
    [0, 0, 3, 0, 10034],
    [4, 0, -2, 0, 8548],
    [2, 1, -1, 0, -7888],
    [2, 1, 0, 0, -6766],
    [1, 0, -1, 0, -5163],
    [1, 1, 0, 0, 4987],
    [2, -1, 1, 0, 4036],
    [2, 0, 2, 0, 3994],
    [4, 0, 0, 0, 3861],
    [2, 0, -3, 0, 3665],
    [0, 1, -2, 0, -2689],
    [2, 0, -1, 2, -2602],
    [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348],
    [2, -2, 0, 0, 2236],
    [0, 1, 2, 0, -2120],
    [0, 2, 0, 0, -2069],
    [2, -2, -1, 0, 2048],
    [2, 0, 1, -2, -1773],
    [2, 0, 0, 2, -1595],
    [4, -1, -1, 0, 1215],
    [0, 0, 2, 2, -1110],
    [3, 0, -1, 0, -892],
    [2, 1, 1, 0, -810],
    [4, -1, -2, 0, 759],
    [0, 2, -1, 0, -713],
    [2, 2, -1, 0, -700],
    [2, 1, -2, 0, 691],
    [2, -1, 0, -2, 596],
    [4, 0, 1, 0, 549],
    [0, 0, 4, 0, 537],
    [4, -1, 0, 0, 520],
    [1, 0, -2, 0, -487],
  ];

  // Earth eccentricity correction
  const E_val = 1 - 0.002516 * T - 0.0000074 * T * T;

  for (const [d, m, mp, f, coeff] of lr) {
    let arg = d * D + m * M + mp * Mp + f * F;
    let c = coeff;
    // Apply eccentricity correction for terms involving M
    if (Math.abs(m) === 1) c *= E_val;
    if (Math.abs(m) === 2) c *= E_val * E_val;
    Sl += c * Math.sin(arg * DEG);
  }

  // Additional corrections
  Sl += 3958 * Math.sin(A1 * DEG);
  Sl += 1962 * Math.sin((Lp - F) * DEG);
  Sl += 318 * Math.sin(A2 * DEG);

  return normalize(Lp + Sl / 1000000);
}

export interface PlanetPosition {
  name: string;
  longitude: number;
  symbol: string;
  color: string;
}

const planetMeta: Record<string, { symbol: string; color: string }> = {
  moon:    { symbol: '☽', color: '#C0C0C0' },
  mercury: { symbol: '☿', color: '#B5A642' },
  venus:   { symbol: '♀', color: '#FFD700' },
  sun:     { symbol: '☉', color: '#FFA500' },
  mars:    { symbol: '♂', color: '#FF4500' },
  jupiter: { symbol: '♃', color: '#DAA520' },
  saturn:  { symbol: '♄', color: '#F0E68C' },
  uranus:  { symbol: '♅', color: '#40E0D0' },
  neptune: { symbol: '♆', color: '#4169E1' },
  pluto:   { symbol: '♇', color: '#DDA0DD' },
};

// Order by geocentric angular speed (fastest first)
const planetOrder = [
  'moon', 'mercury', 'venus', 'sun', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
];

// Lahiri ayanamsa (precession offset for sidereal zodiac)
// Approximation: ~23°51' at J2000 + ~50.3"/year
function ayanamsa(T: number): number {
  return 23.85 + 0.01396 * T * 100; // degrees
}

export type ZodiacSystem = 'tropical' | 'sidereal';

export function calculatePositions(date: Date, system: ZodiacSystem = 'tropical'): PlanetPosition[] {
  const T = centuriesSinceJ2000(date);
  const offset = system === 'sidereal' ? ayanamsa(T) : 0;

  return planetOrder.map(name => {
    let lon: number;
    if (name === 'moon') {
      lon = moonLongitude(T);
    } else if (name === 'sun') {
      lon = sunGeocentricLongitude(T);
    } else {
      lon = geocentricLongitude(name, T);
    }

    lon = normalize(lon - offset);

    const meta = planetMeta[name];
    return {
      name,
      longitude: lon,
      symbol: meta.symbol,
      color: meta.color,
    };
  });
}

// Moon phase calculation
export interface MoonPhaseInfo {
  phase: number;      // 0-1 (0=new, 0.5=full)
  illumination: number; // 0-100%
  name: string;
  emoji: string;
}

export function calculateMoonPhase(date: Date): MoonPhaseInfo {
  const T = centuriesSinceJ2000(date);
  const sunLon = sunGeocentricLongitude(T);
  const moonLon = moonLongitude(T);

  // Phase angle: elongation of Moon from Sun
  const elongation = normalize(moonLon - sunLon);
  const phase = elongation / 360; // 0-1

  // Illumination (approximate)
  const illumination = (1 - Math.cos(elongation * DEG)) / 2 * 100;

  // Phase name
  let name: string;
  let emoji: string;
  if (phase < 0.025 || phase >= 0.975) {
    name = 'Новолуние'; emoji = '🌑';
  } else if (phase < 0.225) {
    name = 'Растущий серп'; emoji = '🌒';
  } else if (phase < 0.275) {
    name = 'Первая четверть'; emoji = '🌓';
  } else if (phase < 0.475) {
    name = 'Растущая луна'; emoji = '🌔';
  } else if (phase < 0.525) {
    name = 'Полнолуние'; emoji = '🌕';
  } else if (phase < 0.725) {
    name = 'Убывающая луна'; emoji = '🌖';
  } else if (phase < 0.775) {
    name = 'Последняя четверть'; emoji = '🌗';
  } else {
    name = 'Убывающий серп'; emoji = '🌘';
  }

  return { phase, illumination, name, emoji };
}

// Houses calculation (Placidus system)
export interface HouseCusps {
  ascendant: number;
  mc: number;
  cusps: number[];  // 12 house cusps in degrees
}

export function calculateHouses(date: Date, lat: number, lon: number, system: ZodiacSystem = 'tropical'): HouseCusps {
  const JD = toJD(date);
  const T = (JD - 2451545.0) / 36525.0;

  // Greenwich Mean Sidereal Time (in degrees)
  let GMST = 280.46061837
    + 360.98564736629 * (JD - 2451545.0)
    + 0.000387933 * T * T
    - T * T * T / 38710000;
  GMST = normalize(GMST);

  // RAMC = Local Sidereal Time
  const RAMC = normalize(GMST + lon);
  const RAMC_rad = RAMC * DEG;

  // Obliquity of the ecliptic
  const e = (23.4393 - 0.0130 * T) * DEG;
  const phi = lat * DEG;

  // MC (Midheaven): ecliptic longitude on the upper meridian
  const MC = normalize(Math.atan2(Math.sin(RAMC_rad), Math.cos(RAMC_rad) * Math.cos(e)) * RAD);

  // ASC (Ascendant): ecliptic longitude rising on eastern horizon
  const ASC = normalize(Math.atan2(
    Math.cos(RAMC_rad),
    -(Math.sin(RAMC_rad) * Math.cos(e) + Math.tan(phi) * Math.sin(e))
  ) * RAD);

  const IC = normalize(MC + 180);
  const DSC = normalize(ASC + 180);

  // Placidus cusp: iteratively find ecliptic longitude where
  // hour angle = required fraction of the semi-arc
  // sector: which quadrant between the 4 angles
  function placCusp(frac: number, sector: 'mc_asc' | 'mc_dsc' | 'ic_asc' | 'ic_dsc'): number {
    // Initial guess (equal-house-like)
    let ra: number;
    switch (sector) {
      case 'mc_asc': ra = normalize(RAMC + frac * 90); break;
      case 'mc_dsc': ra = normalize(RAMC - frac * 90); break;
      case 'ic_asc': ra = normalize(RAMC + 180 + frac * 90); break;
      case 'ic_dsc': ra = normalize(RAMC + 180 - frac * 90); break;
    }

    for (let iter = 0; iter < 50; iter++) {
      // RA → ecliptic longitude on the ecliptic
      const lonRad = Math.atan2(Math.sin(ra * DEG), Math.cos(ra * DEG) * Math.cos(e));
      // Declination of this ecliptic point
      const dec = Math.asin(Math.sin(e) * Math.sin(lonRad));

      // Diurnal semi-arc
      const td = Math.tan(phi) * Math.tan(dec);
      const dsa = Math.abs(td) >= 1 ? (td > 0 ? 180 : 0) : Math.acos(-td) * RAD;
      const nsa = 180 - dsa;

      let target: number;
      switch (sector) {
        case 'mc_asc': target = normalize(RAMC + frac * dsa); break;
        case 'mc_dsc': target = normalize(RAMC - frac * dsa); break;
        case 'ic_asc': target = normalize(RAMC + 180 + frac * nsa); break;
        case 'ic_dsc': target = normalize(RAMC + 180 - frac * nsa); break;
      }

      const diff = ((target - ra + 540) % 360) - 180;
      if (Math.abs(diff) < 0.0001) break;
      ra = normalize(ra + diff);
    }

    return normalize(Math.atan2(Math.sin(ra * DEG), Math.cos(ra * DEG) * Math.cos(e)) * RAD);
  }

  const cusps = new Array<number>(12);
  cusps[0] = ASC;
  cusps[3] = IC;
  cusps[6] = DSC;
  cusps[9] = MC;

  // Upper hemisphere: MC ↔ ASC (east) and MC ↔ DSC (west)
  cusps[10] = placCusp(1 / 3, 'mc_asc');  // H11
  cusps[11] = placCusp(2 / 3, 'mc_asc');  // H12
  cusps[8]  = placCusp(1 / 3, 'mc_dsc');  // H9
  cusps[7]  = placCusp(2 / 3, 'mc_dsc');  // H8

  // Lower hemisphere: IC ↔ DSC (west) and IC ↔ ASC (east)
  cusps[2] = placCusp(1 / 3, 'ic_dsc');   // H3
  cusps[1] = placCusp(2 / 3, 'ic_dsc');   // H2
  cusps[4] = placCusp(1 / 3, 'ic_asc');   // H5
  cusps[5] = placCusp(2 / 3, 'ic_asc');   // H6

  // Sidereal offset
  const offset = system === 'sidereal' ? ayanamsa(T) : 0;

  return {
    ascendant: normalize(ASC - offset),
    mc: normalize(MC - offset),
    cusps: cusps.map(c => normalize(c - offset)),
  };
}

export const zodiacSigns = [
  { name: 'Овен', symbol: '♈', start: 0 },
  { name: 'Телец', symbol: '♉', start: 30 },
  { name: 'Близнецы', symbol: '♊', start: 60 },
  { name: 'Рак', symbol: '♋', start: 90 },
  { name: 'Лев', symbol: '♌', start: 120 },
  { name: 'Дева', symbol: '♍', start: 150 },
  { name: 'Весы', symbol: '♎', start: 180 },
  { name: 'Скорпион', symbol: '♏', start: 210 },
  { name: 'Стрелец', symbol: '♐', start: 240 },
  { name: 'Козерог', symbol: '♑', start: 270 },
  { name: 'Водолей', symbol: '♒', start: 300 },
  { name: 'Рыбы', symbol: '♓', start: 330 },
];

export const planetNames: Record<string, string> = {
  moon: 'Луна',
  mercury: 'Меркурий',
  venus: 'Венера',
  sun: 'Солнце',
  mars: 'Марс',
  jupiter: 'Юпитер',
  saturn: 'Сатурн',
  uranus: 'Уран',
  neptune: 'Нептун',
  pluto: 'Плутон',
};
