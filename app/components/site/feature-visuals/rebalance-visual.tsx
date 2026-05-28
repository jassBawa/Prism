export function RebalanceVisual() {
  return (
    <div className="feature-card flex h-full min-h-[280px] flex-col p-6 sm:p-7">
      <div className="mb-5 flex justify-center">
        <span className="rounded-full bg-slate-900 px-3.5 py-1 text-xs font-medium text-white">
          Rebalancing
        </span>
      </div>

      <div className="relative flex-1">
        <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden="true">
          <line x1="48" y1="16" x2="48" y2="156" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="48" y1="156" x2="300" y2="156" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="48" y1="16" x2="300" y2="16" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />

          <line x1="120" y1="16" x2="120" y2="156" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="220" y1="16" x2="220" y2="156" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          <text x="120" y="172" textAnchor="middle" fill="#94a3b8" fontSize="10">
            Start
          </text>
          <text x="220" y="172" textAnchor="middle" fill="#94a3b8" fontSize="10">
            End
          </text>

          <line x1="48" y1="88" x2="300" y2="88" stroke="#fb923c" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

          <path
            d="M 56 48 L 80 52 L 100 44 L 120 56 L 140 40 L 160 52 L 180 46 L 200 54 L 220 50 L 240 58 L 260 52 L 280 56 L 300 54"
            fill="none"
            stroke="#f97316"
            strokeWidth="1.75"
          />
          <path
            d="M 56 120 L 80 112 L 100 118 L 120 108 L 140 114 L 160 106 L 180 110 L 200 104 L 220 108 L 240 102 L 260 106 L 280 100 L 300 98"
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.75"
          />
          <path
            d="M 56 72 L 80 78 L 100 70 L 120 76 L 140 68 L 160 74 L 180 70 L 200 76 L 220 72 L 240 78 L 260 74 L 280 70 L 300 68"
            fill="none"
            stroke="#a855f7"
            strokeWidth="1.75"
          />
          <path
            d="M 56 136 L 80 128 L 100 132 L 120 124 L 140 130 L 160 122 L 180 126 L 200 120 L 220 124 L 240 118 L 260 122 L 280 116 L 300 114"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.75"
          />
        </svg>

        <div className="absolute left-0 top-4 flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
          {["SOL", "JUP", "USDC"].map((asset, i) => (
            <div
              key={asset}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[8px] font-bold text-white ${
                i === 0
                  ? "bg-gradient-to-br from-[#9945FF] to-[#14F195]"
                  : i === 1
                    ? "bg-sky-500"
                    : "bg-blue-600"
              }`}
            >
              {asset.slice(0, 3)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
