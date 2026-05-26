"use client";
import { useEffect, useState } from "react";
import { RPC_URL } from "@/lib/constants";

// User-chosen connection, persisted in localStorage and applied on reload.
// When nothing is saved we fall back to the build-time RPC_URL (env default).
const NET_KEY = "prism.net";
const MODE_KEY = "prism.rpcMode";
const URL_KEY = "prism.rpcUrl";

export type Net = "devnet" | "mainnet";
export type RpcMode = "public" | "custom";
export interface ConnConfig {
  net: Net;
  mode: RpcMode;
  customUrl: string;
}

const PUBLIC_RPC: Record<Net, string> = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

export function readConfig(): ConnConfig | null {
  if (typeof window === "undefined") return null;
  const net = localStorage.getItem(NET_KEY) as Net | null;
  if (net !== "devnet" && net !== "mainnet") return null;
  return {
    net,
    mode: localStorage.getItem(MODE_KEY) === "custom" ? "custom" : "public",
    customUrl: localStorage.getItem(URL_KEY) ?? "",
  };
}

/** The RPC URL the app should connect to right now. */
export function getEndpoint(): string {
  const c = readConfig();
  if (!c) return RPC_URL;
  if (c.mode === "custom" && c.customUrl.trim()) return c.customUrl.trim();
  return PUBLIC_RPC[c.net] ?? RPC_URL;
}

export function saveConfig(c: ConnConfig): void {
  localStorage.setItem(NET_KEY, c.net);
  localStorage.setItem(MODE_KEY, c.mode);
  localStorage.setItem(URL_KEY, c.customUrl.trim());
}

export function resetConfig(): void {
  localStorage.removeItem(NET_KEY);
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(URL_KEY);
}

export function labelFor(url: string): string {
  if (url.includes("127.0.0.1") || url.includes("localhost")) return "Localnet";
  if (url.includes("devnet")) return "Devnet";
  if (url.includes("mainnet")) return "Mainnet";
  return "Custom RPC";
}

/** SSR-safe network label: the build default on first paint, the saved override after mount. */
export function useNetworkLabel(): string {
  const [label, setLabel] = useState(() => labelFor(RPC_URL));
  useEffect(() => setLabel(labelFor(getEndpoint())), []);
  return label;
}
