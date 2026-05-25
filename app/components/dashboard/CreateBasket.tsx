"use client";
import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  assetColor,
  MIN_ASSETS,
  PRICED_MAX_ASSETS,
  SUPPORTED_ASSETS,
} from "@/lib/constants";
import {
  basketMintPda,
  basketPda,
  getProgram,
  ownerAta,
  registryPda,
  type BasketView,
} from "@/lib/program";
import { createBasketRemaining } from "@/lib/accounts";
import type { ToastKind } from "@/lib/types";
import { Info } from "@/components/ui/Info";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { IconPlus, IconChevron, IconCheck } from "@/components/ui/icons";

// One-tap starting points (mirror the seeded demo baskets).
const PRESETS: { label: string; sel: string[]; weights: Record<string, string>; quote: string }[] = [
  { label: "Blue-chip 50 / 30 / 20", sel: ["sol", "jup", "usdc"], weights: { sol: "50", jup: "30", usdc: "20" }, quote: "usdc" },
  { label: "SOL · USDC 60 / 40", sel: ["sol", "usdc"], weights: { sol: "60", usdc: "40" }, quote: "usdc" },
];

interface Props {
  baskets: BasketView[];
  onCreated: () => void;
  onToast: (kind: ToastKind, msg: string, sub?: string) => void;
  defaultOpen?: boolean;
}

export function CreateBasket({
  baskets,
  onCreated,
  onToast,
  defaultOpen = false,
}: Props) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const available = useMemo(() => SUPPORTED_ASSETS.filter((a) => a.mint), []);
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sel, setSel] = useState<string[]>(["sol", "usdc"]);
  const [weights, setWeights] = useState<Record<string, string>>({
    sol: "60",
    usdc: "40",
  });
  const [quote, setQuote] = useState("usdc");
  const [threshold, setThreshold] = useState("1");
  const [thresholdRel, setThresholdRel] = useState("1");
  const [spread, setSpread] = useState("0.3");
  const [fee, setFee] = useState("0.5");
  const [intervalS, setIntervalS] = useState("30");
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) => {
    setSel((cur) => {
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= PRICED_MAX_ASSETS) return cur;
      return [...cur, k];
    });
    // Default a freshly added asset to an even split of what's left of 100.
    setWeights((w) => ({ ...w, [k]: w[k] ?? "0" }));
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setSel(p.sel);
    setWeights(p.weights);
    setQuote(p.quote);
  };

  const sum = sel.reduce((s, k) => s + (Number(weights[k]) || 0), 0);

  // Scale the current weights so they sum to exactly 100 (even split if all zero).
  const normalize = () => {
    if (sel.length === 0) return;
    const cur = sel.map((k) => Number(weights[k]) || 0);
    const total = cur.reduce((s, v) => s + v, 0);
    const next: Record<string, string> = { ...weights };
    if (total === 0) {
      const each = Math.floor(100 / sel.length);
      sel.forEach((k, i) => (next[k] = String(i === 0 ? 100 - each * (sel.length - 1) : each)));
    } else {
      let acc = 0;
      sel.forEach((k, i) => {
        const v = i === sel.length - 1 ? 100 - acc : Math.round((cur[i]! / total) * 100);
        acc += v;
        next[k] = String(v);
      });
    }
    setWeights(next);
  };
  const quoteOk =
    sel.includes(quote) &&
    (available.find((a) => a.key === quote)?.quoteEligible ?? false);
  const nameOk = name.trim().length > 0 && name.trim().length <= 32 && description.length <= 200;
  const valid =
    nameOk &&
    sel.length >= MIN_ASSETS &&
    sel.length <= PRICED_MAX_ASSETS &&
    sum === 100 &&
    quoteOk;

  const create = async () => {
    if (!wallet || !valid) return;
    setBusy(true);
    onToast("info", "Creating fund…", "submitting transaction");
    try {
      const program = getProgram(wallet, connection);
      const creator = wallet.publicKey;
      const mine = baskets
        .filter((b) => b.authority.equals(creator))
        .map((b) => b.id);
      const id = mine.length ? Math.max(...mine) + 1 : 0;
      const basket = basketPda(creator, id);
      const basketMint = basketMintPda(basket);
      const mints = sel.map(
        (k) => new PublicKey(available.find((a) => a.key === k)!.mint!),
      );
      const quoteIndex = sel.indexOf(quote);
      const weightsBps = sel.map((k) =>
        Math.round((Number(weights[k]) || 0) * 100),
      );
      await program.methods
        .createBasket(
          new BN(id),
          name.trim(),
          description.trim(),
          sel.length,
          quoteIndex,
          weightsBps,
          Math.round(Number(threshold) * 100),
          Math.round(Number(thresholdRel) * 100),
          Math.round(Number(spread) * 100),
          Math.round(Number(fee) * 100),
          new BN(Number(intervalS)),
        )
        .accountsPartial({
          creator,
          basket,
          basketMint,
          registry: registryPda(),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .remainingAccounts(createBasketRemaining(basket, mints))
        // Pre-create the creator's basket-token ATA so deposit fees can route to it.
        .postInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            creator,
            ownerAta(creator, basketMint),
            creator,
            basketMint,
          ),
        ])
        .rpc();
      onToast(
        "ok",
        `Created basket #${id}`,
        sel.map((k) => k.toUpperCase()).join(" / "),
      );
      onCreated();
    } catch (e) {
      onToast("err", "Create failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button
        className={"collapse-toggle" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="section-title" style={{ fontSize: 15 }}>
          <IconPlus width={16} height={16} style={{ color: "var(--accent)" }} />
          Create a fund
        </span>
        <IconChevron className="chev" width={18} height={18} />
      </button>

      <div
        className="collapse-body"
        style={{
          maxHeight: open ? 1320 : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 18 : 0,
        }}
      >
        <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 0, marginBottom: 14 }}>
          <div>
            <label className="field-label">Fund name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="e.g. Blue-chip Index" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="What this fund holds and why (optional)"
            />
          </div>
        </div>

        <div className="muted" style={{ marginBottom: 12 }}>
          Pick 2–4 assets, set target weights (sum to 100%), and choose the
          <span style={{ whiteSpace: "nowrap" }}> deposit asset <Info k="quoteAsset" /></span>.
        </div>

        <div className="presets">
          <span className="presets-label">Start from</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="preset" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="chips">
          {available.map((a, i) => {
            const on = sel.includes(a.key);
            return (
              <button
                key={a.key}
                className={"chip" + (on ? " on" : "")}
                onClick={() => toggle(a.key)}
                style={
                  on
                    ? {
                        borderColor: assetColor(a.symbol, i),
                        color: assetColor(a.symbol, i),
                      }
                    : undefined
                }
              >
                <TokenLogo symbol={a.symbol} index={i} size={16} />
                {a.symbol}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {sel.map((k, i) => {
            const a = available.find((x) => x.key === k)!;
            return (
              <div
                className="alloc-row"
                key={k}
                style={{ gridTemplateColumns: "56px 1fr auto" }}
              >
                <div className="tag" style={{ color: assetColor(a.symbol, i) }}>
                  {a.symbol}
                </div>
                <div className="field" style={{ maxWidth: 140 }}>
                  <input
                    className="winput"
                    style={{ width: "100%" }}
                    value={weights[k] ?? ""}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [k]: e.target.value }))
                    }
                    inputMode="decimal"
                  />
                  <span className="unit">%</span>
                </div>
                <label className="radio">
                  <input
                    type="radio"
                    name="quote"
                    checked={quote === k}
                    disabled={!a.quoteEligible}
                    onChange={() => setQuote(k)}
                  />
                  quote asset
                </label>
              </div>
            );
          })}
        </div>

        <div className="sumline-row">
          <span className="sumline" style={{ color: sum === 100 ? "var(--ok)" : "var(--warn)" }}>
            {sum === 100 && <IconCheck width={13} height={13} />}
            weights total: {sum}%
          </span>
          {sum !== 100 && sel.length > 0 && (
            <button type="button" className="normalize" onClick={normalize}>
              Normalize to 100%
            </button>
          )}
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">
              Abs drift threshold (%) <Info k="driftAbs" />
            </label>
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" />
            <span className="field-hint">NAV-share drift that triggers a rebalance. ~1% typical.</span>
          </div>
          <div>
            <label className="field-label">
              Rel drift threshold (%) <Info k="driftRel" />
            </label>
            <input value={thresholdRel} onChange={(e) => setThresholdRel(e.target.value)} inputMode="decimal" />
            <span className="field-hint">Per-asset drift vs its own target. ~1% typical.</span>
          </div>
          <div>
            <label className="field-label">
              Rebalance interval (s) <Info k="interval" />
            </label>
            <input value={intervalS} onChange={(e) => setIntervalS(e.target.value)} inputMode="numeric" />
            <span className="field-hint">Min seconds between rebalances. ≥30 avoids churn.</span>
          </div>
          <div>
            <label className="field-label">
              Rebalance spread (%, ≤1) <Info k="spread" />
            </label>
            <input value={spread} onChange={(e) => setSpread(e.target.value)} inputMode="decimal" />
            <span className="field-hint">Edge paid to whoever rebalances. 0.1–0.5% typical.</span>
          </div>
          <div>
            <label className="field-label">
              Creator deposit fee (%, ≤5) <Info k="fee" />
            </label>
            <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" />
            <span className="field-hint">Your cut of each deposit, in basket tokens.</span>
          </div>
        </div>

        <button
          className="act"
          disabled={!wallet || !valid || busy}
          onClick={create}
        >
          {busy ? (
            <>
              <span className="spinner" /> Creating…
            </>
          ) : !wallet ? (
            "Connect wallet"
          ) : valid ? (
            "Create fund"
          ) : (
            "Name it · 2–4 assets · weights = 100% · deposit asset = a stablecoin"
          )}
        </button>
      </div>
    </div>
  );
}
