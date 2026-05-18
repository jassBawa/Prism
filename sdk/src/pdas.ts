import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ASSET_SEED, BASKET_SEED, MINT_SEED, PROGRAM_ID } from "./constants.js";

const u64le = (id: number | bigint): Buffer => new BN(id.toString()).toArrayLike(Buffer, "le", 8);

/** Basket PDA — one per (creator, id). */
export const basketPda = (creator: PublicKey, id: number | bigint): PublicKey =>
  PublicKey.findProgramAddressSync([BASKET_SEED, creator.toBuffer(), u64le(id)], PROGRAM_ID)[0];

/** Basket-token mint PDA — derived from the basket. */
export const basketMintPda = (basket: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([MINT_SEED, basket.toBuffer()], PROGRAM_ID)[0];

/** SupportedAsset allowlist PDA — one per mint. */
export const supportedAssetPda = (mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([ASSET_SEED, mint.toBuffer()], PROGRAM_ID)[0];

/** A basket vault is the ATA owned by the Basket PDA (allowOwnerOffCurve=true). */
export const vaultAta = (basket: PublicKey, mint: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, basket, true);

/** A keeper reserve / user account is the ATA owned by that wallet. */
export const ownerAta = (owner: PublicKey, mint: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, owner);
