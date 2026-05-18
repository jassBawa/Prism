"use client";
import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { COLORS, MIN_ASSETS, PRICED_MAX_ASSETS, SUPPORTED_ASSETS } from "@/lib/constants";
import { basketMintPda, basketPda, getProgram, type BasketView } from "@/lib/program";
import { createBasketRemaining } from "@/lib/accounts";

export function CreateBasket({ baskets, onCreated }: { baskets: BasketView[]; onCreated: () => void }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const available = useMemo(() => SUPPORTED_ASSETS.filter((a) => a.mint), []);
  const [sel, setSel] = useState<string[]>(["sol", "usdc"]);
  const [weights, setWeights] = useState<Record<string, string>>({ sol: "60", usdc: "40" });
  const [quote, setQuote] = useState("usdc");
  const [threshold, setThreshold] = useState("1"); // percent
  const [intervalS, setIntervalS] = useState("30");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

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
    setLog("creating basket…");
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
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .remainingAccounts(createBasketRemaining(basket, mints))
        .rpc();
      setLog(`✅ created basket #${id} (${sel.map((k) => k.toUpperCase()).join("/")})`);
      onCreated();
    } catch (e) {
      setLog("create failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Create a basket</h3>
      <div className="muted" style={{ marginBottom: 10 }}>
        Pick 2–4 supported assets, set weights (sum 100%), choose the deposit (quote) asset.
      </div>
      <div className="chips">
        {available.map((a) => (
          <button
            key={a.key}
            className={"chip" + (sel.includes(a.key) ? " on" : "")}
            onClick={() => toggle(a.key)}
            style={sel.includes(a.key) ? { borderColor: COLORS[a.symbol], color: COLORS[a.symbol] } : undefined}
          >
            {a.symbol}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {sel.map((k) => {
          const a = available.find((x) => x.key === k)!;
          return (
            <div className="barrow" key={k}>
              <div className="tag" style={{ color: COLORS[a.symbol] }}>
                {a.symbol}
              </div>
              <input className="winput" value={weights[k] ?? ""} onChange={(e) => setWeights((w) => ({ ...w, [k]: e.target.value }))} inputMode="decimal" />
              <span className="muted">%</span>
              <label className="muted radio">
                <input type="radio" name="quote" checked={quote === k} disabled={!a.quoteEligible} onChange={() => setQuote(k)} /> quote
              </label>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ marginTop: 6, color: sum === 100 ? "var(--ok)" : "var(--warn)" }}>
        weights sum: {sum}%
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        <label className="muted">
          drift threshold % <input className="winput" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </label>
        <label className="muted">
          interval s <input className="winput" value={intervalS} onChange={(e) => setIntervalS(e.target.value)} />
        </label>
      </div>
      <button className="act" disabled={!wallet || !valid || busy} onClick={create} style={{ marginTop: 10 }}>
        {!wallet ? "Connect wallet" : valid ? "Create basket" : "2–4 assets · weights = 100% · quote = a stable"}
      </button>
      {log && <div className="log">{log}</div>}
    </div>
  );
}
