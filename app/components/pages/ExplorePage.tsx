"use client";
import { useRouter } from "next/navigation";
import { usePrism } from "@/components/PrismProvider";
import { HowItWorks } from "@/components/dashboard/HowItWorks";
import { BasketGrid } from "@/components/dashboard/BasketGrid";
import { CreateBasket } from "@/components/dashboard/CreateBasket";
import { RightRail } from "@/components/rail/RightRail";
import { timeAgo } from "@/lib/format";
import { IconRefresh } from "@/components/ui/icons";

export function ExplorePage() {
  const p = usePrism();
  const router = useRouter();
  const open = (pk: string) => router.push(`/fund/${pk}`);
  return (
    <div className="layout">
      <div className="layout-main">
      <div className="page-head">
        <div>
          <span className="page-kicker">Explore</span>
          <h1>Every fund, on one chain of glass</h1>
          <p>Browse on-chain index funds, see what each one holds, and deposit a single token for instant diversified exposure. No bridges, no swaps to hold.</p>
        </div>
      </div>

      <HowItWorks />

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            All funds <span className="count">{p.lives.length}</span>
          </div>
          {p.updatedAt > 0 && (
            <span className="updated">
              <IconRefresh width={13} height={13} /> Updated {timeAgo(p.updatedAt)}
            </span>
          )}
        </div>
        <BasketGrid lives={p.lives} selected={p.selected} loading={p.loading} onSelect={open} />
      </section>

      <section className="section">
        <CreateBasket
          baskets={p.lives.map((l) => l.view)}
          onCreated={p.refresh}
          onToast={p.pushToast}
        />
      </section>

      </div>
      <RightRail />
    </div>
  );
}
