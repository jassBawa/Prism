"use client";
import { useEffect, useState } from "react";
import type { Live } from "@/lib/types";
import type { BasketView } from "@/lib/program";
import { pct, timeAgo } from "@/lib/format";
import { Info } from "@/components/ui/Info";
import { IconRefresh } from "@/components/ui/icons";

/** A `now` (ms) that ticks every second. Starts at 0 (not Date.now()) so the server and the
 *  first client render match — avoids a hydration mismatch on the time-based labels. */
function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** "ready now" / "in 42s" / "in 5m" until the interval gate next allows a rebalance. */
function nextEligibleLabel(lastRebalanceTs: number, intervalSecs: number, nowMs: number): string {
  if (lastRebalanceTs <= 0) return "ready now";
  const remaining = lastRebalanceTs + intervalSecs - Math.floor(nowMs / 1000);
  if (remaining <= 0) return "ready now";
  return remaining < 60 ? `in ${remaining}s` : `in ${Math.ceil(remaining / 60)}m`;
}

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
  const now = useNow();

  return (
    <div className="ops-card">
      <div className="ops-head">
        <span className="ops-title">
          <IconRefresh width={14} height={14} /> Auto-rebalance
        </span>
        <Info k="rebalance" align="right" />
      </div>

      <div className="ops-stat">
        <span className="ops-k">Status</span>
        <span className="ops-v" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="dot" style={{ background: b.paused ? "var(--bad, #e5484d)" : "var(--ok, #46a758)" }} />
          {b.paused ? "Paused" : drifting ? "Rebalancing soon" : "On target · auto"}
        </span>
      </div>

      <div className="ops-stat">
        <span className="ops-k">Drift / threshold</span>
        <span className="ops-v">
          {(live.maxDriftBps / 100).toFixed(2)}% / {pct(b.thresholdBps)}
        </span>
      </div>

      <div className="ops-stat">
        <span className="ops-k">Last rebalanced</span>
        <span className="ops-v">
          {now === 0 ? "—" : b.lastRebalanceTs > 0 ? timeAgo(b.lastRebalanceTs * 1000) : "never"}
        </span>
      </div>

      <div className="ops-stat">
        <span className="ops-k">Next eligible</span>
        <span className="ops-v">{now === 0 ? "—" : nextEligibleLabel(b.lastRebalanceTs, b.intervalSecs, now)}</span>
      </div>

      <p className="ops-note">
        This fund rebalances itself — a keeper watches the drift and swaps it back to target on Raydium.
        You don&apos;t need to do anything.
      </p>

      {/* Demoted, permissionless trigger: arbitrageurs / power users (and live demos) can fire it
          themselves and earn the spread — the keeper just usually gets there first. */}
      {drifting && (
        <button
          className="btn ops-manual"
          disabled={busy}
          onClick={() => onRebalance(b)}
          title="Trigger the rebalance yourself (2 txs: post Pyth prices, then swap) and earn the spread"
        >
          {busy ? (
            <>
              <span className="spinner" /> Rebalancing…
            </>
          ) : (
            "Rebalance now ›"
          )}
        </button>
      )}

      {drifting && (
        <div className="ops-subnote">Permissionless — anyone can trigger it and earn the spread.</div>
      )}

      {owner && (
        <button className="btn ops-pause" disabled={busy} onClick={() => onTogglePause(b, !b.paused)}>
          {b.paused ? "Resume fund" : "Pause fund"}
        </button>
      )}
    </div>
  );
}
