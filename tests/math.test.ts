import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrift } from "../sdk/src/math.js";

// micro-USD per whole token: SOL $100, JUP $0.50, USDC $1.
const PRICES = [100_000_000, 500_000, 1_000_000];
// 3-asset basket: SOL 9dec/50%, JUP 6dec/30%, USDC 6dec/20%.
const ASSETS3 = [
  { decimals: 9, weightBps: 5000 },
  { decimals: 6, weightBps: 3000 },
  { decimals: 6, weightBps: 2000 },
];

test("empty vault -> zero nav and drift", () => {
  const r = computeDrift([0n, 0n, 0n], PRICES, ASSETS3);
  assert.equal(r.navMicro, 0);
  assert.equal(r.maxDriftBps, 0);
});

test("100% USDC vault -> $10 nav, max drift 8000 bps vs 50/30/20 target", () => {
  const r = computeDrift([0n, 0n, 10_000_000n], PRICES, ASSETS3); // 10 USDC (6 dec)
  assert.equal(r.navMicro, 10_000_000);
  assert.deepEqual(r.weightsBps, [0, 0, 10000]);
  assert.equal(r.maxDriftBps, 8000); // USDC 100% vs 20% target
});

test("on-target basket -> ~zero drift", () => {
  // $5 SOL = 0.05 SOL (9 dec), $3 JUP = 6 JUP (6 dec), $2 USDC (6 dec)
  const r = computeDrift([50_000_000n, 6_000_000n, 2_000_000n], PRICES, ASSETS3);
  assert.equal(r.navMicro, 10_000_000);
  assert.deepEqual(r.weightsBps, [5000, 3000, 2000]);
  assert.equal(r.maxDriftBps, 0);
});

test("decimals scaling: 1 SOL (9 dec) at $100 = $100 nav", () => {
  const r = computeDrift([1_000_000_000n, 0n, 0n], PRICES, ASSETS3);
  assert.equal(r.navMicro, 100_000_000);
});

// N-asset coverage: a 2-asset basket (variable asset count).
test("2-asset basket 60/40 on target -> zero drift", () => {
  const assets2 = [
    { decimals: 9, weightBps: 6000 },
    { decimals: 6, weightBps: 4000 },
  ];
  const prices2 = [100_000_000, 1_000_000]; // SOL $100, USDC $1
  // $6 SOL = 0.06 SOL (9 dec), $4 USDC (6 dec)
  const r = computeDrift([60_000_000n, 4_000_000n], prices2, assets2);
  assert.equal(r.navMicro, 10_000_000);
  assert.deepEqual(r.weightsBps, [6000, 4000]);
  assert.equal(r.maxDriftBps, 0);
});
