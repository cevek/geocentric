import { useRef, useEffect, useState, useCallback } from 'react';
import { calculatePositions, calculateMoonPhase, calculateHouses, zodiacSigns, planetNames, type PlanetPosition, type ZodiacSystem } from './ephemeris';

const base = import.meta.env.BASE_URL;

const PLANET_IMAGES: Record<string, string> = {
  sun: `${base}planets/sun.png`,
  moon: `${base}planets/moon.png`,
  mercury: `${base}planets/mercury.png`,
  venus: `${base}planets/venus.png`,
  mars: `${base}planets/mars.png`,
  jupiter: `${base}planets/jupiter.png`,
  saturn: `${base}planets/saturn.png`,
  uranus: `${base}planets/uranus.png`,
  neptune: `${base}planets/neptune.png`,
  pluto: `${base}planets/pluto.png`,
};

const EARTH_IMAGE = `${base}planets/earth.png`;

const zodiacColors: string[] = [
  '#e74c3c', '#27ae60', '#f1c40f', '#3498db',
  '#e74c3c', '#27ae60', '#f1c40f', '#3498db',
  '#e74c3c', '#27ae60', '#f1c40f', '#3498db',
];

const HOUSE_LABELS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

function angleDiff(from: number, to: number): number {
  return ((to - from) % 360 + 540) % 360 - 180;
}

// Default: Moscow
const DEFAULT_LAT = 55.7558;
const DEFAULT_LON = 37.6173;

export default function GeoChart() {
  const [date, setDate] = useState(() => new Date());
  const [zodiacSystem, setZodiacSystem] = useState<ZodiacSystem>('tropical');
  const [showHouses, setShowHouses] = useState(false);
  const [positions, setPositions] = useState<PlanetPosition[]>([]);
  const displayLonsRef = useRef<number[]>([]);
  const [displayLons, setDisplayLons] = useState<number[]>([]);
  const displayCuspsRef = useRef<number[]>([]);
  const [displayCusps, setDisplayCusps] = useState<number[]>([]);
  const animRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const moonPhase = calculateMoonPhase(date);
  const houses = calculateHouses(date, DEFAULT_LAT, DEFAULT_LON, zodiacSystem);

  useEffect(() => {
    const newPositions = calculatePositions(date, zodiacSystem);
    setPositions(newPositions);
  }, [date, zodiacSystem]);

  // Animate planets + houses together
  useEffect(() => {
    if (positions.length === 0) return;
    const targetLons = positions.map(p => p.longitude);
    const targetCusps = houses.cusps;

    if (!initializedRef.current) {
      displayLonsRef.current = [...targetLons];
      setDisplayLons([...targetLons]);
      displayCuspsRef.current = [...targetCusps];
      setDisplayCusps([...targetCusps]);
      initializedRef.current = true;
      return;
    }

    const startLons = [...displayLonsRef.current];
    const diffLons = startLons.map((s, i) => angleDiff(s, targetLons[i]));
    const startCusps = [...displayCuspsRef.current];
    const diffCusps = startCusps.map((s, i) => angleDiff(s, targetCusps[i]));

    cancelAnimationFrame(animRef.current);
    const startTime = performance.now();
    const duration = 500;
    const norm = (v: number) => ((v % 360) + 360) % 360;

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const curLons = startLons.map((s, i) => norm(s + diffLons[i] * ease));
      displayLonsRef.current = curLons;
      setDisplayLons([...curLons]);

      const curCusps = startCusps.map((s, i) => norm(s + diffCusps[i] * ease));
      displayCuspsRef.current = curCusps;
      setDisplayCusps([...curCusps]);

      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [positions, houses]);

  const changeDay = useCallback((delta: number) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }, []);

  const changeHour = useCallback((delta: number) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setHours(d.getHours() + delta);
      return d;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') changeDay(-1);
      else if (e.key === 'ArrowRight') changeDay(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changeDay]);

  const formatDateEU = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${m}.${d.getFullYear()}`;
  };

  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const [dateText, setDateText] = useState(formatDateEU(date));
  const [timeText, setTimeText] = useState(formatTime(date));

  // Keep text in sync when date changes via arrows/keyboard
  useEffect(() => {
    setDateText(formatDateEU(date));
    setTimeText(formatTime(date));
  }, [date]);

  const commitDate = (val: string) => {
    const match = val.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match.map(Number);
      const d = new Date(date);
      d.setFullYear(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) setDate(d);
    }
  };

  const commitTime = (val: string) => {
    const match = val.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const [, hh, mm] = match.map(Number);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        const d = new Date(date);
        d.setHours(hh, mm);
        setDate(d);
      }
    }
  };

  const size = 800;
  const cx = size / 2;
  const cy = size / 2;
  const earthR = 18;
  const planetCount = positions.length;
  const outerR = cx - 8;
  const zodiacBandWidth = 44;
  const zodiacInner = outerR - zodiacBandWidth;
  const orbitEnd = zodiacInner - 12;
  const midR = (earthR + orbitEnd) / 2;
  const orbitStep = planetCount > 1 ? (orbitEnd - midR) / (planetCount - 1) : 0;
  const orbitStart = midR;
  const planetR = Math.min(9, orbitStep * 0.4);

  // Convert ecliptic longitude to screen angle (radians)
  // Houses off: clockwise, Aries at top (orrery style)
  // Houses on: counter-clockwise, ASC at left (natal chart style)
  const animAsc = displayCusps.length ? displayCusps[0] : houses.ascendant;
  const toAngle = (lon: number) =>
    showHouses
      ? (-lon + animAsc + 180) * (Math.PI / 180)
      : (lon - 90) * (Math.PI / 180);

  const formatAstroPos = (lon: number) => {
    const normLon = ((lon % 360) + 360) % 360;
    const signIndex = Math.floor(normLon / 30);
    const degInSign = normLon % 30;
    const deg = Math.floor(degInSign);
    const min = Math.floor((degInSign - deg) * 60);
    const sign = zodiacSigns[signIndex];
    return { deg, min, sign };
  };

  return (
    <div className="geo-chart-container">
      {/* Top bar */}
      <div className="top-bar">
        <div className="datetime-controls">
          <div className="date-controls">
            <button className="arrow-btn" onClick={() => changeDay(-1)}>&#9664;</button>
            <input
              className="date-input"
              value={dateText}
              onChange={e => setDateText(e.target.value)}
              onBlur={e => commitDate(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitDate((e.target as HTMLInputElement).value); }}
              placeholder="dd.mm.yyyy"
            />
            <button className="arrow-btn" onClick={() => changeDay(1)}>&#9654;</button>
          </div>
          {showHouses && (
            <div className="time-controls">
              <button className="arrow-btn arrow-btn-sm" onClick={() => changeHour(-1)}>&#9664;</button>
              <input
                className="time-input"
                value={timeText}
                onChange={e => setTimeText(e.target.value)}
                onBlur={e => commitTime(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitTime((e.target as HTMLInputElement).value); }}
                placeholder="HH:mm"
              />
              <button className="arrow-btn arrow-btn-sm" onClick={() => changeHour(1)}>&#9654;</button>
            </div>
          )}
        </div>
        <div className="top-bar-right">
          <span className="moon-phase">{moonPhase.emoji} {moonPhase.name} ({Math.round(moonPhase.illumination)}%)</span>
          <label className="houses-toggle">
            <input type="checkbox" checked={showHouses} onChange={e => setShowHouses(e.target.checked)} />
            Дома
          </label>
          <select className="zodiac-select" value={zodiacSystem}
            onChange={e => setZodiacSystem(e.target.value as ZodiacSystem)}>
            <option value="tropical">Тропический</option>
            <option value="sidereal">Сидерический</option>
          </select>
        </div>
      </div>

      <div className="main-layout">
      <div className="chart-wrapper">
        <svg viewBox={`0 0 ${size} ${size}`} className="geo-chart-svg">
          <defs>
            <clipPath id="earth-clip">
              <circle cx={cx} cy={cy} r={earthR} />
            </clipPath>
            {positions.map((_, i) => (
              <clipPath key={i} id={`planet-clip-${i}`}>
                <circle cx={0} cy={0} r={planetR} />
              </clipPath>
            ))}
            <radialGradient id="space-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0d0d20" />
              <stop offset="100%" stopColor="#050510" />
            </radialGradient>
          </defs>

          <circle cx={cx} cy={cy} r={outerR} fill="url(#space-bg)" />

          {/* Zodiac sectors */}
          {zodiacSigns.map((sign, i) => {
            const startAngle = toAngle(i * 30);
            const endAngle = toAngle((i + 1) * 30);
            const color = zodiacColors[i];
            const x1o = cx + outerR * Math.cos(startAngle);
            const y1o = cy + outerR * Math.sin(startAngle);
            const x2o = cx + outerR * Math.cos(endAngle);
            const y2o = cy + outerR * Math.sin(endAngle);
            const midAngle = toAngle(i * 30 + 15);
            const symbolR = outerR - zodiacBandWidth / 2;
            const lx = cx + symbolR * Math.cos(midAngle);
            const ly = cy + symbolR * Math.sin(midAngle);

            const sweep = showHouses ? 0 : 1;
            const sweepInv = showHouses ? 1 : 0;

            return (
              <g key={sign.name}>
                <path
                  d={`M ${cx} ${cy} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 ${sweep} ${x2o} ${y2o} Z`}
                  fill={color} fillOpacity={0.06}
                  stroke={color} strokeOpacity={0.15} strokeWidth={0.5}
                />
                <path
                  d={`M ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 ${sweep} ${x2o} ${y2o} L ${cx + zodiacInner * Math.cos(endAngle)} ${cy + zodiacInner * Math.sin(endAngle)} A ${zodiacInner} ${zodiacInner} 0 0 ${sweepInv} ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)}`}
                  fill={color} fillOpacity={0.1}
                  stroke={color} strokeOpacity={0.2} strokeWidth={0.5}
                />
                <line
                  x1={cx} y1={cy}
                  x2={cx + outerR * Math.cos(startAngle)}
                  y2={cy + outerR * Math.sin(startAngle)}
                  stroke={color} strokeOpacity={0.12} strokeWidth={0.5}
                />
                <text x={lx} y={ly - 1} textAnchor="middle" dominantBaseline="central"
                  fill={color} fontSize={16} fontWeight="bold" opacity={0.85}>
                  {sign.symbol}
                </text>
                <text x={lx} y={ly + 14} textAnchor="middle" dominantBaseline="central"
                  fill={color} fontSize={7} opacity={0.5}>
                  {sign.name}
                </text>
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={zodiacInner} fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={0.5} />

          {/* House cusps */}
          {showHouses && (displayCusps.length ? displayCusps : houses.cusps).map((cusp, i) => {
            const angle = toAngle(cusp);
            const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
            const axisLabel: Record<number, string> = { 0: 'ASC', 3: 'IC', 6: 'DSC', 9: 'MC' };
            const innerEnd = earthR + 4;
            const houseNumR = earthR + 14;
            const axisLabelR = zodiacInner - 10;
            return (
              <g key={`house-${i}`}>
                <line
                  x1={cx + innerEnd * Math.cos(angle)}
                  y1={cy + innerEnd * Math.sin(angle)}
                  x2={cx + zodiacInner * Math.cos(angle)}
                  y2={cy + zodiacInner * Math.sin(angle)}
                  stroke={isAxis ? '#ff8844' : '#8888aa'}
                  strokeOpacity={isAxis ? 0.9 : 0.5}
                  strokeWidth={isAxis ? 2 : 1}
                  strokeDasharray={isAxis ? 'none' : '3 4'}
                />
                <text
                  x={cx + houseNumR * Math.cos(angle)}
                  y={cy + houseNumR * Math.sin(angle)}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isAxis ? '#ff8844' : '#8888aa'}
                  fontSize={7} fontWeight={isAxis ? '700' : '400'}
                  opacity={isAxis ? 0.8 : 0.5}
                >
                  {HOUSE_LABELS[i]}
                </text>
                {isAxis && (
                  <text
                    x={cx + axisLabelR * Math.cos(angle)}
                    y={cy + axisLabelR * Math.sin(angle)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#ff8844" fontSize={8} fontWeight="700" opacity={0.7}
                  >
                    {axisLabel[i]}
                  </text>
                )}
              </g>
            );
          })}


          {/* Orbits */}
          {positions.map((_, i) => {
            const r = orbitStart + i * orbitStep;
            return (
              <circle key={`orbit-${i}`} cx={cx} cy={cy} r={r}
                fill="none" stroke="#ffffff" strokeOpacity={0.1}
                strokeWidth={0.5} strokeDasharray="4 4"
              />
            );
          })}

          {/* Earth */}
          <image href={EARTH_IMAGE} x={cx - earthR} y={cy - earthR}
            width={earthR * 2} height={earthR * 2} clipPath="url(#earth-clip)" />
          <circle cx={cx} cy={cy} r={earthR} fill="none"
            stroke="#4488ff" strokeWidth={1} opacity={0.4} />

          {/* Planets */}
          {positions.map((planet, i) => {
            const orbitR = orbitStart + i * orbitStep;
            const lon = displayLons[i] ?? planet.longitude;
            const angle = toAngle(lon);
            const px = cx + orbitR * Math.cos(angle);
            const py = cy + orbitR * Math.sin(angle);
            const imgUrl = PLANET_IMAGES[planet.name];
            return (
              <g key={planet.name}>
                <g transform={`translate(${px}, ${py})`}>
                  <image href={imgUrl} x={-planetR} y={-planetR}
                    width={planetR * 2} height={planetR * 2}
                    clipPath={`url(#planet-clip-${i})`} />
                  <circle cx={0} cy={0} r={planetR} fill="none"
                    stroke={planet.color} strokeWidth={1} opacity={0.6} />
                  <text x={0} y={planetR + 10} textAnchor="middle"
                    fill={planet.color} fontSize={9} fontWeight="600">
                    {planetNames[planet.name]}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Positions panel */}
      <pre className="positions-panel">{positions.map((p, i) => {
          const lon = displayLons[i] ?? p.longitude;
          const { deg, min, sign } = formatAstroPos(lon);
          const name = planetNames[p.name].padEnd(9);
          const degree = `${deg}°${String(min).padStart(2, '0')}'`.padStart(7);
          return `${p.symbol} ${name} ${degree} ${sign.symbol} ${sign.name}\n`;
        }).join('')}
{showHouses ? (() => {
  const cusps = displayCusps.length ? displayCusps : houses.cusps;
  const { deg: aDeg, min: aMin, sign: aSign } = formatAstroPos(cusps[0]);
  const { deg: mDeg, min: mMin, sign: mSign } = formatAstroPos(cusps[9]);
  return `ASC       ${aDeg}°${String(aMin).padStart(2,'0')}'`.padStart(7) + ` ${aSign.symbol} ${aSign.name}\n` +
         `MC        ${mDeg}°${String(mMin).padStart(2,'0')}'`.padStart(7) + ` ${mSign.symbol} ${mSign.name}\n`;
})() : ''}</pre>
      </div>
    </div>
  );
}
