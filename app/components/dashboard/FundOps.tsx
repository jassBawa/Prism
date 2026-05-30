"use client";
import type { Live } from "@/lib/types";
import type { BasketView } from "@/lib/program";
import { pct } from "@/lib/format";
import { Info } from "@/components/ui/Info";
import { IconRefresh } from "@/components/ui/icons";

interface Props {
  live: Live;
  me?: string;
  adminBusy: string | null;
  onRebalance: (b: BasketView) => void;
  onTogglePause: (b: BasketView, paused: boolean) => void;
}

/** Per-fund keeper/operator actions, on the fund's own page (not the explore list). */
export function FundOps({ live, me, adminBusy, onRebalance, onTogglePause }: Props) {
  const b = live.view;
  const pk = b.pubkey.toBase58();
  const busy = adminBusy === pk;
  const owner = !!me && b.authority.toBase58() === me;
  const drifting = !b.paused && live.maxDriftBps > b.thresholdBps;

  return (
    <div className="ops-card">
      <div className="ops-head">
        <span className="ops-title">
          <IconRefresh width={14} height={14} /> Keeper actions
        </span>
        <Info k="rebalance" align="right" />
      </div>

      <div className="ops-stat">
        <span className="ops-k">Drift / threshold</span>
        <span className="ops-v">
          {(live.maxDriftBps / 100).toFixed(2)}% / {pct(b.thresholdBps)}
        </span>
      </div>

      <button
        className="act ops-rebalance"
        disabled={busy || b.paused || !drifting}
        onClick={() => onRebalance(b)}
        title={
          b.paused
            ? "Fund is paused"
            : drifting
              ? "Swap the fund back to target on Raydium"
              : "On target — nothing to rebalance"
        }
      >
        {busy ? (
          <>
            <span className="spinner" /> Rebalancing…
          </>
        ) : drifting ? (
          "Rebalance fund"
        ) : (
          "On target"
        )}
      </button>

      <p className="ops-note">
        Permissionless: anyone can trigger it. The fund swaps itself back to target on Raydium
        (oracle-bounded) — you just pay gas + approve 2 transactions (post Pyth prices, then swap).
        {owner ? " As the creator, you can also pause deposits." : ""}
      </p>

      {owner && (
        <button className="btn ops-pause" disabled={busy} onClick={() => onTogglePause(b, !b.paused)}>
          {b.paused ? "Resume fund" : "Pause fund"}
        </button>
      )}
    </div>
  );
}
