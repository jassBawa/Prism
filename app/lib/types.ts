import type { BasketView } from "./program";

/** A basket enriched with live, priced on-chain state. */
export interface Live {
  view: BasketView;
  navUsd: number;
  weightsBps: number[];
  supply: number;
  maxDriftBps: number;
  /** per-asset USD value in the vault (same order as view.assets). */
  valuesUsd: number[];
  /** per-asset token amount held in the vault. */
  amounts: number[];
}

export type ToastKind = "info" | "ok" | "err";

export interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
  sub?: string;
}
