import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// NAV time-series, persisted to DynamoDB so it survives keeper redeploys/restarts.
// Table: PK `basket` (S), SK `t` (N, ms epoch), attrs `nav` (N) + `ttl` (auto-expire).
// All DDB calls are best-effort with an in-memory fallback — history must never break
// the rebalance loop. In-memory only (no AWS creds) → still works for local dev.

export interface NavPoint {
  t: number; // ms epoch
  nav: number; // USD
}

const TABLE = process.env.NAV_HISTORY_TABLE ?? "mini-symmetry-nav-history";
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const MIN_GAP_MS = Number(process.env.HISTORY_MIN_GAP_MS ?? "60000"); // 1 point/min
const RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS ?? "30");
const WINDOW_MS = Number(process.env.HISTORY_WINDOW_MS ?? String(48 * 3600 * 1000)); // chart window
const MAX_POINTS = Number(process.env.HISTORY_MAX_POINTS ?? "3000");

let doc: DynamoDBDocumentClient | null = null;
function client(): DynamoDBDocumentClient {
  if (!doc) doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  return doc;
}

const lastWrite = new Map<string, number>(); // per-instance write throttle
const mem = new Map<string, NavPoint[]>(); // fallback / fast cache

/** Persist a NAV snapshot (throttled to 1/min). Best-effort: never throws. */
export async function recordNav(basket: string, nav: number): Promise<void> {
  if (!(nav > 0)) return;
  const now = Date.now();
  if (now - (lastWrite.get(basket) ?? 0) < MIN_GAP_MS) return;
  lastWrite.set(basket, now);

  const arr = mem.get(basket) ?? [];
  arr.push({ t: now, nav });
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  mem.set(basket, arr);

  try {
    await client().send(
      new PutCommand({
        TableName: TABLE,
        Item: { basket, t: now, nav, ttl: Math.floor(now / 1000) + RETENTION_DAYS * 86400 },
      }),
    );
  } catch (e) {
    console.warn("nav history write failed:", (e as Error).message);
  }
}

/** Read a basket's NAV series for the chart window (DDB → in-memory fallback). */
export async function navSeries(basket: string): Promise<NavPoint[]> {
  try {
    const res = await client().send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "basket = :b AND #t >= :s",
        ExpressionAttributeNames: { "#t": "t" },
        ExpressionAttributeValues: { ":b": basket, ":s": Date.now() - WINDOW_MS },
        ScanIndexForward: true,
        Limit: MAX_POINTS,
      }),
    );
    const pts = (res.Items ?? []).map((i) => ({ t: Number(i.t), nav: Number(i.nav) }));
    return pts.length ? pts : (mem.get(basket) ?? []);
  } catch (e) {
    console.warn("nav history read failed:", (e as Error).message);
    return mem.get(basket) ?? [];
  }
}

/** Map of in-memory series (cheap, no per-basket DDB query). */
export function allSeries(): Record<string, NavPoint[]> {
  return Object.fromEntries(mem);
}
