"use client";
import { useState } from "react";
import type { Live } from "@/lib/types";
import type { BasketView } from "@/lib/program";
import { pct } from "@/lib/format";
import { AssetStack } from "./AssetDot";
import { IconChevron, IconRefresh } from "@/components/ui/icons";

interface Props {
  lives: Live[];
  me?: string;
  adminBusy: string | null;
  onRebalance: (b: BasketView) => void;
  onTogglePause: (b: BasketView, paused: boolean) => void;
}

/** Keeper / admin: trigger a rebalance (permissionless) or pause/resume an owned basket. */
export function AdminPanel({ lives, me, adminBusy, onRebalance, onTogglePause }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <button className={"collapse-toggle" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        <span className="section-title" style={{ fontSize: 15 }}>
          <IconRefresh width={16} height={16} style={{ color: "var(--accent)" }} />
          Keeper / admin
        </span>
        <IconChevron className="chev" width={18} height={18} />
      </button>

      <div className="collapse-body" style={{ maxHeight: open ? 720 : 0, opacity: open ? 1 : 0, marginTop: open ? 18 : 0 }}>
        <div className="muted" style={{ marginBottom: 14 }}>
          Trigger a rebalance for any fund — swaps at oracle ± spread using your own token
          reserves (on devnet the seeded admin wallet holds them). Rebalance is permissionless;
          pause is owner-only.
        </div>

        <div className="admin-list">
          {lives.map((l) => {
            const b = l.view;
            const pk = b.pubkey.toBase58();
            const drifting = !b.paused && l.maxDriftBps > b.thresholdBps;
            const owner = !!me && b.authority.toBase58() === me;
            const busy = adminBusy === pk;
            const status = b.paused ? "paused" : drifting ? "drifting" : "balanced";
            return (
              <div className="admin-row" key={pk}>
                <div className="admin-info">
                  <span className="admin-name">
                    <AssetStack symbols={b.assets.map((a) => a.symbol)} size={18} />
                    {b.assets.map((a) => a.symbol).join(" / ")}
                    <span className="idtag">#{b.id}</span>
                  </span>
                  <span className="admin-meta">
                    drift {(l.maxDriftBps / 100).toFixed(2)}% / thr {pct(b.thresholdBps)} · {status}
                  </span>
                </div>
                <div className="admin-actions">
                  {owner && (
                    <button className="btn" disabled={busy} onClick={() => onTogglePause(b, !b.paused)}>
                      {b.paused ? "Resume" : "Pause"}
                    </button>
                  )}
                  <button
                    className="act"
                    style={{ width: "auto", marginTop: 0, padding: "9px 15px", fontSize: 13 }}
                    disabled={busy || b.paused}
                    onClick={() => onRebalance(b)}
                  >
                    {busy ? (
                      <>
                        <span className="spinner" /> Rebalancing…
                      </>
                    ) : (
                      "Rebalance now"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
