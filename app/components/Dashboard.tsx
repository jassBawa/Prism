"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { RPC_URL } from "@/lib/constants";
import {
  fetchAllBaskets,
  getProgram,
  getReadProgram,
  ownerAta,
  vaultAta,
} from "@/lib/program";
import { computeState } from "@/lib/math";
import { depositRemaining, withdrawRemaining } from "@/lib/accounts";
import { latestPricesUsd, sendWithPyth } from "@/lib/pyth";
import { timeAgo } from "@/lib/format";
import type { Live, Toast, ToastKind } from "@/lib/types";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { PortfolioOverview } from "./dashboard/PortfolioOverview";
import { BasketGrid } from "./dashboard/BasketGrid";
import { BasketDetail } from "./dashboard/BasketDetail";
import { CreateBasket } from "./dashboard/CreateBasket";
import { Toasts } from "./dashboard/Toasts";
import { IconRefresh } from "./ui/icons";

const NETWORK =
  RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost")
    ? "Localnet"
    : RPC_URL.includes("devnet")
      ? "Devnet"
      : RPC_URL.includes("mainnet")
        ? "Mainnet"
        : "Custom RPC";

export function Dashboard() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [lives, setLives] = useState<Live[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [depAmt, setDepAmt] = useState("100");
  const [wdAmt, setWdAmt] = useState("10");
  const [userBasket, setUserBasket] = useState(0);
  const [holdingsUsd, setHoldingsUsd] = useState(0);
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastId = useRef(0);

  const pushToast = useCallback(
    (kind: ToastKind, msg: string, sub?: string) => {
      const id = ++toastId.current;
      setToasts((cur) => [...cur, { id, kind, msg, sub }]);
      const ttl = kind === "err" ? 9000 : 6000;
      setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), ttl);
      return id;
    },
    [],
  );

  const dismissToast = useCallback(
    (id: number) => setToasts((cur) => cur.filter((t) => t.id !== id)),
    [],
  );

  const tokenBal = useCallback(
    async (acc: PublicKey): Promise<bigint> => {
      try {
        return BigInt(
          (await connection.getTokenAccountBalance(acc)).value.amount,
        );
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
      const feeds = [
        ...new Set(baskets.flatMap((b) => b.assets.map((a) => a.feedHex))),
      ];
      const prices = feeds.length ? await latestPricesUsd(feeds) : {};
      const out: Live[] = [];
      for (const b of baskets) {
        const balances = await Promise.all(
          b.assets.map((a) => tokenBal(vaultAta(b.pubkey, a.mint))),
        );
        const pricesUsd = b.assets.map((a) => prices[a.feedHex] ?? 0);
        const st = computeState(balances, pricesUsd, b.assets);
        const sup = await connection
          .getTokenSupply(b.basketMint)
          .catch(() => null);
        out.push({
          view: b,
          navUsd: st.navUsd,
          weightsBps: st.weightsBps,
          supply: sup?.value.uiAmount ?? 0,
          maxDriftBps: st.maxDriftBps,
        });
      }
      setLives(out);
      const selPk = selected ?? out[0]?.view.pubkey.toBase58() ?? null;
      if (selPk !== selected) setSelected(selPk);

      if (wallet) {
        let total = 0;
        let selBal = 0;
        for (const l of out) {
          const shares =
            Number(
              await tokenBal(ownerAta(wallet.publicKey, l.view.basketMint)),
            ) / 1e6;
          const unit = l.supply > 0 ? l.navUsd / l.supply : 1;
          total += shares * unit;
          if (l.view.pubkey.toBase58() === selPk) selBal = shares;
        }
        setHoldingsUsd(total);
        setUserBasket(selBal);
      } else {
        setHoldingsUsd(0);
        setUserBasket(0);
      }
      setUpdatedAt(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
  const quoteSym = sel?.view.assets[sel.view.quoteIndex]?.symbol ?? "USDC";

  const deposit = async () => {
    if (!wallet || !sel) return;
    setBusy("deposit");
    pushToast(
      "info",
      "Posting Pyth prices & depositing…",
      "approve in your wallet",
    );
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const b = sel.view;
      const quote = b.assets[b.quoteIndex]!;
      const depositorBasket = ownerAta(me, b.basketMint);
      const depositorQuote = ownerAta(me, quote.mint);
      // Creator's basket ATA receives the deposit fee; ensure it exists (idempotent,
      // and == depositorBasket when the depositor is the creator).
      const creatorBasket = ownerAta(b.authority, b.basketMint);
      const amount = new BN(Math.round(Number(depAmt) * 10 ** quote.decimals));
      const feeds = b.assets.map((a) => a.feedHex);
      const sigs = await sendWithPyth(
        connection,
        wallet,
        feeds,
        async (priceFor) => [
          createAssociatedTokenAccountIdempotentInstruction(
            me,
            depositorBasket,
            me,
            b.basketMint,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            me,
            creatorBasket,
            b.authority,
            b.basketMint,
          ),
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
        ],
      );
      pushToast(
        "ok",
        `Deposited ${depAmt} ${quoteSym}`,
        sigs[sigs.length - 1]?.slice(0, 24) + "…",
      );
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
    pushToast("info", "Withdrawing in-kind…", "approve in your wallet");
    try {
      const program = getProgram(wallet, connection);
      const me = wallet.publicKey;
      const b = sel.view;
      const amount = new BN(Math.round(Number(wdAmt) * 1e6));
      const ataIxs = b.assets.map((a) =>
        createAssociatedTokenAccountIdempotentInstruction(
          me,
          ownerAta(me, a.mint),
          me,
          a.mint,
        ),
      );
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
      pushToast("ok", `Withdrew ${wdAmt} shares`, sig.slice(0, 24) + "…");
      await refresh();
    } catch (e) {
      pushToast("err", "Withdraw failed", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app">
      <DashboardHeader network={NETWORK} />

      <main className="container">
        <div className="page-head">
          <div>
            <span className="page-kicker">Prism console</span>
            <h1>Portfolio dashboard</h1>
            <p>
              Compose, fund, and rebalance on-chain index baskets. Live NAV is
              priced from Pyth feeds.
            </p>
          </div>
          <div className="page-actions" aria-label="Dashboard status">
            <span>Live Pyth pricing</span>
            <span>Auto-refreshing</span>
          </div>
        </div>

        <PortfolioOverview
          lives={lives}
          holdingsUsd={holdingsUsd}
          connected={!!wallet}
          loading={loading}
        />

        <section className="section">
          <div className="section-head">
            <div className="section-title">
              Your baskets <span className="count">{lives.length}</span>
            </div>
            {updatedAt > 0 && (
              <span className="updated">
                <IconRefresh width={13} height={13} />
                Updated {timeAgo(updatedAt)}
              </span>
            )}
          </div>
          <BasketGrid
            lives={lives}
            selected={selected}
            loading={loading}
            onSelect={setSelected}
          />
        </section>

        {sel && (
          <section className="section">
            <BasketDetail
              live={sel}
              quoteSym={quoteSym}
              userBalance={userBasket}
              depAmt={depAmt}
              wdAmt={wdAmt}
              setDepAmt={setDepAmt}
              setWdAmt={setWdAmt}
              busy={busy}
              connected={!!wallet}
              onDeposit={deposit}
              onWithdraw={withdraw}
            />
          </section>
        )}

        <section className="section">
          <CreateBasket
            baskets={lives.map((l) => l.view)}
            onCreated={refresh}
            onToast={pushToast}
            defaultOpen={!loading && lives.length === 0}
          />
        </section>
      </main>

      <Toasts items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
