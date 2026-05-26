"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrism } from "@/components/PrismProvider";
import { BasketDetail } from "@/components/dashboard/BasketDetail";

export function FundPage() {
  const params = useParams();
  const pubkey = String(params.pubkey);
  const p = usePrism();

  // Select this fund so the shared deposit/withdraw handlers operate on it.
  useEffect(() => {
    p.setSelected(pubkey);
    return () => p.setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const live = p.lives.find((l) => l.view.pubkey.toBase58() === pubkey) ?? null;

  return (
    <>
      <Link href="/explore" className="back-link">
        ← Back to Explore
      </Link>
      {!live ? (
        p.loading ? (
          <div className="skel" style={{ height: 320 }} />
        ) : (
          <div className="empty">
            <div className="emoji">🔍</div>
            <div className="et">Fund not found</div>
            <div className="es">It may not exist on this network.</div>
          </div>
        )
      ) : (
        <BasketDetail
          live={live}
          quoteSym={live.view.assets[live.view.quoteIndex]?.symbol ?? "USDC"}
          userBalance={p.userShares[pubkey] ?? 0}
          depAmt={p.depAmt}
          wdAmt={p.wdAmt}
          setDepAmt={p.setDepAmt}
          setWdAmt={p.setWdAmt}
          busy={p.busy}
          connected={p.connected}
          onDeposit={p.deposit}
          onWithdraw={p.withdraw}
          result={p.lastTx}
          me={p.me}
          adminBusy={p.adminBusy}
          onRebalance={p.rebalance}
          onTogglePause={p.togglePause}
        />
      )}
    </>
  );
}
