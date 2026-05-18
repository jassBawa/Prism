export interface FundState {
  navUsd: number;
  weightsBps: number[];
  maxDriftBps: number;
  valuesUsd: number[];
}

/** Off-chain mirror of the program's NAV/drift math, for N assets. */
export function computeState(
  balancesRaw: bigint[],
  pricesUsd: number[],
  assets: { decimals: number; targetWeightBps: number }[],
): FundState {
  const valuesUsd = assets.map((a, i) => (Number(balancesRaw[i]) / 10 ** a.decimals) * (pricesUsd[i] ?? 0));
  const navUsd = valuesUsd.reduce((s, v) => s + v, 0);
  const weightsBps = valuesUsd.map((v) => (navUsd > 0 ? Math.round((v / navUsd) * 10000) : 0));
  const maxDriftBps =
    navUsd > 0 ? Math.max(...assets.map((a, i) => Math.abs((weightsBps[i] ?? 0) - a.targetWeightBps))) : 0;
  return { navUsd, weightsBps, maxDriftBps, valuesUsd };
}
