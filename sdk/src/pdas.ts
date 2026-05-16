import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BASKET_SEED, PROGRAM_ID } from "./constants.js";

export const basketPda = (): PublicKey => PublicKey.findProgramAddressSync([BASKET_SEED], PROGRAM_ID)[0];

/** A basket vault is the ATA owned by the Basket PDA (allowOwnerOffCurve=true). */
export const vaultAta = (mint: PublicKey): PublicKey => getAssociatedTokenAddressSync(mint, basketPda(), true);
