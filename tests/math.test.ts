import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrift, driftTriggers } from "../sdk/src/math.js";

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
  const r = computeDrift(
    [50_000_000n, 6_000_000n, 2_000_000n],
    PRICES,
    ASSETS3,
  );
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

// --- relative drift + dual gate (mirror of the on-chain rebalance gate) ---

test("relative drift: 100% USDC vault -> USDC rel 8000, SOL rel 10000", () => {
  const r = computeDrift([0n, 0n, 10_000_000n], PRICES, ASSETS3);
  // USDC: value 10, target 2 -> |10-2|/max(10,2) = 0.8 = 8000 bps
  assert.equal(r.relDriftBps[2], 8000);
  // SOL: value 0, target 5 -> |0-5|/5 = 1 = 10000 bps
  assert.equal(r.relDriftBps[0], 10000);
});

test("relative drift: zero-weight + zero-value asset -> rel 0 (no div-by-zero)", () => {
  const assets = [
    { decimals: 9, weightBps: 5000 },
    { decimals: 6, weightBps: 5000 },
    { decimals: 6, weightBps: 0 }, // zero-weight slot, empty
  ];
  const r = computeDrift([50_000_000n, 5_000_000n, 0n], PRICES, assets);
  assert.equal(r.relDriftBps[2], 0);
  assert.equal(r.absDriftBps[2], 0);
});

test("dual gate: abs passes but rel fails -> no trigger", () => {
  const assets2 = [
    { decimals: 9, weightBps: 5000 },
    { decimals: 6, weightBps: 5000 },
  ];
  const prices2 = [100_000_000, 1_000_000];
  // $5.1 SOL / $4.9 USDC, nav $10 -> abs drift 100 bps each; rel ~196/200 bps.
  const r = computeDrift([51_000_000n, 4_900_000n], prices2, assets2);
  assert.equal(r.maxDriftBps, 100);
  // abs gate (50) clears, but a high rel gate (500) is not met -> no rebalance.
  assert.equal(driftTriggers(r, 50, 500), false);
  // both gates low -> rebalance triggers.
  assert.equal(driftTriggers(r, 50, 50), true);
});

test("dual gate: both gates breached by the over-weight asset -> trigger", () => {
  const r = computeDrift([0n, 0n, 10_000_000n], PRICES, ASSETS3);
  assert.equal(driftTriggers(r, 50, 50), true);
});

// --- creator deposit fee split (mirror of deposit.rs) ---

const feeSplit = (mint: number, feeBps: number) => {
  const fee = Math.floor((mint * feeBps) / 10000);
  return { fee, userMint: mint - fee };
};

test("fee split: 0.5% of 1,000,000 -> 5,000 to creator, 995,000 to user", () => {
  const { fee, userMint } = feeSplit(1_000_000, 50);
  assert.equal(fee, 5_000);
  assert.equal(userMint, 995_000);
});

test("fee split: tiny mint rounds the fee to 0 (all to user)", () => {
  const { fee, userMint } = feeSplit(100, 50); // 0.5 -> floors to 0
  assert.equal(fee, 0);
  assert.equal(userMint, 100);
});
