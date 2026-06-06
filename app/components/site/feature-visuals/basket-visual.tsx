import { TOKEN_ICON } from "@/lib/site/tokens";

export const BASKET_ASSETS = [
  { label: "SOL", weight: 50, color: "#9945FF" },
  { label: "JUP", weight: 30, color: "#38bdf8" },
  { label: "USDC", weight: 20, color: "#2563eb" },
] as const;

export function BasketVisual() {
  return (
    <div className="feature-card flex h-full min-h-[200px] flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Your Basket</p>
        <p className="headline-serif mt-2 text-[1.75rem] leading-none text-slate-900">3 assets · 1 token</p>

        {/* spectrum allocation bar — weights as a refracted band */}
        <div className="mt-5 flex h-2.5 w-full gap-1">
          {BASKET_ASSETS.map((a) => (
            <div
              key={a.label}
              className="h-full rounded-full"
              style={{ width: `${a.weight}%`, background: a.color }}
              aria-hidden
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {BASKET_ASSETS.map((a) => (
            <div key={a.label} className="flex items-center gap-2.5 text-[0.8125rem]">
              <span className="size-2 rounded-full" style={{ background: a.color }} aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TOKEN_ICON[a.label]}
                alt={a.label}
                width={18}
                height={18}
                className="size-[18px] rounded object-contain"
                loading="lazy"
              />
              <span className="font-medium text-slate-700">{a.label}</span>
              <span className="ml-auto tabular-nums text-slate-400">{a.weight}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-center text-[11px] text-slate-500 sm:px-6">
        Weighted devnet exposure in a single mint
      </div>
    </div>
  );
}
