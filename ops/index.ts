import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { startKeeper } from "../keeper/loop.js";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { runFaucet } from "./faucet.js";
import { allSeries, navSeries } from "../keeper/history.js";

// ---------------------------------------------------------------------------
// Hosted keeper service: runs the auto-rebalance loop and exposes
//   GET  /health  → liveness for the host (Railway / Fly / Render / App Runner)
//   POST /faucet  → mint test USDC (+ SOL drip) to a wallet for the devnet demo
// Env: RPC_URL, ADMIN_SECRET_KEY (mint authority + keeper signer), KEEPER_POLL_MS,
//      PORT, ALLOW_ORIGIN, FAUCET_USDC_MINT, FAUCET_USDC, FAUCET_SOL.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? "8080");
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "*";

// Shared signer + connection for the faucet (the keeper loads its own internally).
const conn = getConnection();
const admin = loadKeypair();

function cors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", ALLOW_ORIGIN);
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function json(res: ServerResponse, code: number, body: unknown): void {
  cors(res);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.method === "OPTIONS") {
        cors(res);
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
      if (req.method === "GET" && req.url?.startsWith("/history")) {
        const basket = new URL(req.url, "http://x").searchParams.get("basket");
        if (basket) return json(res, 200, { basket, points: await navSeries(basket) });
        return json(res, 200, allSeries());
      }
      if (req.method === "POST" && req.url === "/faucet") {
        const body = (await readBody(req)) as { wallet?: string };
        if (!body?.wallet) return json(res, 400, { error: "missing wallet" });
        const result = await runFaucet(conn, admin, body.wallet);
        return json(res, result.status, result.body);
      }
      json(res, 404, { error: "not found" });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  })();
});

server.listen(PORT, () => {
  console.log(`ops: keeper service on :${PORT}`);
});

// keeper runs in the same process (the host runs one thing).
void startKeeper();
