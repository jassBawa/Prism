import Link from "next/link";
import { APP_URL, DOCS_URL } from "@/lib/config";

export function Nav() {
  return (
    <header className="relative z-10 w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-12 lg:py-8">
        <Link
          href="/"
          className="font-serif text-lg text-white tracking-[-0.02em] hover:opacity-80 transition-opacity lg:text-xl"
        >
          Prism
        </Link>

        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href={DOCS_URL}
            className="text-sm text-white/65 hover:text-white transition-colors duration-200"
          >
            Docs
          </Link>
          <Link href={APP_URL} className="nav-app-link">
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}
