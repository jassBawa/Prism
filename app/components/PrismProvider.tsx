"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { RPC_URL } from "@/lib/constants";
import { fetchAllBaskets, getProgram, getReadProgram, intentPda, ownerAta, vaultAta, type BasketView, type IntentParams } from "@/lib/program";
import { computeState } from "@/lib/math";
import { depositAssetsRemaining, depositRemaining, rebalanceOneRemaining, rebalanceRemaining, withdrawRemaining } from "@/lib/accounts";
import { latestPricesUsd, sendWithPyth } from "@/lib/pyth";
import { CPMM_PROGRAM, poolForPair } from "@/lib/zap";
import type { Live, Toast, ToastKind } from "@/lib/types";
import type { TxResult } from "./dashboard/TradePanel";

export const NETWORK =
  RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost")
    ? "Localnet"
    : RPC_URL.includes("devnet")
      ? "Devnet"
      : RPC_URL.includes("mainnet")
        ? "Mainnet"
        : "Custom RPC";

interface PrismCtx {
  lives: Live[];
  loading: boolean;
  updatedAt: number;
  connected: boolean;
  me?: string;
  refresh: () => Promise<void>;
  holdingsUsd: number;
  userShares: Record<string, number>;
  assetBalances: Record<string, number[]>;
  selected: string | null;
  setSelected: (pk: string | null) => void;
  sel: Live | null;
  quoteSym: string;
  depAmt: string;
  setDepAmt: (v: string) => void;
  wdAmt: string;
  setWdAmt: (v: string) => void;
  busy: "deposit" | "withdraw" | null;
  adminBusy: string | null;
  lastTx: TxResult | null;
  deposit: (uiUsdcAmount: number) => Promise<void>;
  depositAssets: (uiAmounts: number[]) => Promise<void>;
  withdraw: () => Promise<void>;
  rebalance: (b: BasketView) => Promise<void>;
  togglePause: (b: BasketView, paused: boolean) => Promise<void>;
  proposeIntent: (b: BasketView, p: IntentParams, delaySecs: number) => Promise<void>;
  activateIntent: (b: BasketView) => Promise<void>;
  cancelIntent: (b: BasketView) => Promise<void>;
  toasts: Toast[];
  pushToast: (kind: ToastKind, msg: string, sub?: string) => number;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<PrismCtx | null>(null);
export const usePrism = (): PrismCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrism must be used inside <PrismProvider>");
  return c;
};

export function PrismProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [lives, setLives] = useState<Live[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [depAmt, setDepAmt] = useState("100");
  const [wdAmt, setWdAmt] = useState("10");
  const [userShares, setUserShares] = useState<Record<string, number>>({});
  // per-fund wallet balances of each underlying token (uiAmount, aligned to view.assets)
  const [assetBalances, setAssetBalances] = useState<Record<string, number[]>>({});
  const [holdingsUsd, setHoldingsUsd] = useState(0);
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null);
  const [adminBusy, setAdminBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<TxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastId = useRef(0);

  const pushToast = useCallback((kind: ToastKind, msg: string, sub?: string) => {
    const id = ++toastId.current;
    setToasts((cur) => [...cur, { id, kind, msg, sub }]);
    const ttl = kind === "err" ? 9000 : 6000;
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), ttl);
    return id;
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((cur) => cur.filter((t) => t.id !== id)), []);

  // Pyth-consuming actions sign 2 txs (post on-chain prices, then the action).
  // Toast each wallet prompt so the double approval isn't a surprise.
  const stepToast = (action: string) => (step: number, total: number) => {
    if (total <= 1) return;
    pushToast("info", `Approve ${step} of ${total} in your wallet`, step < total ? "posting live Pyth prices on-chain" : action);
  };

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
        out.push({
          view: b,
          navUsd: st.navUsd,
          weightsBps: st.weightsBps,
          supply: sup?.value.uiAmount ?? 0,
          maxDriftBps: st.maxDriftBps,
          valuesUsd: st.valuesUsd,
          amounts: b.assets.map((a, i) => Number(balances[i]) / 10 ** a.decimals),
        });
      }
      setLives(out);

      if (wallet) {
        let total = 0;
        const shares: Record<string, number> = {};
        const balances: Record<string, number[]> = {};
        for (const l of out) {
          const s = Number(await tokenBal(ownerAta(wallet.publicKey, l.view.basketMint))) / 1e6;
          const unit = l.supply > 0 ? l.navUsd / l.supply : 1;
          total += s * unit;
          shares[l.view.pubkey.toBase58()] = s;
          // the user's wallet balance of every underlying token (for multi-asset deposit)
          balances[l.view.pubkey.toBase58()] = await Promise.all(
            l.view.assets.map(async (a) => Number(await tokenBal(ownerAta(wallet.publicKey, a.mint))) / 10 ** a.decimals),
          );
        }
        setHoldingsUsd(total);
        setUserShares(shares);
        setAssetBalances(balances);
      } else {
        setHoldingsUsd(0);
        setUserShares({});
        setAssetBalances({});
      }
      setUpdatedAt(Date.now());
    } catch (e) {
      // Benign on a polling loop (transient RPC hiccup). Warn, don't raise the dev
      // error overlay; the next 8s tick recovers.
      console.warn("[prism] refresh skipped:", (e as Error)?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tokenBal]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const sel = lives.find((l) => l.view.pubkey.toBase58() === selected) ?? null;
  const quoteSym = sel?.view.assets[sel.view.quoteIndex]?.symbol ?? "USDC";

  // Single-asset (quote/USDC) deposit: mint fund tokens at live NAV; the USDC
  // stays in the vault and the keeper rebalances it into target weights.
  const deposit = async (uiUsdcAmount: number) => {
    if (!wallet || !sel || uiUsdcAmount <= 0) return;
    setBusy("deposit");
    pushToast("info", "Posting prices & depositing…", "approve in your wallet");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const b = sel.view;
      const quote = b.assets[b.quoteIndex]!;
      const depositorBasket = ownerAta(me, b.basketMint);
      const depositorQuote = ownerAta(me, quote.mint);
      const creatorBasket = ownerAta(b.authority, b.basketMint);
      const amount = new BN(Math.round(uiUsdcAmount * 10 ** quote.decimals));
      const feeds = b.assets.map((a) => a.feedHex);
      const sigs = await sendWithPyth(connection, wallet, feeds, async (priceFor) => [
        createAssociatedTokenAccountIdempotentInstruction(me, depositorBasket, me, b.basketMint),
        createAssociatedTokenAccountIdempotentInstruction(me, creatorBasket, b.authority, b.basketMint),
        await program.methods
          .deposit(amount)
          .accountsPartial({
            basket: b.pubkey,
            basketMint: b.basketMint,
            depositor: me,
            depositorQuote,
            depositorBasket,
            creatorBasket,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(depositRemaining(b.pubkey, b.assets, priceFor))
          .instruction(),
      ], stepToast("minting your fund tokens"));
      const sig = sigs[sigs.length - 1];
      if (sig) setLastTx({ action: "deposit", sig });
      pushToast("ok", `Deposited ${uiUsdcAmount} ${quoteSym}`, sig?.slice(0, 24) + "…");
      await refresh();
    } catch (e) {
      pushToast("err", "Deposit failed", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Multi-asset (in-kind) deposit. `uiAmounts` is aligned to sel.view.assets.
  const depositAssets = async (uiAmounts: number[]) => {
    if (!wallet || !sel) return;
    const b = sel.view;
    const amounts = b.assets.map((a, i) => new BN(Math.round((uiAmounts[i] || 0) * 10 ** a.decimals)));
    if (amounts.every((a) => a.isZero())) return;
    setBusy("deposit");
    pushToast("info", "Posting prices & depositing…", "approve in your wallet");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const depositorBasket = ownerAta(me, b.basketMint);
      const creatorBasket = ownerAta(b.authority, b.basketMint);
      const feeds = b.assets.map((a) => a.feedHex);
      const sigs = await sendWithPyth(connection, wallet, feeds, async (priceFor) => [
        createAssociatedTokenAccountIdempotentInstruction(me, depositorBasket, me, b.basketMint),
        createAssociatedTokenAccountIdempotentInstruction(me, creatorBasket, b.authority, b.basketMint),
        await program.methods
          .depositAssets(amounts)
          .accountsPartial({
            basket: b.pubkey,
            basketMint: b.basketMint,
            depositor: me,
            depositorBasket,
            creatorBasket,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(depositAssetsRemaining(b.pubkey, me, b.assets, priceFor))
          .instruction(),
      ], stepToast("depositing into the fund"));
      const sig = sigs[sigs.length - 1];
      if (sig) setLastTx({ action: "deposit", sig });
      const parts = b.assets
        .map((a, i) => (uiAmounts[i] > 0 ? `${uiAmounts[i]} ${a.symbol}` : null))
        .filter(Boolean)
        .join(" + ");
      pushToast("ok", `Deposited ${parts}`, sig?.slice(0, 24) + "…");
      await refresh();
    } catch (e) {
      pushToast("err", "Deposit failed", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!wallet || !sel) return;
    setBusy("withdraw");
    pushToast("info", "Withdrawing…", "you get your share of each asset — approve in your wallet");
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
      setLastTx({ action: "withdraw", sig });
      pushToast("ok", `Withdrew ${wdAmt} tokens`, sig.slice(0, 24) + "…");
      await refresh();
    } catch (e) {
      pushToast("err", "Withdraw failed", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rebalance = async (b: BasketView) => {
    if (!wallet) return;
    const me = wallet.publicKey;
    const live = lives.find((l) => l.view.pubkey.equals(b.pubkey));
    const quote = b.assets[b.quoteIndex]!;
    // Real path: every non-quote asset has a Raydium pool with the quote → swap on the AMM.
    const nonQuote = b.assets.map((a, i) => ({ a, i })).filter((x) => x.i !== b.quoteIndex);
    const realPools = nonQuote.map((x) => poolForPair(quote.mint.toBase58(), x.a.mint.toBase58()));
    const useReal = !!live && realPools.every(Boolean);

    setAdminBusy(b.pubkey.toBase58());
    try {
      const program = getProgram(wallet, connection);
      if (useReal) {
        let did = 0;
        for (let k = 0; k < nonQuote.length; k++) {
          const { a, i } = nonQuote[k]!;
          const pool = realPools[k]!;
          const vi = live!.valuesUsd[i] ?? 0;
          const vq = live!.valuesUsd[b.quoteIndex] ?? 0;
          if (vq <= 0) continue;
          const lhs = vi * quote.targetWeightBps;
          const rhs = a.targetWeightBps * vq;
          const denom = Math.max(lhs, rhs);
          const driftBps = denom > 0 ? (Math.abs(lhs - rhs) / denom) * 10000 : 0;
          if (driftBps < b.thresholdBps) continue; // this asset is on target
          const buy = rhs > lhs; // asset under-weight vs quote → buy it
          pushToast("info", `Rebalancing ${a.symbol} on Raydium…`, "approve 2 transactions");
          await sendWithPyth(
            connection,
            wallet,
            [a.feedHex, quote.feedHex],
            async (priceFor) => [
              await program.methods
                .rebalanceOne(i)
                .accountsPartial({ basket: b.pubkey, keeper: me })
                .remainingAccounts(rebalanceOneRemaining(b.pubkey, a, quote, pool, buy, priceFor, new PublicKey(CPMM_PROGRAM)))
                .instruction(),
            ],
            stepToast(`swapping ${a.symbol} on Raydium`),
          );
          did++;
        }
        pushToast(did > 0 ? "ok" : "info", did > 0 ? "Rebalanced on Raydium" : "Already on target", "");
      } else {
        const feeds = b.assets.map((a) => a.feedHex);
        const sigs = await sendWithPyth(connection, wallet, feeds, async (priceFor) => [
          await program.methods
            .rebalance()
            .accountsPartial({ basket: b.pubkey, keeper: me, tokenProgram: TOKEN_PROGRAM_ID })
            .remainingAccounts(rebalanceRemaining(b.pubkey, me, b.assets, priceFor))
            .instruction(),
        ], stepToast("rebalancing the fund"));
        pushToast("ok", "Rebalanced", sigs[sigs.length - 1]?.slice(0, 24) + "…");
      }
      await refresh();
    } catch (e) {
      pushToast("err", "Rebalance failed", (e as Error).message);
    } finally {
      setAdminBusy(null);
    }
  };

  const togglePause = async (b: BasketView, paused: boolean) => {
    if (!wallet) return;
    setAdminBusy(b.pubkey.toBase58());
    try {
      const program = getProgram(wallet, connection);
      await program.methods.setPaused(paused).accountsPartial({ basket: b.pubkey, authority: wallet.publicKey }).rpc();
      pushToast("ok", paused ? "Paused" : "Resumed", b.assets.map((a) => a.symbol).join(" / "));
      await refresh();
    } catch (e) {
      pushToast("err", "Pause failed", (e as Error).message);
    } finally {
      setAdminBusy(null);
    }
  };

  // Owner: propose a time-locked param change. Activatable by anyone after `delaySecs`.
  const proposeIntent = async (b: BasketView, p: IntentParams, delaySecs: number) => {
    if (!wallet) return;
    setAdminBusy(b.pubkey.toBase58());
    try {
      const program = getProgram(wallet, connection);
      await program.methods
        .proposeIntent(p.thresholdBps, p.thresholdRelBps, new BN(p.intervalSecs), p.spreadBps, p.depositFeeBps, new BN(delaySecs))
        .accountsPartial({ basket: b.pubkey, authority: wallet.publicKey, intent: intentPda(b.pubkey) })
        .rpc();
      pushToast("ok", "Change proposed", `activates in ${delaySecs}s — anyone can apply it then`);
      await refresh();
    } catch (e) {
      pushToast("err", "Propose failed", (e as Error).message);
    } finally {
      setAdminBusy(null);
    }
  };

  // Permissionless: apply a proposed change once its time-lock has elapsed.
  const activateIntent = async (b: BasketView) => {
    if (!wallet) return;
    setAdminBusy(b.pubkey.toBase58());
    try {
      const program = getProgram(wallet, connection);
      await program.methods
        .activateIntent()
        .accountsPartial({ basket: b.pubkey, intent: intentPda(b.pubkey), activator: wallet.publicKey })
        .rpc();
      pushToast("ok", "Change applied", "new params are live on-chain");
      await refresh();
    } catch (e) {
      pushToast("err", "Activate failed", (e as Error).message);
    } finally {
      setAdminBusy(null);
    }
  };

  // Owner: cancel a pending intent before it activates.
  const cancelIntent = async (b: BasketView) => {
    if (!wallet) return;
    setAdminBusy(b.pubkey.toBase58());
    try {
      const program = getProgram(wallet, connection);
      await program.methods
        .cancelIntent()
        .accountsPartial({ basket: b.pubkey, authority: wallet.publicKey, intent: intentPda(b.pubkey) })
        .rpc();
      pushToast("ok", "Proposal canceled", "");
      await refresh();
    } catch (e) {
      pushToast("err", "Cancel failed", (e as Error).message);
    } finally {
      setAdminBusy(null);
    }
  };

  const value: PrismCtx = {
    lives,
    loading,
    updatedAt,
    connected: !!wallet,
    me: wallet?.publicKey.toBase58(),
    refresh,
    holdingsUsd,
    userShares,
    assetBalances,
    selected,
    setSelected,
    sel,
    quoteSym,
    depAmt,
    setDepAmt,
    wdAmt,
    setWdAmt,
    busy,
    adminBusy,
    lastTx,
    deposit,
    depositAssets,
    withdraw,
    rebalance,
    togglePause,
    proposeIntent,
    activateIntent,
    cancelIntent,
    toasts,
    pushToast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
