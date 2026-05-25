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
          <span className="page-kicker">Home</span>
          <h1>{p.connected ? "Your holdings" : "One deposit, a whole portfolio"}</h1>
          <p>
            {p.connected
              ? "The index funds you hold. Deposit one token, hold many — kept on target automatically."
              : "Deposit one token and hold a diversified index fund that rebalances itself. Connect a wallet to begin, or explore the funds."}
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
            <div className="emoji">💼</div>
            <div className="et">No holdings yet</div>
            <div className="es">
              Explore index funds to deposit into, or create your own. Anything you hold shows up here.
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
