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
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { RPC_URL } from "@/lib/constants";
import { fetchAllBaskets, getProgram, getReadProgram, ownerAta, vaultAta, type BasketView } from "@/lib/program";
import { computeState } from "@/lib/math";
import { depositRemaining, rebalanceRemaining, withdrawRemaining } from "@/lib/accounts";
import { latestPricesUsd, sendWithPyth } from "@/lib/pyth";
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
  deposit: () => Promise<void>;
  withdraw: () => Promise<void>;
  rebalance: (b: BasketView) => Promise<void>;
  togglePause: (b: BasketView, paused: boolean) => Promise<void>;
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
        for (const l of out) {
          const s = Number(await tokenBal(ownerAta(wallet.publicKey, l.view.basketMint))) / 1e6;
          const unit = l.supply > 0 ? l.navUsd / l.supply : 1;
          total += s * unit;
          shares[l.view.pubkey.toBase58()] = s;
        }
        setHoldingsUsd(total);
        setUserShares(shares);
      } else {
        setHoldingsUsd(0);
        setUserShares({});
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

  const deposit = async () => {
    if (!wallet || !sel) return;
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
      const amount = new BN(Math.round(Number(depAmt) * 10 ** quote.decimals));
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
      ]);
      const sig = sigs[sigs.length - 1];
      if (sig) setLastTx({ action: "deposit", sig });
      pushToast("ok", `Deposited ${depAmt} ${quoteSym}`, sig?.slice(0, 24) + "…");
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
    setAdminBusy(b.pubkey.toBase58());
    pushToast("info", "Rebalancing…", "posting prices — approve in your wallet");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const feeds = b.assets.map((a) => a.feedHex);
      const sigs = await sendWithPyth(connection, wallet, feeds, async (priceFor) => [
        await program.methods
          .rebalance()
          .accountsPartial({ basket: b.pubkey, keeper: me, tokenProgram: TOKEN_PROGRAM_ID })
          .remainingAccounts(rebalanceRemaining(b.pubkey, me, b.assets, priceFor))
          .instruction(),
      ]);
      pushToast("ok", "Rebalanced", sigs[sigs.length - 1]?.slice(0, 24) + "…");
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

  const value: PrismCtx = {
    lives,
    loading,
    updatedAt,
    connected: !!wallet,
    me: wallet?.publicKey.toBase58(),
    refresh,
    holdingsUsd,
    userShares,
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
    withdraw,
    rebalance,
    togglePause,
    toasts,
    pushToast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
