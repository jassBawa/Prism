import Link from "next/link";
import { APP_URL, DOCS_URL, EXPLORER_URL, HAS_DOCS } from "@/lib/site/config";

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Open app", href: APP_URL },
      { label: "What's inside", href: "#inside" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Roadmap", href: "#roadmap" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Resources",
    links: [
      ...(HAS_DOCS ? [{ label: "Docs", href: DOCS_URL } as FooterLink] : []),
      { label: "Program", href: EXPLORER_URL, external: true },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Solana Devnet", href: EXPLORER_URL, external: true },
      { label: "Pyth Network", href: "https://pyth.network", external: true },
    ],
  },
];

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">{title}</p>
      <ul className="mt-4 flex flex-col gap-3 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/55 no-underline transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-white/55 no-underline transition-colors hover:text-white">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-hero-bg text-white">
      <div className="container mx-auto px-6 lg:px-12">
        {/* Partners strip */}
        {/* <div className="border-b border-white/10 py-12">
          <PartnerMarquee />
        </div> */}

        {/* Sitemap */}
        <div className="grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="size-8 rounded-[0.625rem] object-contain brightness-[1.7] invert"
                src="/logo.png"
                alt=""
                width={32}
                height={32}
              />
              <span className="font-serif text-lg tracking-[-0.02em]">Prism</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              On-chain index funds on Solana. A working devnet reference — deposit once,
              hold a single, balanced basket token.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <FooterCol key={col.title} title={col.title} links={col.links} />
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-sm text-white/40 sm:flex-row">
          <span>© Prism · working devnet reference</span>
          <span className="text-white/30">Solana · Devnet</span>
        </div>
      </div>
    </footer>
  );
}
