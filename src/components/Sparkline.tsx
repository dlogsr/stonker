import React from 'react';
import { ChartPoint, TimeScale } from '../types';

interface Props {
  points: ChartPoint[];
  previousClose: number;
  timeScale?: TimeScale;
  width?: number;
  height?: number;
}

function formatLabel(ts: number, timeScale: TimeScale): string {
  const d = new Date(ts * 1000);
  switch (timeScale) {
    case '1D': {
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'p' : 'a';
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}`;
    }
    case '1W': {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    }
    case '1M': {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    case '1Y': {
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    }
  }
}

function pickLabelIndices(points: ChartPoint[], timeScale: TimeScale): number[] {
  const len = points.length;
  if (len < 2) return [];

  // For 1D: show a few evenly-spaced time labels
  // For 1W: show each day boundary
  // For 1M/1Y: show evenly-spaced labels
  const indices: number[] = [0]; // always show first

  if (timeScale === '1W') {
    // Show first point of each new day
    let lastDay = new Date(points[0].t * 1000).getDay();
    for (let i = 1; i < len; i++) {
      const day = new Date(points[i].t * 1000).getDay();
      if (day !== lastDay) {
        indices.push(i);
        lastDay = day;
      }
    }
  } else if (timeScale === '1Y') {
    // Show first point of each new month
    let lastMonth = new Date(points[0].t * 1000).getMonth();
    for (let i = 1; i < len; i++) {
      const month = new Date(points[i].t * 1000).getMonth();
      if (month !== lastMonth) {
        indices.push(i);
        lastMonth = month;
      }
    }
  } else {
    // Evenly space 3-4 labels
    const count = 3;
    for (let j = 1; j <= count; j++) {
      indices.push(Math.round((j / (count + 1)) * (len - 1)));
    }
  }

  indices.push(len - 1); // always show last
  // Deduplicate and sort
  return [...new Set(indices)].sort((a, b) => a - b);
}

export const Sparkline: React.FC<Props> = ({
  points,
  previousClose,
  timeScale = '1D',
  width = 200,
  height = 48,
}) => {
  if (points.length < 2) return null;

  const labelH = 10;
  const chartH = height - labelH;
  const prices = points.map(p => p.p);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const pad = 1;

  const xScale = (i: number) => (i / (points.length - 1)) * width;
  const yScale = (p: number) => chartH - pad - ((p - minP) / range) * (chartH - pad * 2);

  // Previous close baseline Y
  const baseY = yScale(previousClose);

  // Build separate paths per phase
  const phases: { phase: string; d: string }[] = [];
  let currentPhase = points[0].phase;
  let pathStart = 0;

  for (let i = 1; i <= points.length; i++) {
    const nextPhase = i < points.length ? points[i].phase : null;
    if (nextPhase !== currentPhase || i === points.length) {
      const segment = points.slice(pathStart, i);
      let d = `M${xScale(pathStart)},${yScale(segment[0].p)}`;
      for (let j = 1; j < segment.length; j++) {
        d += ` L${xScale(pathStart + j)},${yScale(segment[j].p)}`;
      }
      phases.push({ phase: currentPhase, d });

      if (nextPhase) {
        currentPhase = nextPhase;
        pathStart = i - 1;
      }
    }
  }

  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= previousClose;
  const mainColor = isUp ? 'var(--green)' : 'var(--red)';
  const extColor = isUp ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';

  // Time labels
  const labelIndices = pickLabelIndices(points, timeScale);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="sparkline"
      style={{ overflow: 'visible' }}
    >
      {/* Previous close reference line */}
      <line
        x1={0}
        y1={baseY}
        x2={width}
        y2={baseY}
        stroke="var(--border)"
        strokeWidth={0.5}
        strokeDasharray="3,3"
      />
      {/* Chart lines */}
      {phases.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.phase === 'regular' ? mainColor : extColor}
          strokeWidth={seg.phase === 'regular' ? 1.5 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Time axis labels */}
      {labelIndices.map((idx, i) => {
        const x = xScale(idx);
        // Clamp to avoid overflow at edges
        const anchor = i === 0 ? 'start' : i === labelIndices.length - 1 ? 'end' : 'middle';
        return (
          <text
            key={idx}
            x={x}
            y={height - 1}
            textAnchor={anchor}
            fill="var(--text-muted)"
            fontSize={5}
            fontFamily="system-ui, sans-serif"
            opacity={0.7}
          >
            {formatLabel(points[idx].t, timeScale)}
          </text>
        );
      })}
    </svg>
  );
};
