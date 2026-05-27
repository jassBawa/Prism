import type { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CurveCalculator, DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";

export type RaydiumCtx = Awaited<ReturnType<typeof Raydium.load>>;

/** Raydium SDK bound to devnet + an owner keypair. */
export async function loadRaydium(connection: Connection, owner: Keypair): Promise<RaydiumCtx> {
  return Raydium.load({ connection, owner, cluster: "devnet", disableLoadToken: true });
}

/** Devnet CPMM program id, pool-fee account, and config[0] pda — read at runtime, never hardcoded. */
export function cpmmIds(): { program: PublicKey; feeAcc: PublicKey; ammConfig: PublicKey } {
  const program = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;
  return {
    program,
    feeAcc: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    ammConfig: getCpmmPdaAmmConfigId(program, 0).publicKey,
  };
}

/** Build legacy CPMM swap instructions: swap `amountIn` of `inputMint` through `poolId`. */
export async function buildCpmmSwapIxs(
  raydium: RaydiumCtx,
  poolId: string,
  inputMint: string,
  amountIn: BN,
  slippageBps = 50,
): Promise<{ ixs: TransactionInstruction[]; expectedOut: BN }> {
  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId);
  const baseIn = inputMint === poolInfo.mintA.address;
  const inputReserve = baseIn ? rpcData.baseReserve : rpcData.quoteReserve;
  const outputReserve = baseIn ? rpcData.quoteReserve : rpcData.baseReserve;
  const cfg = rpcData.configInfo!;
  const swapResult = CurveCalculator.swapBaseInput(
    amountIn,
    inputReserve,
    outputReserve,
    cfg.tradeFeeRate,
    (cfg as any).creatorFeeRate ?? new BN(0),
    cfg.protocolFeeRate,
    cfg.fundFeeRate,
    (rpcData as any).isCreatorFeeOnInput ?? false,
  );
  const { transaction } = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount: amountIn,
    swapResult,
    slippage: slippageBps / 10000,
    baseIn,
    txVersion: TxVersion.LEGACY,
  });
  return { ixs: transaction.instructions, expectedOut: swapResult.outputAmount };
}
