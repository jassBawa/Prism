import type { AccountMeta, PublicKey } from "@solana/web3.js";
import { ownerAta, supportedAssetPda, vaultAta, type OnchainAsset } from "./program";

const ro = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
const wr = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });

export type PriceFor = (feedHex: string) => PublicKey;

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
