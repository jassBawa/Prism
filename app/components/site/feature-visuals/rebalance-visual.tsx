export function RebalanceVisual() {
  return (
    <div className="feature-card relative h-full min-h-[200px] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rebalance.png"
        alt="Automated rebalancing toward target weights"
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <span className="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 backdrop-blur">
        Auto-rebalance
      </span>
    </div>
  );
}
