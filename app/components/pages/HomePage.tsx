"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrism } from "@/components/PrismProvider";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { BasketGrid } from "@/components/dashboard/BasketGrid";
import { CreateBasket } from "@/components/dashboard/CreateBasket";
import { RightRail } from "@/components/rail/RightRail";
import { FundEmptyState } from "@/components/dashboard/FundEmptyState";
import { IconCompass } from "@/components/ui/icons";

export function HomePage() {
  const p = usePrism();
  const router = useRouter();
  const open = (pk: string) => router.push(`/fund/${pk}`);
  const held = p.lives.filter((l) => (p.userShares[l.view.pubkey.toBase58()] ?? 0) > 0);

  return (
    <div>
      {/* Full-width header on top, with the create-fund action */}
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
        <div className="page-actions">
          <CreateBasket
            baskets={p.lives.map((l) => l.view)}
            onCreated={p.refresh}
            onToast={p.pushToast}
            variant="button"
          />
        </div>
      </div>

      {/* Main content + tokens/trending rail on the right */}
      <div className="layout">
        <div className="layout-main">
          <PortfolioOverview
            lives={p.lives}
            holdingsUsd={p.holdingsUsd}
            connected={p.connected}
            loading={p.loading}
          />

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
              <FundEmptyState
                title="Nothing held yet"
                description="Deposit into a fund — or spin up your own — and your positions land here, marked live with their drift and 24h move."
                size={88}
              >
                <Link href="/explore" className="act act-inline">
                  <IconCompass width={15} height={15} /> Explore funds
                </Link>
              </FundEmptyState>
            )}
          </section>
        </div>

        <RightRail />
      </div>
    </div>
  );
}
