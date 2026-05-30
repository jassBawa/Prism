"use client";
import { useRouter } from "next/navigation";
import { usePrism } from "@/components/PrismProvider";
import { useMarketPrices } from "@/lib/prices";
import { chgMap, fundChange24h, signedPct } from "@/lib/funds";
import { tickerPrice } from "@/lib/prices";
import { usd } from "@/lib/format";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { IconTrend } from "@/components/ui/icons";

/** Engaging side rail: live top movers + a trending-funds leaderboard. */
export function RightRail() {
  const p = usePrism();
  const router = useRouter();
  const prices = useMarketPrices();
  const chg = chgMap(prices);

  const movers = [...prices].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 6);

  const trending = [...p.lives]
    .map((l) => ({ live: l, chg: fundChange24h(l, chg) }))
    .sort((a, b) => b.live.navUsd - a.live.navUsd)
    .slice(0, 5);

  return (
    <aside className="rail">
      <section className="rcard">
        <div className="rcard-head">
          <span className="rcard-title">Top movers</span>
          <span className="rcard-tag">24h</span>
        </div>
        {movers.length === 0 ? (
          <div className="rcard-empty">Loading prices…</div>
        ) : (
          <div className="rlist">
            {movers.map((m) => (
              <div className="rrow" key={m.symbol}>
                <span className="rrow-id">
                  <TokenLogo symbol={m.symbol} src={m.image} size={22} />
                  <span className="rrow-sym">{m.symbol}</span>
                </span>
                <span className="rrow-price">{tickerPrice(m.price)}</span>
                <span className={"rrow-chg " + (m.change24h >= 0 ? "up" : "down")}>
                  {signedPct(m.change24h)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rcard">
        <div className="rcard-head">
          <span className="rcard-title">
            <IconTrend width={14} height={14} /> Trending funds
          </span>
        </div>
        {trending.length === 0 ? (
          <div className="rcard-empty">No funds yet.</div>
        ) : (
          <div className="rlist funds">
            {trending.map((t, i) => {
              const pk = t.live.view.pubkey.toBase58();
              const syms = t.live.view.assets.map((a) => a.symbol);
              return (
                <button className="rrow rrow-btn" key={pk} onClick={() => router.push(`/fund/${pk}`)}>
                  <span className={"rrow-rank" + (i === 0 ? " top" : "")}>{i + 1}</span>
                  <span className="rrow-fund">
                    <span className="rrow-fname">{t.live.view.name || syms.join(" / ")}</span>
                    <span className="rrow-fsub">{usd(t.live.navUsd, { compact: true })}</span>
                  </span>
                  <span className={"rrow-chg " + (t.chg >= 0 ? "up" : "down")}>{signedPct(t.chg)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}
