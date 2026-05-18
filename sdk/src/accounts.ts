import type { AccountMeta, PublicKey } from "@solana/web3.js";
import { ownerAta, supportedAssetPda, vaultAta } from "./pdas.js";
import { pk, type AssetEntry } from "./config.js";

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
