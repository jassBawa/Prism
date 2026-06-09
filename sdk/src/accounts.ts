import type { AccountMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ownerAta, supportedAssetPda, vaultAta } from "./pdas.js";
import { pk, type AssetEntry, type PoolEntry } from "./config.js";

const ro = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
const wr = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });

export type PriceFor = (feedHex: string) => PublicKey;

/** create_basket: per asset [mint, supportedAsset, vault]. */
export function createBasketRemaining(basket: PublicKey, assetMints: PublicKey[]): AccountMeta[] {
  return assetMints.flatMap((mint) => [ro(mint), ro(supportedAssetPda(mint)), wr(vaultAta(basket, mint))]);
}

/** deposit: [vault_0..n-1, price_0..n-1]. */
export function depositRemaining(basket: PublicKey, assets: AssetEntry[], priceFor: PriceFor): AccountMeta[] {
  return [...assets.map((a) => wr(vaultAta(basket, pk(a.mint)))), ...assets.map((a) => ro(priceFor(a.feed)))];
}

/** deposit_assets: [userAta_0..n-1, vault_0..n-1, price_0..n-1]. */
export function depositAssetsRemaining(basket: PublicKey, user: PublicKey, assets: AssetEntry[], priceFor: PriceFor): AccountMeta[] {
  return [
    ...assets.map((a) => wr(ownerAta(user, pk(a.mint)))),
    ...assets.map((a) => wr(vaultAta(basket, pk(a.mint)))),
    ...assets.map((a) => ro(priceFor(a.feed))),
  ];
}

/** rebalance_one: [vault_0..n-1, price_0..n-1, <13 CPMM swap accts>, cpmm_program] (2n+14).
 *  The vault+price prefix (all assets, in order) lets the program compute full NAV and
 *  size the leg to its NAV share — one-pass convergence. `assets` MUST be in basket order.
 *  `buy` = swap quote -> asset (asset under-weight); else asset -> quote. */
export function rebalanceOneRemaining(
  basket: PublicKey,
  assets: AssetEntry[],
  asset: AssetEntry,
  quote: AssetEntry,
  pool: PoolEntry,
  buy: boolean,
  priceFor: PriceFor,
  cpmmProgram: PublicKey,
): AccountMeta[] {
  const inMint = buy ? pk(quote.mint) : pk(asset.mint);
  const outMint = buy ? pk(asset.mint) : pk(quote.mint);
  const inIsToken0 = inMint.toBase58() === pool.token0Mint;
  const inPoolVault = pk(inIsToken0 ? pool.vault0 : pool.vault1);
  const outPoolVault = pk(inIsToken0 ? pool.vault1 : pool.vault0);
  return [
    ...assets.map((a) => ro(vaultAta(basket, pk(a.mint)))), // vault_0..n-1 (NAV read)
    ...assets.map((a) => ro(priceFor(a.feed))), // price_0..n-1 (NAV + swap pricing)
    ro(basket), //  0 payer (basket PDA — signs the CPI internally)
    ro(pk(pool.authority)), //  1 authority
    ro(pk(pool.configId)), //  2 amm_config
    wr(pk(pool.poolId)), //  3 pool_state
    wr(vaultAta(basket, inMint)), //  4 input_token_account (basket vault)
    wr(vaultAta(basket, outMint)), //  5 output_token_account
    wr(inPoolVault), //  6 input_vault (pool)
    wr(outPoolVault), //  7 output_vault (pool)
    ro(TOKEN_PROGRAM_ID), //  8 input_token_program
    ro(TOKEN_PROGRAM_ID), //  9 output_token_program
    ro(inMint), // 10 input_mint
    ro(outMint), // 11 output_mint
    wr(pk(pool.observation)), // 12 observation_state
    ro(cpmmProgram),
  ];
}

/** withdraw: [vault_0..n-1, userAta_0..n-1]. */
export function withdrawRemaining(basket: PublicKey, user: PublicKey, assets: AssetEntry[]): AccountMeta[] {
  return [...assets.map((a) => wr(vaultAta(basket, pk(a.mint)))), ...assets.map((a) => wr(ownerAta(user, pk(a.mint))))];
}

/** rebalance: [vault_0..n-1, price_0..n-1, reserve_0..n-1]. */
export function rebalanceRemaining(basket: PublicKey, keeper: PublicKey, assets: AssetEntry[], priceFor: PriceFor): AccountMeta[] {
  return [
    ...assets.map((a) => wr(vaultAta(basket, pk(a.mint)))),
    ...assets.map((a) => ro(priceFor(a.feed))),
    ...assets.map((a) => wr(ownerAta(keeper, pk(a.mint)))),
  ];
}
