import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { configExists, loadBasketsConfig } from "../sdk/src/config.js";
import { startKeeper } from "../keeper/loop.js";

// ---------------------------------------------------------------------------
// The dedicated mini-service: runs the keeper loop AND a self-serve faucet so a
// visitor (their own wallet) can get devnet SOL + test USDC with one click.
// Env: RPC_URL, ADMIN_SECRET_KEY (mint authority + keeper),
//      FAUCET_SOL_SECRET_KEY (separate small SOL wallet; falls back to admin),
//      FAUCET_USDC_MINT (test USDC mint; falls back to .keys/basket.json),
//      FAUCET_SOL (whole SOL per claim), FAUCET_USDC (whole USDC per claim),
//      ALLOW_ORIGIN (CORS), PORT.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? "8080");
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "*";
const SOL_PER_CLAIM = Number(process.env.FAUCET_SOL ?? "0.2");
const USDC_PER_CLAIM = Number(process.env.FAUCET_USDC ?? "1000");
const COOLDOWN_MS = Number(process.env.FAUCET_COOLDOWN_MS ?? `${12 * 60 * 60 * 1000}`);

function loadKp(envName: string, fallback: Keypair): Keypair {
  const v = process.env[envName]?.trim();
  if (!v) return fallback;
  const raw = v.startsWith("[") ? v : readFileSync(v, "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

function usdcMint(): PublicKey {
  if (process.env.FAUCET_USDC_MINT) return new PublicKey(process.env.FAUCET_USDC_MINT);
  if (configExists()) return new PublicKey(loadBasketsConfig().mints.usdc!);
  throw new Error("set FAUCET_USDC_MINT (or run from a repo with .keys/basket.json)");
}

const conn: Connection = getConnection();
const admin = loadKeypair(); // mint authority + keeper signer
const faucetSol = loadKp("FAUCET_SOL_SECRET_KEY", admin); // small SOL wallet, ideally separate
const USDC = usdcMint();

const lastClaim = new Map<string, number>(); // key (pubkey|ip) -> ms

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}
function json(res: ServerResponse, code: number, body: unknown): void {
  cors(res);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function rateLimited(keys: string[]): boolean {
  const now = Date.now();
  for (const k of keys) {
    const last = lastClaim.get(k) ?? 0;
    if (now - last < COOLDOWN_MS) return true;
  }
  for (const k of keys) lastClaim.set(k, now);
  return false;
}

async function fund(owner: PublicKey): Promise<{ sol: string; usdc: string }> {
  // SOL: transfer from the faucet wallet (NOT requestAirdrop — flaky/rate-limited).
  const solTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: faucetSol.publicKey, toPubkey: owner, lamports: Math.round(SOL_PER_CLAIM * 1e9) }),
  );
  const solSig = await sendAndConfirmTransaction(conn, solTx, [faucetSol], { commitment: "confirmed" });
  // USDC: admin (mint authority) mints test USDC into the visitor's ATA.
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, USDC, owner);
  const usdcSig = await mintTo(conn, admin, USDC, ata.address, admin, BigInt(Math.round(USDC_PER_CLAIM)) * 1_000_000n);
  return { sol: solSig, usdc: usdcSig };
}

async function handleFaucet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body = "";
  for await (const chunk of req) body += chunk;
  let owner: PublicKey;
  try {
    owner = new PublicKey((JSON.parse(body || "{}") as { pubkey?: string }).pubkey ?? "");
  } catch {
    return json(res, 400, { error: "invalid pubkey" });
  }
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "ip";
  if (rateLimited([`pk:${owner.toBase58()}`, `ip:${ip}`])) {
    return json(res, 429, { error: "already claimed — try again later" });
  }
  try {
    const sigs = await fund(owner);
    console.log(`faucet → ${owner.toBase58()} : ${SOL_PER_CLAIM} SOL + ${USDC_PER_CLAIM} USDC`);
    json(res, 200, { ok: true, sol: SOL_PER_CLAIM, usdc: USDC_PER_CLAIM, sigs });
  } catch (e) {
    // failed claim shouldn't burn the cooldown
    lastClaim.delete(`pk:${owner.toBase58()}`);
    json(res, 500, { error: (e as Error).message });
  }
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
  if (req.method === "POST" && req.url === "/faucet") {
    void handleFaucet(req, res);
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`ops: faucet on :${PORT} | admin ${admin.publicKey.toBase58()} | faucetSOL ${faucetSol.publicKey.toBase58()} | USDC ${USDC.toBase58()}`);
});

// keeper runs in the same process (the host runs one thing).
void startKeeper();
