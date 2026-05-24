import { createServer, type ServerResponse } from "node:http";
import { startKeeper } from "../keeper/loop.js";

// ---------------------------------------------------------------------------
// Hosted keeper service: runs the auto-rebalance loop and exposes a /health
// endpoint so a host (Railway / Fly / Render) can liveness-check it.
// Env: RPC_URL, ADMIN_SECRET_KEY (mint authority + keeper signer), KEEPER_POLL_MS, PORT.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? "8080");

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health")
    return json(res, 200, { ok: true });
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`ops: keeper service on :${PORT}`);
});

// keeper runs in the same process (the host runs one thing).
void startKeeper();
