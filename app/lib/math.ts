export interface FundState {
  navUsd: number;
  weightsBps: number[];
  maxDriftBps: number;
  absDriftBps: number[];
  relDriftBps: number[];
  valuesUsd: number[];
}

/** Off-chain mirror of the program's NAV/drift math, for N assets. */
export function computeState(
  balancesRaw: bigint[],
  pricesUsd: number[],
  assets: { decimals: number; targetWeightBps: number }[],
): FundState {
  const valuesUsd = assets.map(
    (a, i) => (Number(balancesRaw[i]) / 10 ** a.decimals) * (pricesUsd[i] ?? 0),
  );
  const navUsd = valuesUsd.reduce((s, v) => s + v, 0);
  const weightsBps = valuesUsd.map((v) =>
    navUsd > 0 ? Math.round((v / navUsd) * 10000) : 0,
  );
  const absDriftBps = assets.map((a, i) =>
    navUsd > 0 ? Math.abs((weightsBps[i] ?? 0) - a.targetWeightBps) : 0,
  );
  const relDriftBps = assets.map((a, i) => {
    if (navUsd <= 0) return 0;
    const targetValue = (navUsd * a.targetWeightBps) / 10000;
    const denom = Math.max(valuesUsd[i] ?? 0, targetValue);
    return denom === 0
      ? 0
      : Math.round(
          (Math.abs((valuesUsd[i] ?? 0) - targetValue) / denom) * 10000,
        );
  });
  const maxDriftBps = navUsd > 0 ? Math.max(...absDriftBps) : 0;
  return {
    navUsd,
    weightsBps,
    maxDriftBps,
    absDriftBps,
    relDriftBps,
    valuesUsd,
  };
}

/** Mirror of the on-chain dual drift gate: some asset breaches both thresholds. */
export function driftTriggers(
  state: FundState,
  thresholdAbsBps: number,
  thresholdRelBps: number,
): boolean {
  return state.absDriftBps.some(
    (abs, i) =>
      abs >= thresholdAbsBps && (state.relDriftBps[i] ?? 0) >= thresholdRelBps,
  );
}
