import { type AccountMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ownerAta, supportedAssetPda, vaultAta, type OnchainAsset } from "./program";
import type { PoolEntry } from "./zap";

const ro = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
const wr = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });

export type PriceFor = (feedHex: string) => PublicKey;

/** rebalance_one: [price_i, price_q, <13 CPMM swap accts>, cpmm_program] (16).
 *  `buy` = swap quote -> asset (asset under-weight); else asset -> quote. */
export function rebalanceOneRemaining(
  basket: PublicKey,
  asset: OnchainAsset,
  quote: OnchainAsset,
  pool: PoolEntry,
  buy: boolean,
  priceFor: PriceFor,
  cpmmProgram: PublicKey,
): AccountMeta[] {
  const inMint = buy ? quote.mint : asset.mint;
  const outMint = buy ? asset.mint : quote.mint;
  const inIsToken0 = inMint.toBase58() === pool.token0Mint;
  const inPoolVault = new PublicKey(inIsToken0 ? pool.vault0 : pool.vault1);
  const outPoolVault = new PublicKey(inIsToken0 ? pool.vault1 : pool.vault0);
  return [
    ro(priceFor(asset.feedHex)),
    ro(priceFor(quote.feedHex)),
    ro(basket),
    ro(new PublicKey(pool.authority)),
    ro(new PublicKey(pool.configId)),
    wr(new PublicKey(pool.poolId)),
    wr(vaultAta(basket, inMint)),
    wr(vaultAta(basket, outMint)),
    wr(inPoolVault),
    wr(outPoolVault),
    ro(TOKEN_PROGRAM_ID),
    ro(TOKEN_PROGRAM_ID),
    ro(inMint),
    ro(outMint),
    wr(new PublicKey(pool.observation)),
    ro(cpmmProgram),
  ];
}

/** create_basket: per asset [mint, supportedAsset, vault]. */
export function createBasketRemaining(basket: PublicKey, mints: PublicKey[]): AccountMeta[] {
  return mints.flatMap((m) => [ro(m), ro(supportedAssetPda(m)), wr(vaultAta(basket, m))]);
}

/** deposit: [vault_0..n-1, price_0..n-1]. */
export function depositRemaining(basket: PublicKey, assets: OnchainAsset[], priceFor: PriceFor): AccountMeta[] {
  return [...assets.map((a) => wr(vaultAta(basket, a.mint))), ...assets.map((a) => ro(priceFor(a.feedHex)))];
}

/** deposit_assets: [userAta_0..n-1, vault_0..n-1, price_0..n-1]. */
export function depositAssetsRemaining(
  basket: PublicKey,
  user: PublicKey,
  assets: OnchainAsset[],
  priceFor: PriceFor,
): AccountMeta[] {
  return [
    ...assets.map((a) => wr(ownerAta(user, a.mint))),
    ...assets.map((a) => wr(vaultAta(basket, a.mint))),
    ...assets.map((a) => ro(priceFor(a.feedHex))),
  ];
}

/** withdraw: [vault_0..n-1, userAta_0..n-1]. */
export function withdrawRemaining(basket: PublicKey, user: PublicKey, assets: OnchainAsset[]): AccountMeta[] {
  return [...assets.map((a) => wr(vaultAta(basket, a.mint))), ...assets.map((a) => wr(ownerAta(user, a.mint)))];
}

/** rebalance: [vault_0..n-1, price_0..n-1, keeperReserve_0..n-1]. */
export function rebalanceRemaining(basket: PublicKey, keeper: PublicKey, assets: OnchainAsset[], priceFor: PriceFor): AccountMeta[] {
  return [
    ...assets.map((a) => wr(vaultAta(basket, a.mint))),
    ...assets.map((a) => ro(priceFor(a.feedHex))),
    ...assets.map((a) => wr(ownerAta(keeper, a.mint))),
  ];
}
