import { ASSETS } from "./constants";

export interface FundState {
  navUsd: number;
  weightsBps: number[];
  maxDriftBps: number;
  valuesUsd: number[];
}

/** Off-chain mirror of the program's NAV/drift math. balances raw, pricesUsd per whole token. */
export function computeState(balancesRaw: bigint[], pricesUsd: number[]): FundState {
  const valuesUsd = ASSETS.map((a, i) => (Number(balancesRaw[i]) / 10 ** a.decimals) * pricesUsd[i]);
  const navUsd = valuesUsd.reduce((s, v) => s + v, 0);
  const weightsBps = valuesUsd.map((v) => (navUsd > 0 ? Math.round((v / navUsd) * 10000) : 0));
  const maxDriftBps =
    navUsd > 0 ? Math.max(...ASSETS.map((a, i) => Math.abs((weightsBps[i] ?? 0) - a.weightBps))) : 0;
  return { navUsd, weightsBps, maxDriftBps, valuesUsd };
}
