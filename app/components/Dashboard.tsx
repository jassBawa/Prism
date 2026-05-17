"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ASSETS, BASKET } from "@/lib/constants";
import { basketPda, getProgram, getReadProgram } from "@/lib/program";
import { computeState, type FundState } from "@/lib/math";
import { latestPricesUsd, sendWithPyth } from "@/lib/pyth";

const COLORS: Record<string, string> = { SOL: "var(--sol)", JUP: "var(--jup)", USDC: "var(--usdc)" };

export function Dashboard() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [state, setState] = useState<FundState | null>(null);
  const [supply, setSupply] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lastReb, setLastReb] = useState(0);
  const [userBasket, setUserBasket] = useState(0);
  const [depAmt, setDepAmt] = useState("10");
  const [wdAmt, setWdAmt] = useState("5");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const tokenBal = async (acc: string): Promise<bigint> => {
        try {
          return BigInt((await connection.getTokenAccountBalance(new PublicKey(acc))).value.amount);
        } catch {
          return 0n;
        }
      };
      const balances = await Promise.all(ASSETS.map((a) => tokenBal(a.vault)));
      const prices = await latestPricesUsd();
      setState(computeState(balances, [prices.sol, prices.jup, prices.usdc]));

      const sup = await connection.getTokenSupply(new PublicKey(BASKET.basketMint)).catch(() => null);
      setSupply(sup?.value.uiAmount ?? 0);

      const b = (await getReadProgram(connection).account.basket.fetch(basketPda())) as unknown as {
        paused: boolean;
        lastRebalanceTs: { toNumber(): number };
      };
      setPaused(b.paused);
      setLastReb(b.lastRebalanceTs.toNumber());

      if (wallet) {
        const ata = getAssociatedTokenAddressSync(new PublicKey(BASKET.basketMint), wallet.publicKey);
        setUserBasket(Number(await tokenBal(ata.toBase58())) / 1e6);
      } else setUserBasket(0);
    } catch (e) {
      console.error(e);
    }
  }, [connection, wallet]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const deposit = async () => {
    if (!wallet) return;
    setBusy(true);
    setLog("posting Pyth prices + depositing…");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const usdcMint = new PublicKey(BASKET.mints.usdc);
      const basketMint = new PublicKey(BASKET.basketMint);
      const depositorUsdc = getAssociatedTokenAddressSync(usdcMint, me);
      const depositorBasket = getAssociatedTokenAddressSync(basketMint, me);
      const amount = new BN(Math.round(Number(depAmt) * 1e6));

      const sigs = await sendWithPyth(connection, wallet, async (price) => [
        createAssociatedTokenAccountIdempotentInstruction(me, depositorBasket, me, basketMint),
        await program.methods
          .deposit(amount)
          .accountsPartial({
            basket: pk(BASKET.basket),
            basketMint,
            depositor: me,
            depositorUsdc,
            depositorBasket,
            vaultSol: pk(BASKET.vaults.sol),
            vaultJup: pk(BASKET.vaults.jup),
            vaultUsdc: pk(BASKET.vaults.usdc),
            priceSol: price.sol,
            priceJup: price.jup,
            priceUsdc: price.usdc,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
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
    if (!wallet) return;
    setBusy(true);
    setLog("withdrawing (in-kind)…");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const amount = new BN(Math.round(Number(wdAmt) * 1e6));
      const ataIxs = ASSETS.map((a) =>
        createAssociatedTokenAccountIdempotentInstruction(me, getAssociatedTokenAddressSync(pk(a.mint), me), me, pk(a.mint)),
      );
      const sig = await program.methods
        .withdraw(amount)
        .accountsPartial({
          basket: pk(BASKET.basket),
          basketMint: pk(BASKET.basketMint),
          user: me,
          userBasket: getAssociatedTokenAddressSync(pk(BASKET.basketMint), me),
          vaultSol: pk(BASKET.vaults.sol),
          vaultJup: pk(BASKET.vaults.jup),
          vaultUsdc: pk(BASKET.vaults.usdc),
          userSol: getAssociatedTokenAddressSync(pk(BASKET.mints.sol), me),
          userJup: getAssociatedTokenAddressSync(pk(BASKET.mints.jup), me),
          userUsdc: getAssociatedTokenAddressSync(pk(BASKET.mints.usdc), me),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
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

  const nav = state?.navUsd ?? 0;
  const price = supply > 0 ? nav / supply : 1;
  const drift = (state?.maxDriftBps ?? 0) / 100;

  return (
    <div className="wrap">
      <div className="row">
        <div>
          <div className="title">mini-symmetry</div>
          <div className="sub">on-chain index fund · SOL / JUP / USDC · {paused ? "⏸ paused" : "live"}</div>
        </div>
        <WalletMultiButton />
      </div>

      <div className="grid">
        <div className="card">
          <h3>NAV</h3>
          <div className="big">${nav.toFixed(2)}</div>
        </div>
        <div className="card">
          <h3>Basket price</h3>
          <div className="big">${price.toFixed(4)}</div>
        </div>
        <div className="card">
          <h3>Max drift</h3>
          <div className="big" style={{ color: drift > 1 ? "var(--warn)" : "var(--ok)" }}>
            {drift.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Weights — current vs target</h3>
        {ASSETS.map((a, i) => {
          const cur = (state?.weightsBps[i] ?? 0) / 100;
          const tgt = a.weightBps / 100;
          return (
            <div className="barrow" key={a.key}>
              <div className="tag" style={{ color: COLORS[a.symbol] }}>
                {a.symbol}
              </div>
              <div className="bar" title={`current ${cur.toFixed(1)}% / target ${tgt}%`}>
                <span style={{ width: `${Math.min(100, cur)}%`, background: COLORS[a.symbol] }} />
              </div>
              <div className="muted">
                {cur.toFixed(1)}% <span style={{ opacity: 0.6 }}>/ {tgt}%</span>
              </div>
            </div>
          );
        })}
        <div className="muted" style={{ marginTop: 8 }}>
          supply {supply.toFixed(3)} · your balance {userBasket.toFixed(3)} · last rebalance{" "}
          {lastReb ? new Date(lastReb * 1000).toLocaleTimeString() : "never"}
        </div>
      </div>

      <div className="actions">
        <div className="card">
          <h3>Deposit USDC</h3>
          <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" />
          <button className="act" disabled={!wallet || busy} onClick={deposit}>
            {wallet ? "Deposit" : "Connect wallet"}
          </button>
        </div>
        <div className="card">
          <h3>Withdraw (in-kind)</h3>
          <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" />
          <button className="act" disabled={!wallet || busy} onClick={withdraw}>
            {wallet ? "Withdraw" : "Connect wallet"}
          </button>
        </div>
      </div>
      <div className="log">{log}</div>
    </div>
  );
}

const pk = (s: string) => new PublicKey(s);
