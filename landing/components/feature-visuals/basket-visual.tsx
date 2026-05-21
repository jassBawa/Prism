export const BASKET_ASSETS = [
  { label: "SOL", gradient: "from-[#9945FF] to-[#14F195]" },
  { label: "JUP", gradient: "from-sky-400 to-blue-600" },
  { label: "USDC", gradient: "from-blue-500 to-blue-700" },
] as const;

export function BasketVisual() {
  return (
    <div className="feature-card flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Your Basket
        </p>
        <p className="headline-serif mt-3 text-[2rem] leading-none text-slate-900 sm:text-[2.25rem]">
          3 assets · 1 token
        </p>
        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="text-sm text-slate-500">SOL · JUP · USDC</p>
          <svg viewBox="0 0 80 32" className="h-8 w-20 shrink-0" aria-hidden="true">
            <path
              d="M0 24 L12 20 L24 22 L36 14 L48 16 L60 8 L72 10 L80 4"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="mt-8 flex gap-2.5">
          {BASKET_ASSETS.map(({ label, gradient }) => (
            <div
              key={label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-[10px] font-bold text-white shadow-sm`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 text-center text-xs text-slate-500 sm:px-7">
        Weighted devnet exposure in a single mint
      </div>
    </div>
  );
}
