"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useEffect, useMemo, type ReactNode } from "react";
import { getEndpoint } from "@/lib/connection";
import { applyTheme } from "@/lib/theme";
import { PrismProvider } from "@/components/PrismProvider";
import { AppShell } from "@/components/AppShell";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  // Wallet-Standard wallets (Phantom, Solflare, Backpack…) register themselves —
  // no explicit adapters needed (avoids the WalletConnect/@reown dependency).
  const wallets = useMemo(() => [], []);
  // RPC endpoint = user's saved choice (Settings), else the build default.
  const endpoint = useMemo(() => getEndpoint(), []);
  // Re-assert the persisted theme after hydration (covers any attribute reset).
  useEffect(() => applyTheme(), []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <PrismProvider>
            <AppShell>{children}</AppShell>
          </PrismProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
