"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { IconLayers } from "@/components/ui/icons";
import type { ToastKind } from "@/lib/types";
import { FaucetButton } from "./FaucetButton";

interface Props {
  network: string;
  onToast: (kind: ToastKind, msg: string, sub?: string) => void;
  onFunded: () => void;
}

export function DashboardHeader({ network, onToast, onFunded }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark">
            <IconLayers width={18} height={18} stroke="#060810" strokeWidth={2} />
          </span>
          <div>
            <div className="brand-name">Prism</div>
            <div className="brand-tag">on-chain index baskets</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="netpill">
            <span className="dot" />
            {network}
          </span>
          <FaucetButton onToast={onToast} onFunded={onFunded} />
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
