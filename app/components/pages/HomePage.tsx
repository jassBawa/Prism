"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrism } from "@/components/PrismProvider";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { BasketGrid } from "@/components/dashboard/BasketGrid";
import { RightRail } from "@/components/rail/RightRail";
import { IconCompass } from "@/components/ui/icons";

export function HomePage() {
  const p = usePrism();
  const router = useRouter();
  const open = (pk: string) => router.push(`/fund/${pk}`);
  const held = p.lives.filter((l) => (p.userShares[l.view.pubkey.toBase58()] ?? 0) > 0);

  return (
    <div className="layout">
      <div className="layout-main">
      <div className="page-head">
        <div>
          <span className="page-kicker">{p.connected ? "Portfolio" : "Prism"}</span>
          <h1>{p.connected ? "Your funds, held on target" : "One deposit. A whole index, balanced for you."}</h1>
          <p>
            {p.connected
              ? "Every index fund you hold, priced live and kept at its target mix. Deposit once — the rebalancing runs without you."
              : "Send a single token, hold a diversified on-chain fund that rebalances itself to target as the market moves. Connect a wallet to deposit, or look around first."}
          </p>
        </div>
      </div>

      <PortfolioOverview lives={p.lives} holdingsUsd={p.holdingsUsd} connected={p.connected} loading={p.loading} />

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            Your funds <span className="count">{held.length}</span>
          </div>
        </div>
        {p.loading ? (
          <BasketGrid lives={[]} selected={null} loading onSelect={() => {}} />
        ) : held.length > 0 ? (
          <BasketGrid lives={held} selected={p.selected} loading={false} onSelect={open} />
        ) : (
          <div className="empty">
            <div className="et">Nothing held yet</div>
            <div className="es">
              Deposit into a fund — or spin up your own — and your positions land here, marked live with their
              drift and 24h move.
            </div>
            <div className="empty-cta">
              <Link href="/explore" className="act act-inline">
                <IconCompass width={15} height={15} /> Explore funds
              </Link>
            </div>
          </div>
        )}
      </section>
      </div>
      <RightRail />
    </div>
  );
}
