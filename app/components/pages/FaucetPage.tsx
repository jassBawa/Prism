"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePrism } from "@/components/PrismProvider";
import { RightRail } from "@/components/rail/RightRail";
import { ownerAta } from "@/lib/program";
import { SUPPORTED_ASSETS } from "@/lib/constants";
import { claimFaucet, type FaucetResponse } from "@/lib/faucet";
import { explorerTx } from "@/lib/format";
import { IconCoins, IconExternal, IconCheck } from "@/components/ui/icons";

const USDC = SUPPORTED_ASSETS.find((a) => a.key === "usdc")!;

/** Devnet onboarding: claim test USDC (+ a SOL drip) so a fresh wallet can try a deposit. */
export function FaucetPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const p = usePrism();
  const [bal, setBal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FaucetResponse | null>(null);

  const loadBal = useCallback(async () => {
    if (!publicKey || !USDC.mint) return;
    try {
      const ata = ownerAta(publicKey, new PublicKey(USDC.mint));
      const b = await connection.getTokenAccountBalance(ata);
      setBal(b.value.uiAmount ?? 0);
    } catch {
      setBal(0); // no token account yet = nothing held
    }
  }, [publicKey, connection]);

  useEffect(() => {
    void loadBal();
  }, [loadBal]);

  const claim = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const r = await claimFaucet(publicKey.toBase58());
      setResult(r);
      if (r.error) {
        const sub = r.retryAfterSec ? `try again in ~${Math.ceil(r.retryAfterSec / 60)} min` : r.error;
        p.pushToast("err", r.error === "cooldown" ? "Faucet cooldown" : "Faucet failed", sub);
      } else {
        p.pushToast("ok", `Received ${r.usdc} test USDC`, r.sol ? `+ ${r.sol} SOL for fees` : undefined);
        await loadBal();
        await p.refresh();
      }
    } catch (e) {
      p.pushToast("err", "Faucet unreachable", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [publicKey, p, loadBal]);

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="page-kicker">Faucet</span>
          <h1>Get test tokens</h1>
          <p>
            Prism runs on Solana <strong>devnet</strong> with play-money tokens. Claim test USDC (plus a
            little SOL for fees), then deposit into any fund for instant diversified exposure.
          </p>
        </div>
      </div>

      <div className="layout">
        <div className="layout-main">
          <div className="ops-card" style={{ maxWidth: 460 }}>
            <div className="ops-head">
              <span className="ops-title">
                <IconCoins width={14} height={14} /> Test USDC faucet
              </span>
            </div>

            {connected && publicKey ? (
              <>
                <div className="ops-stat">
                  <span className="ops-k">Your test USDC</span>
                  <span className="ops-v">{bal === null ? "…" : bal.toLocaleString()} USDC</span>
                </div>

                <button className="act ops-rebalance" disabled={busy} onClick={claim}>
                  {busy ? (
                    <>
                      <span className="spinner" /> Sending…
                    </>
                  ) : (
                    "Get test USDC"
                  )}
                </button>

                {result?.ok && (
                  <div className="ops-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    <span className="ops-k">
                      <IconCheck width={13} height={13} /> Sent {result.usdc} USDC
                      {result.sol ? ` + ${result.sol} SOL` : ""}
                    </span>
                    {result.usdcSig && (
                      <a className="updated" href={explorerTx(result.usdcSig)} target="_blank" rel="noreferrer">
                        mint tx <IconExternal width={12} height={12} />
                      </a>
                    )}
                    {result.solSig && (
                      <a className="updated" href={explorerTx(result.solSig)} target="_blank" rel="noreferrer">
                        SOL tx <IconExternal width={12} height={12} />
                      </a>
                    )}
                  </div>
                )}

                <p className="ops-note">
                  One claim per wallet per hour. Test USDC is the quote asset for deposits — head to a fund
                  and zap it into a diversified basket.
                </p>

                {result?.ok && (
                  <Link className="btn" href="/explore">
                    Deposit into a fund →
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="ops-note">
                  Connect a wallet (set to <strong>Devnet</strong>) to claim test tokens.
                </p>
                <WalletMultiButton />
              </>
            )}
          </div>
        </div>

        <RightRail />
      </div>
    </div>
  );
}
