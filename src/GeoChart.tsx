import { useRef, useEffect, useState, useCallback } from 'react';
import { calculatePositions, zodiacSigns, planetNames, type PlanetPosition } from './ephemeris';

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

// Zodiac sign colors (element-based)
const zodiacColors: string[] = [
  '#e74c3c', // Aries - Fire
  '#27ae60', // Taurus - Earth
  '#f1c40f', // Gemini - Air
  '#3498db', // Cancer - Water
  '#e74c3c', // Leo - Fire
  '#27ae60', // Virgo - Earth
  '#f1c40f', // Libra - Air
  '#3498db', // Scorpio - Water
  '#e74c3c', // Sagittarius - Fire
  '#27ae60', // Capricorn - Earth
  '#f1c40f', // Aquarius - Air
  '#3498db', // Pisces - Water
];

// Shortest angular path
function angleDiff(from: number, to: number): number {
  return ((to - from) % 360 + 540) % 360 - 180;
}

export default function GeoChart() {
  const [date, setDate] = useState(() => new Date());
  const [positions, setPositions] = useState<PlanetPosition[]>([]);
  // Store current display longitudes for smooth animation from current visual position
  const displayLonsRef = useRef<number[]>([]);
  const [displayLons, setDisplayLons] = useState<number[]>([]);
  const animRef = useRef<number>(0);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Calculate positions when date changes
  useEffect(() => {
    const newPositions = calculatePositions(date);
    setPositions(newPositions);
  }, [date]);

  // Animate transitions - always animate from CURRENT visual position
  useEffect(() => {
    if (positions.length === 0) return;

    const targetLons = positions.map(p => p.longitude);

    if (!initializedRef.current) {
      // First render - snap immediately
      displayLonsRef.current = [...targetLons];
      setDisplayLons([...targetLons]);
      initializedRef.current = true;
      return;
    }

    // Animate from current visual position (not previous target)
    const startLons = [...displayLonsRef.current];
    const diffs = startLons.map((s, i) => angleDiff(s, targetLons[i]));

    // Cancel any running animation
    cancelAnimationFrame(animRef.current);

    const startTime = performance.now();
    const duration = 500;

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

      const current = startLons.map((s, i) =>
        ((s + diffs[i] * ease) % 360 + 360) % 360
      );

      displayLonsRef.current = current;
      setDisplayLons([...current]);

      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [positions]);

  const changeDay = useCallback((delta: number) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }, []);

  // Keyboard arrows
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') changeDay(-1);
      else if (e.key === 'ArrowRight') changeDay(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changeDay]);

  const handleDateDblClick = () => {
    dateInputRef.current?.showPicker();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setDate(new Date(y, m - 1, d, 12));
    }
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatInputDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // SVG dimensions
  const size = 800;
  const cx = size / 2;
  const cy = size / 2;
  const earthR = 18;
  const planetCount = positions.length; // 10
  const outerR = cx - 8;
  const zodiacBandWidth = 44;
  const zodiacInner = outerR - zodiacBandWidth;
  // Orbits: Moon at ~middle of circle, last planet near zodiac edge, tightly packed
  const orbitEnd = zodiacInner - 12;
  const midR = (earthR + orbitEnd) / 2;
  const orbitStep = planetCount > 1 ? (orbitEnd - midR) / (planetCount - 1) : 0;
  const orbitStart = midR;
  const planetR = Math.min(9, orbitStep * 0.4);

  // Format planet position as astro notation: 15°23' ♈
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
      {/* Date controls */}
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

      <div className="main-layout">
      {/* SVG Chart */}
      <div className="chart-wrapper">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="geo-chart-svg"
        >
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

          {/* Background */}
          <circle cx={cx} cy={cy} r={outerR} fill="url(#space-bg)" />

          {/* Zodiac sectors — from center to outer */}
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
                {/* Full sector from center */}
                <path
                  d={`M ${cx} ${cy} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} Z`}
                  fill={color}
                  fillOpacity={0.06}
                  stroke={color}
                  strokeOpacity={0.15}
                  strokeWidth={0.5}
                />
                {/* Zodiac band outer ring */}
                <path
                  d={`M ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} L ${cx + zodiacInner * Math.cos(endAngle)} ${cy + zodiacInner * Math.sin(endAngle)} A ${zodiacInner} ${zodiacInner} 0 0 0 ${cx + zodiacInner * Math.cos(startAngle)} ${cy + zodiacInner * Math.sin(startAngle)}`}
                  fill={color}
                  fillOpacity={0.1}
                  stroke={color}
                  strokeOpacity={0.2}
                  strokeWidth={0.5}
                />
                {/* Divider line */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + outerR * Math.cos(startAngle)}
                  y2={cy + outerR * Math.sin(startAngle)}
                  stroke={color}
                  strokeOpacity={0.12}
                  strokeWidth={0.5}
                />
                {/* Zodiac symbol */}
                <text
                  x={lx}
                  y={ly - 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color}
                  fontSize={16}
                  fontWeight="bold"
                  opacity={0.85}
                >
                  {sign.symbol}
                </text>
                {/* Zodiac name */}
                <text
                  x={lx}
                  y={ly + 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color}
                  fontSize={7}
                  opacity={0.5}
                >
                  {sign.name}
                </text>
              </g>
            );
          })}

          {/* Inner ring border */}
          <circle cx={cx} cy={cy} r={zodiacInner} fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={0.5} />

          {/* Orbits */}
          {positions.map((_, i) => {
            const r = orbitStart + i * orbitStep;
            return (
              <circle
                key={`orbit-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.1}
                strokeWidth={0.5}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Earth at center */}
          <image
            href={EARTH_IMAGE}
            x={cx - earthR}
            y={cy - earthR}
            width={earthR * 2}
            height={earthR * 2}
            clipPath="url(#earth-clip)"
          />
          <circle
            cx={cx}
            cy={cy}
            r={earthR}
            fill="none"
            stroke="#4488ff"
            strokeWidth={1}
            opacity={0.4}
          />

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
                  <image
                    href={imgUrl}
                    x={-planetR}
                    y={-planetR}
                    width={planetR * 2}
                    height={planetR * 2}
                    clipPath={`url(#planet-clip-${i})`}
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={planetR}
                    fill="none"
                    stroke={planet.color}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  <text
                    x={0}
                    y={planetR + 10}
                    textAnchor="middle"
                    fill={planet.color}
                    fontSize={9}
                    fontWeight="600"
                  >
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
        }).join('')}</pre>
      </div>

    </div>
  );
}
