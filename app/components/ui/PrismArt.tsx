/**
 * On-brand illustration: a prism refracting one white beam into a spectrum —
 * the product metaphor (one deposit → many tokens). Pure SVG, brand colors,
 * no external assets. Decorative.
 */
export function PrismArt({ size = 132 }: { size?: number }) {
  const w = size;
  const h = Math.round(size * 0.78);
  return (
    <svg
      className="prism-art"
      width={w}
      height={h}
      viewBox="0 0 200 156"
      fill="none"
      role="img"
      aria-label="A prism splitting light into a spectrum"
    >
      {/* incoming beam */}
      <rect x="0" y="74" width="78" height="3.2" rx="1.6" fill="url(#beam)" />
      {/* the prism (triangle) */}
      <path d="M86 18 L138 120 L34 120 Z" fill="url(#glass)" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M86 18 L138 120 L34 120 Z" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.4" strokeLinejoin="round" />
      {/* refracted spectrum fan */}
      <g strokeWidth="3.2" strokeLinecap="round" opacity="0.95">
        <line x1="120" y1="92" x2="200" y2="58" stroke="#f87171" />
        <line x1="121" y1="96" x2="200" y2="76" stroke="#fbbf24" />
        <line x1="122" y1="100" x2="200" y2="94" stroke="#34d399" />
        <line x1="123" y1="104" x2="200" y2="112" stroke="#22d3ee" />
        <line x1="124" y1="108" x2="200" y2="130" stroke="#818cf8" />
      </g>
      <defs>
        <linearGradient id="beam" x1="0" y1="0" x2="78" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e7ebf3" stopOpacity="0" />
          <stop offset="1" stopColor="#e7ebf3" />
        </linearGradient>
        <linearGradient id="glass" x1="86" y1="18" x2="100" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.06" />
        </linearGradient>
      </defs>
    </svg>
  );
}
