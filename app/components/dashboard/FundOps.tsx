"use client";
import { useEffect, useState } from "react";
import type { Live } from "@/lib/types";
import type { BasketView, IntentParams } from "@/lib/program";
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

/** Countdown until a pending intent's time-lock elapses. */
function intentCountdown(activateTs: number, nowMs: number): string {
  const remaining = activateTs - Math.floor(nowMs / 1000);
  if (remaining <= 0) return "ready to apply";
  if (remaining < 60) return `in ${remaining}s`;
  if (remaining < 3600) return `in ${Math.ceil(remaining / 60)}m`;
  return `in ${Math.ceil(remaining / 3600)}h`;
}

interface Props {
  live: Live;
  me?: string;
  adminBusy: string | null;
  onRebalance: (b: BasketView) => void;
  onTogglePause: (b: BasketView, paused: boolean) => void;
  onProposeIntent: (b: BasketView, p: IntentParams, delaySecs: number) => void;
  onActivateIntent: (b: BasketView) => void;
  onCancelIntent: (b: BasketView) => void;
}

const MIN_DELAY = 60;

/** Per-fund keeper/operator actions, on the fund's own page (not the explore list). */
export function FundOps({ live, me, adminBusy, onRebalance, onTogglePause, onProposeIntent, onActivateIntent, onCancelIntent }: Props) {
  const b = live.view;
  const pk = b.pubkey.toBase58();
  const busy = adminBusy === pk;
  const owner = !!me && b.authority.toBase58() === me;
  const drifting = !b.paused && live.maxDriftBps > b.thresholdBps;
  const now = useNow();
  const pi = b.pendingIntent;
  const ripe = !!pi && now > 0 && Math.floor(now / 1000) >= pi.activateTs;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<IntentParams>({
    thresholdBps: b.thresholdBps,
    thresholdRelBps: b.thresholdRelBps,
    intervalSecs: b.intervalSecs,
    spreadBps: b.spreadBps,
    depositFeeBps: b.feeBps,
  });
  const [delay, setDelay] = useState(MIN_DELAY);

  const openForm = () => {
    setForm({
      thresholdBps: b.thresholdBps,
      thresholdRelBps: b.thresholdRelBps,
      intervalSecs: b.intervalSecs,
      spreadBps: b.spreadBps,
      depositFeeBps: b.feeBps,
    });
    setDelay(MIN_DELAY);
    setShowForm(true);
  };

  // Only the params that actually differ from what's live, for a compact banner.
  const changes: [string, string, string][] = pi
    ? ([
        ["Drift threshold", pct(b.thresholdBps), pct(pi.thresholdBps)],
        ["Rel. threshold", pct(b.thresholdRelBps), pct(pi.thresholdRelBps)],
        ["Interval", `${b.intervalSecs}s`, `${pi.intervalSecs}s`],
        ["Spread", pct(b.spreadBps), pct(pi.spreadBps)],
        ["Deposit fee", pct(b.feeBps), pct(pi.depositFeeBps)],
      ] as [string, string, string][]).filter(([, cur, next]) => cur !== next)
    : [];

  const num = (k: keyof IntentParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) }));

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

      {/* Pending time-locked param change — visible to everyone. Depositors see the change coming
          and the exact diff, so they can exit before it lands. Anyone activates once the lock ends. */}
      {pi && (
        <div className="intent-banner">
          <div className="intent-head">
            <span className="intent-title">⏱ Param change pending</span>
            <span className={`intent-eta ${ripe ? "ripe" : ""}`}>{now === 0 ? "—" : intentCountdown(pi.activateTs, now)}</span>
          </div>
          <div className="intent-diff">
            {changes.length === 0 ? (
              <span className="intent-row">No effective change (params identical).</span>
            ) : (
              changes.map(([k, cur, next]) => (
                <span className="intent-row" key={k}>
                  <span className="intent-k">{k}</span>
                  <span className="intent-vals">
                    {cur} <span className="intent-arrow">→</span> <b>{next}</b>
                  </span>
                </span>
              ))
            )}
          </div>
          <p className="intent-note">
            Time-locked governance — the owner can&apos;t change fund params instantly. You can withdraw before it
            applies. After the timer, anyone can apply it.
          </p>
          <div className="intent-actions">
            <button className="btn intent-activate" disabled={busy || !ripe} onClick={() => onActivateIntent(b)} title={ripe ? "Apply the change (permissionless)" : "Time-lock has not elapsed yet"}>
              {busy ? <span className="spinner" /> : ripe ? "Apply change ›" : "Locked"}
            </button>
            {owner && (
              <button className="btn intent-cancel" disabled={busy} onClick={() => onCancelIntent(b)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {owner && (
        <button className="btn ops-pause" disabled={busy} onClick={() => onTogglePause(b, !b.paused)}>
          {b.paused ? "Resume fund" : "Pause fund"}
        </button>
      )}

      {/* Owner: propose a time-locked param change. Hidden while one is already pending (one per fund). */}
      {owner && !pi && (
        showForm ? (
          <div className="intent-form">
            <div className="intent-form-head">Propose params change</div>
            <label className="intent-field">
              <span>Drift threshold (bps)</span>
              <input type="number" min={10} value={form.thresholdBps} onChange={num("thresholdBps")} />
            </label>
            <label className="intent-field">
              <span>Rel. threshold (bps)</span>
              <input type="number" min={0} value={form.thresholdRelBps} onChange={num("thresholdRelBps")} />
            </label>
            <label className="intent-field">
              <span>Interval (secs)</span>
              <input type="number" min={1} value={form.intervalSecs} onChange={num("intervalSecs")} />
            </label>
            <label className="intent-field">
              <span>Spread (bps, ≤100)</span>
              <input type="number" min={0} max={100} value={form.spreadBps} onChange={num("spreadBps")} />
            </label>
            <label className="intent-field">
              <span>Deposit fee (bps, ≤500)</span>
              <input type="number" min={0} max={500} value={form.depositFeeBps} onChange={num("depositFeeBps")} />
            </label>
            <label className="intent-field">
              <span>Time-lock (secs, ≥60)</span>
              <input type="number" min={MIN_DELAY} value={delay} onChange={(e) => setDelay(Math.max(MIN_DELAY, Math.round(Number(e.target.value) || MIN_DELAY)))} />
            </label>
            <div className="intent-actions">
              <button className="btn intent-activate" disabled={busy} onClick={() => onProposeIntent(b, form, delay)}>
                {busy ? <span className="spinner" /> : "Propose change ›"}
              </button>
              <button className="btn intent-cancel" disabled={busy} onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            <p className="intent-note">Proposes a time-locked change. Depositors can exit during the lock; anyone applies it after.</p>
          </div>
        ) : (
          <button className="btn ops-change" disabled={busy} onClick={openForm}>
            Change params (time-locked) ›
          </button>
        )
      )}
    </div>
  );
}
