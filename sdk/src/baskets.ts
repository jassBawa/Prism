import { BN, type Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { MiniSymmetry } from "./mini_symmetry.js";
import { supportedByFeed } from "./constants.js";
import { registryPda, vaultAta } from "./pdas.js";
import type { AssetEntry } from "./config.js";

/** A basket read from chain via the registry (not getProgramAccounts), so the
 *  keeper/dashboard rebalance + list ANY basket — including visitor-created ones. */
export interface OnchainBasket {
  pubkey: PublicKey;
  authority: PublicKey;
  basketMint: PublicKey;
  id: number;
  quoteIndex: number;
  thresholdBps: number;
  intervalSecs: number;
  lastRebalanceTs: number;
  paused: boolean;
  assets: AssetEntry[];
  vaults: string[];
}

interface RawAsset {
  mint: PublicKey;
  targetWeightBps: number;
  feedId: number[];
  decimals: number;
}
interface RawBasket {
  authority: PublicKey;
  basketMint: PublicKey;
  id: BN;
  numAssets: number;
  quoteIndex: number;
  assets: RawAsset[];
  rebalanceThresholdBps: number;
  rebalanceIntervalSecs: BN;
  lastRebalanceTs: BN;
  paused: boolean;
}

const toHex = (b: number[]): string => Buffer.from(b).toString("hex");

function decode(pubkey: PublicKey, a: RawBasket): OnchainBasket {
  const assets: AssetEntry[] = a.assets.slice(0, a.numAssets).map((x) => {
    const feed = toHex(x.feedId);
    return { key: supportedByFeed(feed)?.key ?? feed.slice(0, 6), mint: x.mint.toBase58(), feed, decimals: x.decimals, weightBps: x.targetWeightBps };
  });
  return {
    pubkey,
    authority: a.authority,
    basketMint: a.basketMint,
    id: a.id.toNumber(),
    quoteIndex: a.quoteIndex,
    thresholdBps: a.rebalanceThresholdBps,
    intervalSecs: a.rebalanceIntervalSecs.toNumber(),
    lastRebalanceTs: a.lastRebalanceTs.toNumber(),
    paused: a.paused,
    assets,
    vaults: assets.map((as) => vaultAta(pubkey, new PublicKey(as.mint)).toBase58()),
  };
}

interface RawRegistry {
  count: number;
  baskets: PublicKey[];
}

/** Read the registry (1 account) → fetch each basket via getMultipleAccounts.
 *  Universally supported, unlike getProgramAccounts (which forked/public RPCs throttle). */
export async function fetchAllBaskets(program: Program<MiniSymmetry>): Promise<OnchainBasket[]> {
  const reg = (await program.account.registry.fetchNullable(registryPda())) as unknown as RawRegistry | null;
  if (!reg || reg.count === 0) return [];
  const pubkeys = reg.baskets.slice(0, reg.count);
  const accounts = (await program.account.basket.fetchMultiple(pubkeys)) as unknown as (RawBasket | null)[];
  return accounts
    .map((a, i) => (a ? decode(pubkeys[i]!, a) : null))
    .filter((b): b is OnchainBasket => b !== null)
    .sort((x, y) => x.id - y.id);
}
