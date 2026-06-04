"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetworkLabel } from "@/lib/connection";
import { SettingsMenu } from "./SettingsMenu";
import { ThemeToggle } from "./ThemeToggle";
import { IconHome, IconCompass, IconCoins } from "@/components/ui/icons";

const NAV = [
  { href: "/app", label: "Home", icon: IconHome, exact: true },
  { href: "/explore", label: "Explore", icon: IconCompass, exact: false },
  { href: "/faucet", label: "Faucet", icon: IconCoins, exact: false },
];

export function Sidebar() {
  const path = usePathname();
  const network = useNetworkLabel();
  const active = (href: string, exact: boolean) => (exact ? path === href : path.startsWith(href));

  return (
    <aside className="sidebar">
      <Link href="/app" className="side-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-img" src="/logo.png" alt="Prism" width={36} height={36} />
        <div className="brand-copy">
          <div className="brand-name">Prism</div>
          <div className="brand-tag">Index funds on Solana</div>
        </div>
      </Link>

      <div className="side-grouplabel">Menu</div>
      <nav className="side-nav">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className={"snav" + (active(n.href, n.exact) ? " on" : "")}>
              <Icon width={17} height={17} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <span className="netpill">
          <span className="dot" />
          {network}
        </span>
        <WalletMultiButton />
        <div className="side-actions">
          <ThemeToggle />
          <SettingsMenu />
        </div>
      </div>
    </aside>
  );
}
