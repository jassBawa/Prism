export interface DriftResult {
  /** NAV in micro-USD. */
  navMicro: number;
  /** current weight per asset, basis points. */
  weightsBps: number[];
  /** max |current - target| across assets, basis points. */
  maxDriftBps: number;
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
  const values = assets.map((a, i) => (Number(balancesRaw[i]) * (pricesMicro[i] ?? 0)) / 10 ** a.decimals);
  const navMicro = values.reduce((s, v) => s + v, 0);
  const weightsBps = values.map((v) => (navMicro > 0 ? Math.round((v / navMicro) * 10000) : 0));
  const maxDriftBps =
    navMicro > 0 ? Math.max(...assets.map((a, i) => Math.abs((weightsBps[i] ?? 0) - a.weightBps))) : 0;
  return { navMicro, weightsBps, maxDriftBps };
}
