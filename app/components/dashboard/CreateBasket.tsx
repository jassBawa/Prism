"use client";
import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assetColor, MIN_ASSETS, PRICED_MAX_ASSETS, SUPPORTED_ASSETS } from "@/lib/constants";
import { basketMintPda, basketPda, getProgram, registryPda, type BasketView } from "@/lib/program";
import { createBasketRemaining } from "@/lib/accounts";
import type { ToastKind } from "@/lib/types";
import { IconPlus, IconChevron, IconCheck } from "@/components/ui/icons";

interface Props {
  baskets: BasketView[];
  onCreated: () => void;
  onToast: (kind: ToastKind, msg: string, sub?: string) => void;
  defaultOpen?: boolean;
}

export function CreateBasket({ baskets, onCreated, onToast, defaultOpen = false }: Props) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const available = useMemo(() => SUPPORTED_ASSETS.filter((a) => a.mint), []);
  const [open, setOpen] = useState(defaultOpen);
  const [sel, setSel] = useState<string[]>(["sol", "usdc"]);
  const [weights, setWeights] = useState<Record<string, string>>({ sol: "60", usdc: "40" });
  const [quote, setQuote] = useState("usdc");
  const [threshold, setThreshold] = useState("1");
  const [intervalS, setIntervalS] = useState("30");
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) => {
    setSel((cur) => {
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= PRICED_MAX_ASSETS) return cur;
      return [...cur, k];
    });
    setWeights((w) => ({ ...w, [k]: w[k] ?? "0" }));
  };

  const sum = sel.reduce((s, k) => s + (Number(weights[k]) || 0), 0);
  const quoteOk = sel.includes(quote) && (available.find((a) => a.key === quote)?.quoteEligible ?? false);
  const valid = sel.length >= MIN_ASSETS && sel.length <= PRICED_MAX_ASSETS && sum === 100 && quoteOk;

  const create = async () => {
    if (!wallet || !valid) return;
    setBusy(true);
    onToast("info", "Creating basket…", "submitting transaction");
    try {
      const program = getProgram(wallet, connection);
      const creator = wallet.publicKey;
      const mine = baskets.filter((b) => b.authority.equals(creator)).map((b) => b.id);
      const id = mine.length ? Math.max(...mine) + 1 : 0;
      const basket = basketPda(creator, id);
      const basketMint = basketMintPda(basket);
      const mints = sel.map((k) => new PublicKey(available.find((a) => a.key === k)!.mint!));
      const quoteIndex = sel.indexOf(quote);
      const weightsBps = sel.map((k) => Math.round((Number(weights[k]) || 0) * 100));
      await program.methods
        .createBasket(new BN(id), sel.length, quoteIndex, weightsBps, Math.round(Number(threshold) * 100), new BN(Number(intervalS)))
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
        .rpc();
      onToast("ok", `Created basket #${id}`, sel.map((k) => k.toUpperCase()).join(" / "));
      onCreated();
    } catch (e) {
      onToast("err", "Create failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button className={"collapse-toggle" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        <span className="section-title" style={{ fontSize: 15 }}>
          <IconPlus width={16} height={16} style={{ color: "var(--accent)" }} />
          Create a basket
        </span>
        <IconChevron className="chev" width={18} height={18} />
      </button>

      <div
        className="collapse-body"
        style={{ maxHeight: open ? 720 : 0, opacity: open ? 1 : 0, marginTop: open ? 18 : 0 }}
      >
        <div className="muted" style={{ marginBottom: 14 }}>
          Pick 2–4 supported assets, set target weights (sum to 100%), and choose the deposit (quote) asset.
        </div>

        <div className="chips">
          {available.map((a, i) => {
            const on = sel.includes(a.key);
            return (
              <button
                key={a.key}
                className={"chip" + (on ? " on" : "")}
                onClick={() => toggle(a.key)}
                style={on ? { borderColor: assetColor(a.symbol, i), color: assetColor(a.symbol, i) } : undefined}
              >
                <span className="cdot" style={{ background: assetColor(a.symbol, i) }} />
                {a.symbol}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {sel.map((k, i) => {
            const a = available.find((x) => x.key === k)!;
            return (
              <div className="alloc-row" key={k} style={{ gridTemplateColumns: "56px 1fr auto" }}>
                <div className="tag" style={{ color: assetColor(a.symbol, i) }}>
                  {a.symbol}
                </div>
                <div className="field" style={{ maxWidth: 140 }}>
                  <input
                    className="winput"
                    style={{ width: "100%" }}
                    value={weights[k] ?? ""}
                    onChange={(e) => setWeights((w) => ({ ...w, [k]: e.target.value }))}
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

        <div className="sumline" style={{ color: sum === 100 ? "var(--ok)" : "var(--warn)" }}>
          {sum === 100 && <IconCheck width={13} height={13} />}
          weights total: {sum}%
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Drift threshold (%)</label>
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="field-label">Rebalance interval (seconds)</label>
            <input value={intervalS} onChange={(e) => setIntervalS(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <button className="act" disabled={!wallet || !valid || busy} onClick={create}>
          {busy ? (
            <>
              <span className="spinner" /> Creating…
            </>
          ) : !wallet ? (
            "Connect wallet"
          ) : valid ? (
            "Create basket"
          ) : (
            "2–4 assets · weights = 100% · quote = a stable"
          )}
        </button>
      </div>
    </div>
  );
}
