"use client";
import type { ReactNode } from "react";
import { usePrism } from "./PrismProvider";
import { PriceTicker } from "./PriceTicker";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toasts } from "./dashboard/Toasts";

/** Persistent app chrome: price ticker, left nav, content, toast queue.
 *  Fund detail is its own route (/fund/[pubkey]), so no modal/right rail here. */
export function AppShell({ children }: { children: ReactNode }) {
  const p = usePrism();
  return (
    <div className="shell-root">
      <PriceTicker />
      <div className="shell">
        <Sidebar />
        <main className="shell-main">{children}</main>
      </div>
      <StatusBar />
      <Toasts items={p.toasts} onDismiss={p.dismissToast} />
    </div>
  );
}
