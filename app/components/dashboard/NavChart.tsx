"use client";
import { useRef, useState } from "react";
import type { NavPoint } from "@/lib/history";
import { usd, timeAgo } from "@/lib/format";

interface Props {
  points: NavPoint[];
  height?: number;
}

/** Interactive NAV area chart (inline SVG, no chart dep). Hover for value + time. */
export function NavChart({ points, height = 132 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="nav-empty" style={{ height }}>
        Collecting performance data…
      </div>
    );
  }

  const W = 600;
  const padY = 10;
  const navs = points.map((p) => p.nav);
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const range = max - min || 1;
  const n = points.length;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => padY + (1 - (v - min) / range) * (height - 2 * padY);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${height} L0,${height} Z`;
  const up = navs[n - 1]! >= navs[0]!;
  const color = up ? "var(--ok, #46a758)" : "var(--bad, #e5484d)";

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHi(Math.round(ratio * (n - 1)));
  };
  const hp = hi != null ? points[hi] : null;

  return (
    <div
      className="nav-chart"
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={() => setHi(null)}
      style={{ height }}
    >
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id="navfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#navfill)" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hi != null && hp && (
          <>
            <line x1={x(hi)} y1={0} x2={x(hi)} y2={height} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hi)} cy={y(hp.nav)} r="3.4" fill={color} stroke="var(--panel)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hp && (
        <div className="nav-tip" style={{ left: `${(hi! / (n - 1)) * 100}%` }}>
          <span className="nav-tip-v">{usd(hp.nav)}</span>
          <span className="nav-tip-t">{timeAgo(hp.t)}</span>
        </div>
      )}
    </div>
  );
}
