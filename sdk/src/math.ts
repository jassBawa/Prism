export interface DriftResult {
  /** NAV in micro-USD. */
  navMicro: number;
  /** current weight per asset, basis points. */
  weightsBps: number[];
  /** max |current - target| across assets, basis points. */
  maxDriftBps: number;
  /** absolute drift per asset (|cur - tgt|, bps of NAV). */
  absDriftBps: number[];
  /** relative drift per asset (|value - target_value| / max(value, target_value), bps). */
  relDriftBps: number[];
}

/**
 * Off-chain mirror of the program's drift calc (same micro-USD math), for N assets.
 * `balancesRaw` are vault token amounts; `pricesMicro` is price*10^(expo+6) per whole
 * token (micro-USD); `assets` gives decimals + target weight — all in the same order.
 */
export function computeDrift(
  balancesRaw: bigint[],
  pricesMicro: number[],
  assets: { decimals: number; weightBps: number }[],
): DriftResult {
  const values = assets.map(
    (a, i) =>
      (Number(balancesRaw[i]) * (pricesMicro[i] ?? 0)) / 10 ** a.decimals,
  );
  const navMicro = values.reduce((s, v) => s + v, 0);
  const weightsBps = values.map((v) =>
    navMicro > 0 ? Math.round((v / navMicro) * 10000) : 0,
  );
  const absDriftBps = assets.map((a, i) =>
    navMicro > 0 ? Math.abs((weightsBps[i] ?? 0) - a.weightBps) : 0,
  );
  const relDriftBps = assets.map((a, i) => {
    if (navMicro <= 0) return 0;
    const targetValue = (navMicro * a.weightBps) / 10000;
    const denom = Math.max(values[i] ?? 0, targetValue);
    return denom === 0
      ? 0
      : Math.round((Math.abs((values[i] ?? 0) - targetValue) / denom) * 10000);
  });
  const maxDriftBps = navMicro > 0 ? Math.max(...absDriftBps) : 0;
  return { navMicro, weightsBps, maxDriftBps, absDriftBps, relDriftBps };
}

/**
 * Mirror of the on-chain dual drift gate: a rebalance is allowed only if SOME asset
 * breaches both the absolute and the relative threshold at once.
 */
export function driftTriggers(
  drift: DriftResult,
  thresholdAbsBps: number,
  thresholdRelBps: number,
): boolean {
  return drift.absDriftBps.some(
    (abs, i) =>
      abs >= thresholdAbsBps && (drift.relDriftBps[i] ?? 0) >= thresholdRelBps,
  );
}
