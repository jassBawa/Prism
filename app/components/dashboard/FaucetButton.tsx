"use client";
import { useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { FAUCET_URL } from "@/lib/constants";
import type { ToastKind } from "@/lib/types";

interface Props {
  onToast: (kind: ToastKind, msg: string, sub?: string) => void;
  onFunded: () => void;
}

/** Self-serve test funds (devnet SOL + test USDC) from the ops faucet. */
export function FaucetButton({ onToast, onFunded }: Props) {
  const wallet = useAnchorWallet();
  const [busy, setBusy] = useState(false);
  if (!FAUCET_URL || !wallet) return null;

  const claim = async () => {
    setBusy(true);
    onToast("info", "Requesting test funds…", "SOL + test USDC");
    try {
      const res = await fetch(`${FAUCET_URL.replace(/\/$/, "")}/faucet`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pubkey: wallet.publicKey.toBase58() }),
      });
      const j = (await res.json()) as { ok?: boolean; sol?: number; usdc?: number; error?: string };
      if (!res.ok) throw new Error(j.error ?? `faucet ${res.status}`);
      onToast("ok", `Funded ${j.sol} SOL + ${j.usdc} USDC`, "ready to deposit");
      onFunded();
    } catch (e) {
      onToast("err", "Faucet failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={claim}
      disabled={busy}
      title="Get devnet SOL + test USDC to try the app"
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid var(--line)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        fontWeight: 600,
        fontSize: 13,
        cursor: busy ? "default" : "pointer",
        whiteSpace: "nowrap",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Funding…" : "Get test funds"}
    </button>
  );
}
