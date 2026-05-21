import Link from "next/link";
import { DOCS_URL, EXPLORER_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="bg-hero-bg text-white">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row lg:px-12">
        <span className="font-serif text-base tracking-[-0.02em] text-white/90">
          Prism
        </span>

        <div className="flex items-center gap-6 text-sm text-white/55">
          <a
            href={EXPLORER_URL}
            className="transition-colors hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            Program
          </a>
          <Link href={DOCS_URL} className="transition-colors hover:text-white">
            Docs
          </Link>
          <span className="text-white/30">Solana · Devnet</span>
        </div>
      </div>
    </footer>
  );
}
