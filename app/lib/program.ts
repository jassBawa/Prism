import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "./idl.json";
import type { MiniSymmetry } from "./mini_symmetry";
import { PROGRAM_ID, RPC_URL, supportedByFeedHex } from "./constants";

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

const u64le = (id: number): Buffer => new BN(id).toArrayLike(Buffer, "le", 8);

export const basketPda = (creator: PublicKey, id: number): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("basket"), creator.toBuffer(), u64le(id)],
    PROGRAM_ID,
  )[0];
export const basketMintPda = (basket: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), basket.toBuffer()],
    PROGRAM_ID,
  )[0];
export const supportedAssetPda = (mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("asset"), mint.toBuffer()],
    PROGRAM_ID,
  )[0];
export const registryPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID)[0];
export const vaultAta = (basket: PublicKey, mint: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, basket, true);
export const ownerAta = (owner: PublicKey, mint: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, owner);

/** Read-only program (dummy wallet) for fetching account data. */
export function getReadProgram(
  connection: Connection = getConnection(),
): Program<MiniSymmetry> {
  const dummy = new AnchorProvider(
    connection,
    { publicKey: Keypair.generate().publicKey } as unknown as Wallet,
    {
      commitment: "confirmed",
    },
  );
  return new Program<MiniSymmetry>(idl as MiniSymmetry, dummy);
}

/** A connected browser wallet (subset of anchor's Wallet — no `payer`). */
export type WalletLike = Pick<
  Wallet,
  "publicKey" | "signTransaction" | "signAllTransactions"
>;

/** Program bound to a connected wallet for signing. */
export function getProgram(
  wallet: WalletLike,
  connection: Connection = getConnection(),
): Program<MiniSymmetry> {
  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment: "confirmed",
  });
  return new Program<MiniSymmetry>(idl as MiniSymmetry, provider);
}

export interface OnchainAsset {
  mint: PublicKey;
  targetWeightBps: number;
  feedHex: string;
  decimals: number;
  symbol: string;
}

export interface BasketView {
  pubkey: PublicKey;
  authority: PublicKey;
  basketMint: PublicKey;
  id: number;
  name: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  createdTs: number;
  numAssets: number;
  quoteIndex: number;
  assets: OnchainAsset[];
  thresholdBps: number;
  thresholdRelBps: number;
  spreadBps: number;
  feeBps: number;
  intervalSecs: number;
  lastRebalanceTs: number;
  paused: boolean;
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
  name: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  createdTs: BN;
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

interface RawRegistry {
  count: number;
  baskets: PublicKey[];
}

const toHex = (bytes: number[]): string => Buffer.from(bytes).toString("hex");

function decodeBasket(pubkey: PublicKey, a: RawBasket): BasketView {
  const n = a.numAssets;
  const assets: OnchainAsset[] = a.assets.slice(0, n).map((x) => {
    const feedHex = toHex(x.feedId);
    return {
      mint: x.mint,
      targetWeightBps: x.targetWeightBps,
      feedHex,
      decimals: x.decimals,
      symbol: supportedByFeedHex(feedHex)?.symbol ?? "?",
    };
  });
  return {
    pubkey,
    authority: a.authority,
    basketMint: a.basketMint,
    id: a.id.toNumber(),
    name: a.name,
    description: a.description,
    website: a.website,
    twitter: a.twitter,
    telegram: a.telegram,
    discord: a.discord,
    createdTs: a.createdTs.toNumber(),
    numAssets: n,
    quoteIndex: a.quoteIndex,
    assets,
    thresholdBps: a.rebalanceThresholdBps,
    thresholdRelBps: a.rebalanceThresholdRelBps,
    spreadBps: a.rebalanceSpreadBps,
    feeBps: a.depositFeeBps,
    intervalSecs: a.rebalanceIntervalSecs.toNumber(),
    lastRebalanceTs: a.lastRebalanceTs.toNumber(),
    paused: a.paused,
  };
}

/** Read the registry (1 account) → fetch each basket via getMultipleAccounts.
 * Avoids getProgramAccounts, which forked/public RPCs throttle or don't serve. */
export async function fetchAllBaskets(
  program: Program<MiniSymmetry>,
): Promise<BasketView[]> {
  const reg = (await program.account.registry.fetchNullable(
    registryPda(),
  )) as unknown as RawRegistry | null;
  if (!reg || reg.count === 0) return [];
  const pubkeys = reg.baskets.slice(0, reg.count);
  // Decode each account individually so one undecodable entry (e.g. a basket from a
  // pre-upgrade layout) is skipped rather than failing the whole batch.
  const infos = await program.provider.connection.getMultipleAccountsInfo(pubkeys);
  const out: BasketView[] = [];
  infos.forEach((info, i) => {
    if (!info) return;
    try {
      const a = program.coder.accounts.decode<RawBasket>("basket", info.data);
      out.push(decodeBasket(pubkeys[i]!, a));
    } catch {
      /* stale/old-layout basket — skip */
    }
  });
  return out.sort((x, y) => x.id - y.id);
}
