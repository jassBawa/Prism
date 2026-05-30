import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { MotionProvider } from "@/components/site/motion-provider";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import "./site.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Prism | On-Chain Basket Vaults on Solana",
  description:
    "Tokenized, programmable vaults on Solana. Deposit USDC for diversified basket exposure — priced by Pyth oracles and kept on target by auto-rebalancing keepers.",
  icons: { icon: "/logo.png" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${inter.variable} ${newsreader.variable} min-h-screen overflow-x-hidden selection:bg-accent-gold/30 relative w-full font-sans antialiased`}
      >
        <SmoothScroll />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
