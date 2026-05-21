import type { BasketView } from "./program";

/** A basket enriched with live, priced on-chain state. */
export interface Live {
  view: BasketView;
  navUsd: number;
  weightsBps: number[];
  supply: number;
  maxDriftBps: number;
}

export type ToastKind = "info" | "ok" | "err";

export interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
  sub?: string;
}
