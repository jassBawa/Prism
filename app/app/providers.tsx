"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo, type ReactNode } from "react";
import { RPC_URL } from "@/lib/constants";
import { PrismProvider } from "@/components/PrismProvider";
import { AppShell } from "@/components/AppShell";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  // Wallet-Standard wallets (Phantom, Solflare, Backpack…) register themselves —
  // no explicit adapters needed (avoids the WalletConnect/@reown dependency).
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={RPC_URL}>
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
