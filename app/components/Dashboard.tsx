"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { COLORS } from "@/lib/constants";
import { fetchAllBaskets, getProgram, getReadProgram, ownerAta, vaultAta, type BasketView } from "@/lib/program";
import { computeState } from "@/lib/math";
import { depositRemaining, withdrawRemaining } from "@/lib/accounts";
import { latestPricesUsd, sendWithPyth } from "@/lib/pyth";
import { CreateBasket } from "./CreateBasket";

interface Live {
  view: BasketView;
  navUsd: number;
  weightsBps: number[];
  supply: number;
}

export function Dashboard() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [lives, setLives] = useState<Live[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [depAmt, setDepAmt] = useState("100");
  const [wdAmt, setWdAmt] = useState("10");
  const [userBasket, setUserBasket] = useState(0);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const tokenBal = useCallback(
    async (acc: PublicKey): Promise<bigint> => {
      try {
        return BigInt((await connection.getTokenAccountBalance(acc)).value.amount);
      } catch {
        return 0n;
      }
    },
    [connection],
  );

  const refresh = useCallback(async () => {
    try {
      const program = getReadProgram(connection);
      const baskets = await fetchAllBaskets(program);
      const feeds = [...new Set(baskets.flatMap((b) => b.assets.map((a) => a.feedHex)))];
      const prices = feeds.length ? await latestPricesUsd(feeds) : {};
      const out: Live[] = [];
      for (const b of baskets) {
        const balances = await Promise.all(b.assets.map((a) => tokenBal(vaultAta(b.pubkey, a.mint))));
        const pricesUsd = b.assets.map((a) => prices[a.feedHex] ?? 0);
        const st = computeState(balances, pricesUsd, b.assets);
        const sup = await connection.getTokenSupply(b.basketMint).catch(() => null);
        out.push({ view: b, navUsd: st.navUsd, weightsBps: st.weightsBps, supply: sup?.value.uiAmount ?? 0 });
      }
      setLives(out);
      const selPk = selected ?? out[0]?.view.pubkey.toBase58() ?? null;
      if (selPk !== selected) setSelected(selPk);

      const cur = out.find((l) => l.view.pubkey.toBase58() === selPk);
      if (wallet && cur) setUserBasket(Number(await tokenBal(ownerAta(wallet.publicKey, cur.view.basketMint))) / 1e6);
      else setUserBasket(0);
    } catch (e) {
      console.error(e);
    }
  }, [connection, wallet, selected, tokenBal]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const sel = lives.find((l) => l.view.pubkey.toBase58() === selected) ?? null;

  const deposit = async () => {
    if (!wallet || !sel) return;
    setBusy(true);
    setLog("posting Pyth prices + depositing…");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const b = sel.view;
      const quote = b.assets[b.quoteIndex]!;
      const depositorBasket = ownerAta(me, b.basketMint);
      const depositorQuote = ownerAta(me, quote.mint);
      const amount = new BN(Math.round(Number(depAmt) * 10 ** quote.decimals));
      const feeds = b.assets.map((a) => a.feedHex);
      const sigs = await sendWithPyth(connection, wallet, feeds, async (priceFor) => [
        createAssociatedTokenAccountIdempotentInstruction(me, depositorBasket, me, b.basketMint),
        await program.methods
          .deposit(amount)
          .accountsPartial({
            basket: b.pubkey,
            basketMint: b.basketMint,
            depositor: me,
            depositorQuote,
            depositorBasket,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(depositRemaining(b.pubkey, b.assets, priceFor))
          .instruction(),
      ]);
      setLog(`✅ deposited. ${sigs[sigs.length - 1]?.slice(0, 16)}…`);
      await refresh();
    } catch (e) {
      setLog("deposit failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!wallet || !sel) return;
    setBusy(true);
    setLog("withdrawing (in-kind)…");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const b = sel.view;
      const amount = new BN(Math.round(Number(wdAmt) * 1e6));
      const ataIxs = b.assets.map((a) => createAssociatedTokenAccountIdempotentInstruction(me, ownerAta(me, a.mint), me, a.mint));
      const sig = await program.methods
        .withdraw(amount)
        .accountsPartial({
          basket: b.pubkey,
          basketMint: b.basketMint,
          user: me,
          userBasket: ownerAta(me, b.basketMint),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(withdrawRemaining(b.pubkey, me, b.assets))
        .preInstructions(ataIxs)
        .rpc();
      setLog(`✅ withdrew. ${sig.slice(0, 16)}…`);
      await refresh();
    } catch (e) {
      setLog("withdraw failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const quoteSym = sel?.view.assets[sel.view.quoteIndex]?.symbol ?? "USDC";

  return (
    <div className="wrap">
      <div className="row">
        <div>
          <div className="title">mini-symmetry</div>
          <div className="sub">on-chain index-fund protocol · compose your own basket</div>
        </div>
        <WalletMultiButton />
      </div>

      <CreateBasket baskets={lives.map((l) => l.view)} onCreated={refresh} />

      <div className="card">
        <h3>Baskets ({lives.length})</h3>
        {lives.length === 0 && <div className="muted">No baskets yet — create one above.</div>}
        <div className="bgrid">
          {lives.map((l) => {
            const b = l.view;
            const price = l.supply > 0 ? l.navUsd / l.supply : 1;
            const on = selected === b.pubkey.toBase58();
            return (
              <button key={b.pubkey.toBase58()} className={"bcard" + (on ? " on" : "")} onClick={() => setSelected(b.pubkey.toBase58())}>
                <div className="brow">
                  <b>{b.assets.map((a) => a.symbol).join(" / ")}</b>
                  <span className="muted">#{b.id}</span>
                </div>
                <div className="brow">
                  <span className="muted">NAV</span>
                  <b>${l.navUsd.toFixed(2)}</b>
                </div>
                <div className="brow">
                  <span className="muted">price</span>
                  <span>${price.toFixed(4)}</span>
                </div>
                <div className="wbars">
                  {b.assets.map((a, i) => (
                    <div className="wbar" key={i} title={`${a.symbol} ${(l.weightsBps[i] ?? 0) / 100}% / ${a.targetWeightBps / 100}%`}>
                      <span style={{ width: `${Math.min(100, (l.weightsBps[i] ?? 0) / 100)}%`, background: COLORS[a.symbol] }} />
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <div className="card">
          <h3>
            {sel.view.assets.map((a) => a.symbol).join(" / ")} — basket #{sel.view.id} {sel.view.paused ? "⏸ paused" : ""}
          </h3>
          {sel.view.assets.map((a, i) => {
            const curW = (sel.weightsBps[i] ?? 0) / 100;
            const tgt = a.targetWeightBps / 100;
            return (
              <div className="barrow" key={a.mint.toBase58()}>
                <div className="tag" style={{ color: COLORS[a.symbol] }}>
                  {a.symbol}
                </div>
                <div className="bar" title={`current ${curW.toFixed(1)}% / target ${tgt}%`}>
                  <span style={{ width: `${Math.min(100, curW)}%`, background: COLORS[a.symbol] }} />
                </div>
                <div className="muted">
                  {curW.toFixed(1)}% <span style={{ opacity: 0.6 }}>/ {tgt}%</span>
                </div>
              </div>
            );
          })}
          <div className="muted" style={{ marginTop: 8 }}>
            NAV ${sel.navUsd.toFixed(2)} · supply {sel.supply.toFixed(3)} · your balance {userBasket.toFixed(3)} · quote {quoteSym}
          </div>

          <div className="actions" style={{ marginTop: 12 }}>
            <div className="sub-card">
              <h3>Deposit {quoteSym}</h3>
              <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" />
              <button className="act" disabled={!wallet || busy} onClick={deposit}>
                {wallet ? "Deposit" : "Connect wallet"}
              </button>
            </div>
            <div className="sub-card">
              <h3>Withdraw (in-kind)</h3>
              <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" />
              <button className="act" disabled={!wallet || busy} onClick={withdraw}>
                {wallet ? "Withdraw" : "Connect wallet"}
              </button>
            </div>
          </div>
          {log && <div className="log">{log}</div>}
        </div>
      )}
    </div>
  );
}
