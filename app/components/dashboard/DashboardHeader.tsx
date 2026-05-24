"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { IconLayers } from "@/components/ui/icons";

interface Props {
  network: string;
}

export function DashboardHeader({ network }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark">
            <IconLayers
              width={18}
              height={18}
              stroke="#060810"
              strokeWidth={2}
            />
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
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
