// The faucet lives on the ops/keeper service (it holds the mint authority). The app
// only POSTs the connected wallet; minting + the SOL drip happen server-side.
export const FAUCET_URL =
  process.env.NEXT_PUBLIC_FAUCET_URL || "https://dumu5nrubz.us-east-1.awsapprunner.com";

export interface FaucetResponse {
  ok?: boolean;
  usdc?: number;
  sol?: number;
  usdcSig?: string;
  solSig?: string | null;
  error?: string;
  retryAfterSec?: number;
}

/** Request test USDC (+ SOL drip) for `wallet` from the hosted faucet. */
export async function claimFaucet(wallet: string): Promise<FaucetResponse> {
  const res = await fetch(`${FAUCET_URL}/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  return (await res.json()) as FaucetResponse;
}
