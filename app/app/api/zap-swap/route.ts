import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CurveCalculator, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

interface Item {
  poolId: string;
  inputMint: string;
  amountInRaw: string; // raw u64 string
}
interface Body {
  ownerPubkey: string;
  items: Item[];
  slippageBps?: number;
  rpc?: string; // the chain the client is on (pools are devnet)
}

type SerIx = { programId: string; keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };

/** Build Raydium CPMM swap instructions server-side (keeps the heavy SDK off the client). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const owner = new PublicKey(body.ownerPubkey);
    const slippage = (body.slippageBps ?? 80) / 10000;
    const connection = new Connection(body.rpc || RPC, "confirmed");
    const raydium = await Raydium.load({ connection, owner, cluster: "devnet", disableLoadToken: true });

    const ixs: SerIx[] = [];
    const expected: string[] = [];
    for (const it of body.items) {
      const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(it.poolId);
      const baseIn = it.inputMint === poolInfo.mintA.address;
      const cfg = rpcData.configInfo!;
      const amountIn = new BN(it.amountInRaw);
      const swapResult = CurveCalculator.swapBaseInput(
        amountIn,
        baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
        baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
        cfg.tradeFeeRate,
        (cfg as unknown as { creatorFeeRate?: BN }).creatorFeeRate ?? new BN(0),
        cfg.protocolFeeRate,
        cfg.fundFeeRate,
        (rpcData as unknown as { isCreatorFeeOnInput?: boolean }).isCreatorFeeOnInput ?? false,
      );
      const { transaction } = await raydium.cpmm.swap({
        poolInfo,
        poolKeys,
        inputAmount: amountIn,
        swapResult,
        slippage,
        baseIn,
        txVersion: TxVersion.LEGACY,
      });
      for (const ix of transaction.instructions) {
        ixs.push({
          programId: ix.programId.toBase58(),
          keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
          data: Buffer.from(ix.data).toString("base64"),
        });
      }
      expected.push(swapResult.outputAmount.toString());
    }
    return NextResponse.json({ ixs, expected });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
