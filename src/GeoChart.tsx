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
  const [positions, setPositions] = useState<PlanetPosition[]>([]);
  const displayLonsRef = useRef<number[]>([]);
  const [displayLons, setDisplayLons] = useState<number[]>([]);
  const displayCuspsRef = useRef<number[]>([]);
  const [displayCusps, setDisplayCusps] = useState<number[]>([]);
  const displayAscRef = useRef(0);
  const displayMcRef = useRef(0);
  const [displayAsc, setDisplayAsc] = useState(0);
  const [displayMc, setDisplayMc] = useState(0);
  const animRef = useRef<number>(0);
  const dateInputRef = useRef<HTMLInputElement>(null);
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
    const targetAsc = houses.ascendant;
    const targetMc = houses.mc;

    if (!initializedRef.current) {
      displayLonsRef.current = [...targetLons];
      setDisplayLons([...targetLons]);
      displayCuspsRef.current = [...targetCusps];
      setDisplayCusps([...targetCusps]);
      displayAscRef.current = targetAsc;
      displayMcRef.current = targetMc;
      setDisplayAsc(targetAsc);
      setDisplayMc(targetMc);
      initializedRef.current = true;
      return;
    }

    const startLons = [...displayLonsRef.current];
    const diffLons = startLons.map((s, i) => angleDiff(s, targetLons[i]));
    const startCusps = [...displayCuspsRef.current];
    const diffCusps = startCusps.map((s, i) => angleDiff(s, targetCusps[i]));
    const startAsc = displayAscRef.current;
    const diffAsc = angleDiff(startAsc, targetAsc);
    const startMc = displayMcRef.current;
    const diffMc = angleDiff(startMc, targetMc);

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

      const curAsc = norm(startAsc + diffAsc * ease);
      const curMc = norm(startMc + diffMc * ease);
      displayAscRef.current = curAsc;
      displayMcRef.current = curMc;
      setDisplayAsc(curAsc);
      setDisplayMc(curMc);

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
      if (e.key === 'ArrowLeft') changeDay(-1);
      else if (e.key === 'ArrowRight') changeDay(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changeDay]);

  const handleDateDblClick = () => dateInputRef.current?.showPicker();

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setDate(prev => {
        const next = new Date(prev);
        next.setFullYear(y, m - 1, d);
        return next;
      });
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const formatInputDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
            <div className="date-display" onDoubleClick={handleDateDblClick}>
              {formatDate(date)}
              <input
                ref={dateInputRef}
                type="date"
                className="hidden-date-input"
                value={formatInputDate(date)}
                onChange={handleDateChange}
              />
            </div>
            <button className="arrow-btn" onClick={() => changeDay(1)}>&#9654;</button>
          </div>
          <div className="time-controls">
            <button className="arrow-btn arrow-btn-sm" onClick={() => changeHour(-1)}>&#9664;</button>
            <div className="time-display">{formatTime(date)}</div>
            <button className="arrow-btn arrow-btn-sm" onClick={() => changeHour(1)}>&#9654;</button>
          </div>
        </div>
        <div className="top-bar-right">
          <span className="moon-phase">{moonPhase.emoji} {moonPhase.name} ({Math.round(moonPhase.illumination)}%)</span>
          <select
            className="zodiac-select"
            value={zodiacSystem}
            onChange={e => setZodiacSystem(e.target.value as ZodiacSystem)}
          >
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
            const startAngle = (i * 30 - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
            const color = zodiacColors[i];
            const x1o = cx + outerR * Math.cos(startAngle);
            const y1o = cy + outerR * Math.sin(startAngle);
            const x2o = cx + outerR * Math.cos(endAngle);
            const y2o = cy + outerR * Math.sin(endAngle);
            const midAngle = ((i * 30 + 15) - 90) * (Math.PI / 180);
            const symbolR = outerR - zodiacBandWidth / 2;
            const lx = cx + symbolR * Math.cos(midAngle);
            const ly = cy + symbolR * Math.sin(midAngle);

            return (
              <g key={sign.name}>
                <path
                  d={`M ${cx} ${cy} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} Z`}
                  fill={color} fillOpacity={0.06}
                  stroke={color} strokeOpacity={0.15} strokeWidth={0.5}
                />
                <path
                  d={`M ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} L ${cx + zodiacInner * Math.cos(endAngle)} ${cy + zodiacInner * Math.sin(endAngle)} A ${zodiacInner} ${zodiacInner} 0 0 0 ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)}`}
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
          {(displayCusps.length ? displayCusps : houses.cusps).map((cusp, i) => {
            const angle = (cusp - 90) * (Math.PI / 180);
            const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
            const innerEnd = earthR + 4;
            const labelR = earthR + 14;
            return (
              <g key={`house-${i}`}>
                <line
                  x1={cx + innerEnd * Math.cos(angle)}
                  y1={cy + innerEnd * Math.sin(angle)}
                  x2={cx + zodiacInner * Math.cos(angle)}
                  y2={cy + zodiacInner * Math.sin(angle)}
                  stroke={isAxis ? '#ff8844' : '#8888aa'}
                  strokeOpacity={isAxis ? 0.5 : 0.2}
                  strokeWidth={isAxis ? 1.2 : 0.5}
                  strokeDasharray={isAxis ? 'none' : '3 4'}
                />
                <text
                  x={cx + labelR * Math.cos(angle)}
                  y={cy + labelR * Math.sin(angle)}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isAxis ? '#ff8844' : '#8888aa'}
                  fontSize={7} fontWeight={isAxis ? '700' : '400'}
                  opacity={isAxis ? 0.8 : 0.5}
                >
                  {HOUSE_LABELS[i]}
                </text>
              </g>
            );
          })}

          {/* ASC / MC labels on the edge */}
          {[
            { label: 'ASC', lon: displayAsc || houses.ascendant },
            { label: 'MC', lon: displayMc || houses.mc },
            { label: 'DSC', lon: ((displayAsc || houses.ascendant) + 180) % 360 },
            { label: 'IC', lon: ((displayMc || houses.mc) + 180) % 360 },
          ].map(({ label, lon }) => {
            const angle = (lon - 90) * (Math.PI / 180);
            const r = zodiacInner - 10;
            return (
              <text key={label}
                x={cx + r * Math.cos(angle)}
                y={cy + r * Math.sin(angle)}
                textAnchor="middle" dominantBaseline="central"
                fill="#ff8844" fontSize={8} fontWeight="700" opacity={0.7}
              >
                {label}
              </text>
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
            const angle = (lon - 90) * (Math.PI / 180);
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
{(() => {
  const { deg: aDeg, min: aMin, sign: aSign } = formatAstroPos(displayAsc || houses.ascendant);
  const { deg: mDeg, min: mMin, sign: mSign } = formatAstroPos(displayMc || houses.mc);
  return `ASC       ${aDeg}°${String(aMin).padStart(2,'0')}'`.padStart(7) + ` ${aSign.symbol} ${aSign.name}\n` +
         `MC        ${mDeg}°${String(mMin).padStart(2,'0')}'`.padStart(7) + ` ${mSign.symbol} ${mSign.name}\n`;
})()}</pre>
      </div>
    </div>
  );
}
