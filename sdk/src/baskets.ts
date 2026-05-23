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
  thresholdRelBps: number;
  spreadBps: number;
  feeBps: number;
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
  rebalanceThresholdRelBps: number;
  rebalanceSpreadBps: number;
  depositFeeBps: number;
  rebalanceIntervalSecs: BN;
  lastRebalanceTs: BN;
  paused: boolean;
}

const toHex = (b: number[]): string => Buffer.from(b).toString("hex");

function decode(pubkey: PublicKey, a: RawBasket): OnchainBasket {
  const assets: AssetEntry[] = a.assets.slice(0, a.numAssets).map((x) => {
    const feed = toHex(x.feedId);
    return {
      key: supportedByFeed(feed)?.key ?? feed.slice(0, 6),
      mint: x.mint.toBase58(),
      feed,
      decimals: x.decimals,
      weightBps: x.targetWeightBps,
    };
  });
  return {
    pubkey,
    authority: a.authority,
    basketMint: a.basketMint,
    id: a.id.toNumber(),
    quoteIndex: a.quoteIndex,
    thresholdBps: a.rebalanceThresholdBps,
    thresholdRelBps: a.rebalanceThresholdRelBps,
    spreadBps: a.rebalanceSpreadBps,
    feeBps: a.depositFeeBps,
    intervalSecs: a.rebalanceIntervalSecs.toNumber(),
    lastRebalanceTs: a.lastRebalanceTs.toNumber(),
    paused: a.paused,
    assets,
    vaults: assets.map((as) =>
      vaultAta(pubkey, new PublicKey(as.mint)).toBase58(),
    ),
  };
}

interface RawRegistry {
  count: number;
  baskets: PublicKey[];
}

/** Read the registry (1 account) → fetch each basket via getMultipleAccounts.
 *  Universally supported, unlike getProgramAccounts (which forked/public RPCs throttle). */
export async function fetchAllBaskets(
  program: Program<MiniSymmetry>,
): Promise<OnchainBasket[]> {
  const reg = (await program.account.registry.fetchNullable(
    registryPda(),
  )) as unknown as RawRegistry | null;
  if (!reg || reg.count === 0) return [];
  const pubkeys = reg.baskets.slice(0, reg.count);
  // Decode each account individually so one undecodable entry (e.g. a basket from a
  // pre-upgrade layout) is skipped rather than failing the whole batch.
  const infos = await program.provider.connection.getMultipleAccountsInfo(pubkeys);
  const out: OnchainBasket[] = [];
  infos.forEach((info, i) => {
    if (!info) return;
    try {
      const a = program.coder.accounts.decode<RawBasket>("basket", info.data);
      out.push(decode(pubkeys[i]!, a));
    } catch {
      /* stale/old-layout basket — skip */
    }
  });
  return out.sort((x, y) => x.id - y.id);
}
