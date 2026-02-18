import React from 'react';
import { ChartPoint } from '../types';

interface Props {
  points: ChartPoint[];
  previousClose: number;
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<Props> = ({
  points,
  previousClose,
  width = 200,
  height = 48,
}) => {
  if (points.length < 2) return null;

  const prices = points.map(p => p.p);
  const minP = Math.min(...prices, previousClose);
  const maxP = Math.max(...prices, previousClose);
  const range = maxP - minP || 1;
  const pad = 1;

  const xScale = (i: number) => (i / (points.length - 1)) * width;
  const yScale = (p: number) => height - pad - ((p - minP) / range) * (height - pad * 2);

  // Previous close baseline Y
  const baseY = yScale(previousClose);

  // Build separate paths per phase
  const phases: { phase: string; d: string; startIdx: number }[] = [];
  let currentPhase = points[0].phase;
  let pathStart = 0;

  for (let i = 1; i <= points.length; i++) {
    const nextPhase = i < points.length ? points[i].phase : null;
    if (nextPhase !== currentPhase || i === points.length) {
      // Build SVG path for this segment
      const segment = points.slice(pathStart, i);
      let d = `M${xScale(pathStart)},${yScale(segment[0].p)}`;
      for (let j = 1; j < segment.length; j++) {
        d += ` L${xScale(pathStart + j)},${yScale(segment[j].p)}`;
      }
      phases.push({ phase: currentPhase, d, startIdx: pathStart });

      if (nextPhase) {
        currentPhase = nextPhase;
        // Overlap: start next segment from last point of current
        pathStart = i - 1;
      }
    }
  }

  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= previousClose;
  const mainColor = isUp ? 'var(--green)' : 'var(--red)';
  const extColor = isUp ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="sparkline"
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
    </svg>
  );
};
