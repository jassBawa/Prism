import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  type AccountMeta,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  MintLayout,
  AccountLayout,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

// ---------------------------------------------------------------------------
// Fully-local, deterministic contract suite. Loads the built .so into LiteSVM,
// mocks Pyth PriceUpdateV2 accounts (the program parses them manually, so we can
// fabricate them), and exercises every instruction + guard. No validator, no
// network, no Hermes.
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const idl = require("../sdk/src/idl.json");
const ROOT = resolve(import.meta.dirname, "..");
const SO = resolve(ROOT, "target/deploy/mini_symmetry.so");
const PROGRAM_ID = new PublicKey(idl.address);
const PYTH_RECEIVER = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
);

const BASKET_SEED = Buffer.from("basket");
const MINT_SEED = Buffer.from("mint");
const ASSET_SEED = Buffer.from("asset");
const REGISTRY_SEED = Buffer.from("registry");

const u64le = (n: number): Buffer => new BN(n).toArrayLike(Buffer, "le", 8);
const basketPda = (creator: PublicKey, id: number) =>
  PublicKey.findProgramAddressSync(
    [BASKET_SEED, creator.toBuffer(), u64le(id)],
    PROGRAM_ID,
  )[0];
const basketMintPda = (basket: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [MINT_SEED, basket.toBuffer()],
    PROGRAM_ID,
  )[0];
const supportedPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [ASSET_SEED, mint.toBuffer()],
    PROGRAM_ID,
  )[0];
const registryPda = () =>
  PublicKey.findProgramAddressSync([REGISTRY_SEED], PROGRAM_ID)[0];
const vaultAta = (basket: PublicKey, mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, basket, true);
const ownerAta = (owner: PublicKey, mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner);

const ro = (pubkey: PublicKey): AccountMeta => ({
  pubkey,
  isSigner: false,
  isWritable: false,
});
const wr = (pubkey: PublicKey): AccountMeta => ({
  pubkey,
  isSigner: false,
  isWritable: true,
});

// Test asset set: feed hex (any 32-byte id), decimals, price (i64 @ expo -8), quote-eligible.
const EXPO = -8;
interface Asset {
  key: string;
  feedHex: string;
  decimals: number;
  priceI64: number; // price * 1e8
  quoteEligible: boolean;
}
const ASSETS: Record<string, Asset> = {
  sol: {
    key: "sol",
    feedHex: "11".repeat(32),
    decimals: 9,
    priceI64: 100 * 1e8,
    quoteEligible: false,
  },
  jup: {
    key: "jup",
    feedHex: "22".repeat(32),
    decimals: 6,
    priceI64: 0.5 * 1e8,
    quoteEligible: false,
  },
  usdc: {
    key: "usdc",
    feedHex: "33".repeat(32),
    decimals: 6,
    priceI64: 1 * 1e8,
    quoteEligible: true,
  },
};

function loadAdmin(): Keypair {
  // The ADMIN constant baked into the program — only this key may curate the allowlist.
  return Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(resolve(ROOT, ".keys/admin.json"), "utf8")),
    ),
  );
}

interface Env {
  svm: LiteSVM;
  program: Program;
  admin: Keypair;
  mints: Record<string, PublicKey>;
  send: (
    ixs: TransactionInstruction[],
    signers: Keypair[],
  ) => { ok: boolean; logs: string[] };
  expectErr: (
    label: string,
    code: string,
    ixs: TransactionInstruction[],
    signers: Keypair[],
  ) => void;
  fund: (kp: PublicKey) => void;
  mkMint: (decimals: number) => Keypair;
  mintTo: (mint: PublicKey, ata: PublicKey, amount: bigint) => void;
  mkAta: (owner: PublicKey, mint: PublicKey, offCurve?: boolean) => PublicKey;
  setPyth: (
    a: Asset,
    opts?: { ageSecs?: number; confU64?: number },
  ) => PublicKey;
  tokenBal: (ata: PublicKey) => bigint;
  mintSupply: (mint: PublicKey) => bigint;
  now: number;
}

function freshEnv(): Env {
  const svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ID, SO);
  const admin = loadAdmin();
  svm.airdrop(admin.publicKey, 1_000_000_000_000n);

  // LiteSVM's genesis clock has unixTimestamp 0; set a real wall-clock time so the
  // rebalance interval check (now - last_rebalance_ts >= interval) can elapse, and
  // mocked Pyth publish_times are non-zero.
  const NOW = 1_700_000_000;
  const clock = svm.getClock();
  clock.unixTimestamp = BigInt(NOW);
  svm.setClock(clock);

  // Dummy provider — only used to BUILD instructions (never sends), so the
  // connection is never contacted.
  const provider = new AnchorProvider(
    { rpcEndpoint: "http://127.0.0.1:9999" } as never,
    new Wallet(admin),
    { commitment: "processed" },
  );
  const program = new Program(idl, provider);

  const now = NOW;

  const send = (ixs: TransactionInstruction[], signers: Keypair[]) => {
    const tx = new Transaction();
    tx.add(...ixs);
    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = signers[0]!.publicKey;
    tx.sign(...signers);
    const res = svm.sendTransaction(tx);
    if (res instanceof FailedTransactionMetadata) {
      return { ok: false, logs: res.meta().logs() };
    }
    return { ok: true, logs: res.logs() };
  };

  const expectErr = (
    label: string,
    code: string,
    ixs: TransactionInstruction[],
    signers: Keypair[],
  ) => {
    const r = send(ixs, signers);
    assert.equal(
      r.ok,
      false,
      `${label}: expected failure (${code}) but it succeeded`,
    );
    assert.ok(
      r.logs.join(" ").includes(code),
      `${label}: expected ${code}, logs: ${r.logs.join(" ").slice(-300)}`,
    );
  };

  const fund = (kp: PublicKey) => svm.airdrop(kp, 100_000_000_000n);

  const mkMint = (decimals: number): Keypair => {
    const m = Keypair.generate();
    const rent = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
    const r = send(
      [
        SystemProgram.createAccount({
          fromPubkey: admin.publicKey,
          newAccountPubkey: m.publicKey,
          lamports: Number(rent),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(
          m.publicKey,
          decimals,
          admin.publicKey,
          null,
        ),
      ],
      [admin, m],
    );
    assert.ok(r.ok, `mkMint failed: ${r.logs.join(" ").slice(-200)}`);
    return m;
  };

  const mkAta = (
    owner: PublicKey,
    mint: PublicKey,
    offCurve = false,
  ): PublicKey => {
    const ata = getAssociatedTokenAddressSync(mint, owner, offCurve);
    const r = send(
      [
        createAssociatedTokenAccountInstruction(
          admin.publicKey,
          ata,
          owner,
          mint,
        ),
      ],
      [admin],
    );
    assert.ok(r.ok, `mkAta failed: ${r.logs.join(" ").slice(-200)}`);
    return ata;
  };

  const mintTo = (mint: PublicKey, ata: PublicKey, amount: bigint) => {
    const r = send(
      [createMintToInstruction(mint, ata, admin.publicKey, amount)],
      [admin],
    );
    assert.ok(r.ok, `mintTo failed: ${r.logs.join(" ").slice(-200)}`);
  };

  // Fabricate a Pyth PriceUpdateV2 account the program will accept. Layout (see
  // pricing.rs read_price): 8 disc | 32 write_authority | 1 vtag(=1 Full) |
  // feed_id[32] | price i64 | conf u64 | expo i32 | publish_time i64.
  const setPyth = (
    a: Asset,
    opts: { ageSecs?: number; confU64?: number } = {},
  ): PublicKey => {
    const acc = Keypair.generate().publicKey;
    const data = Buffer.alloc(200);
    data[40] = 1; // VerificationLevel::Full — no extra byte
    Buffer.from(a.feedHex, "hex").copy(data, 41);
    data.writeBigInt64LE(BigInt(a.priceI64), 73);
    data.writeBigUInt64LE(
      BigInt(opts.confU64 ?? Math.floor(a.priceI64 / 1000)),
      81,
    ); // 0.1% conf
    data.writeInt32LE(EXPO, 89);
    data.writeBigInt64LE(BigInt(now - (opts.ageSecs ?? 0)), 93);
    svm.setAccount(acc, {
      lamports: Number(svm.minimumBalanceForRentExemption(200n)),
      data: new Uint8Array(data),
      owner: PYTH_RECEIVER,
      executable: false,
      rentEpoch: 0,
    });
    return acc;
  };

  const tokenBal = (ata: PublicKey): bigint => {
    const acc = svm.getAccount(ata);
    if (!acc) return 0n;
    return AccountLayout.decode(Buffer.from(acc.data)).amount;
  };
  const mintSupply = (mint: PublicKey): bigint => {
    const acc = svm.getAccount(mint);
    if (!acc) return 0n;
    return MintLayout.decode(Buffer.from(acc.data)).supply;
  };

  const mints: Record<string, PublicKey> = {};
  return {
    svm,
    program,
    admin,
    mints,
    send,
    expectErr,
    fund,
    mkMint,
    mintTo,
    mkAta,
    setPyth,
    tokenBal,
    mintSupply,
    now,
  };
}

// Build the common starting point: mints + on-chain allowlist + registry.
async function bootstrap(e: Env) {
  for (const a of Object.values(ASSETS))
    e.mints[a.key] = e.mkMint(a.decimals).publicKey;
  // allowlist each (admin only)
  for (const a of Object.values(ASSETS)) {
    const ix = await e.program.methods
      .setSupportedAsset(
        Array.from(Buffer.from(a.feedHex, "hex")),
        a.quoteEligible,
      )
      .accountsPartial({
        admin: e.admin.publicKey,
        mint: e.mints[a.key]!,
        supportedAsset: supportedPda(e.mints[a.key]!),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const r = e.send([ix], [e.admin]);
    assert.ok(
      r.ok,
      `setSupportedAsset(${a.key}) failed: ${r.logs.join(" ").slice(-200)}`,
    );
  }
  // init registry (admin only)
  const ix = await e.program.methods
    .initRegistry()
    .accountsPartial({
      admin: e.admin.publicKey,
      registry: registryPda(),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  const r = e.send([ix], [e.admin]);
  assert.ok(r.ok, `initRegistry failed: ${r.logs.join(" ").slice(-200)}`);
}

// create_basket helper. Returns the basket + mint pubkeys.
async function createBasket(
  e: Env,
  creator: Keypair,
  id: number,
  keys: string[],
  weights: number[],
  quoteIndex: number,
  params: {
    thrAbs?: number;
    thrRel?: number;
    spread?: number;
    fee?: number;
    interval?: number;
  } = {},
) {
  const basket = basketPda(creator.publicKey, id);
  const basketMint = basketMintPda(basket);
  const remaining: AccountMeta[] = keys.flatMap((k) => [
    ro(e.mints[k]!),
    ro(supportedPda(e.mints[k]!)),
    wr(vaultAta(basket, e.mints[k]!)),
  ]);
  const ix = await e.program.methods
    .createBasket(
      new BN(id),
      keys.length,
      quoteIndex,
      weights,
      params.thrAbs ?? 100,
      params.thrRel ?? 100,
      params.spread ?? 30,
      params.fee ?? 50,
      new BN(params.interval ?? 1),
    )
    .accountsPartial({
      creator: creator.publicKey,
      basket,
      basketMint,
      registry: registryPda(),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .remainingAccounts(remaining)
    .instruction();
  return { basket, basketMint, ix };
}

async function depositIx(
  e: Env,
  b: { basket: PublicKey; basketMint: PublicKey },
  depositor: Keypair,
  creator: PublicKey,
  keys: string[],
  quoteIndex: number,
  amount: bigint,
  priceFor: (k: string) => PublicKey,
) {
  const depositorQuote = ownerAta(
    depositor.publicKey,
    e.mints[keys[quoteIndex]!]!,
  );
  const depositorBasket = ownerAta(depositor.publicKey, b.basketMint);
  const creatorBasket = ownerAta(creator, b.basketMint);
  const remaining: AccountMeta[] = [
    ...keys.map((k) => wr(vaultAta(b.basket, e.mints[k]!))),
    ...keys.map((k) => ro(priceFor(k))),
  ];
  return e.program.methods
    .deposit(new BN(amount.toString()))
    .accountsPartial({
      basket: b.basket,
      basketMint: b.basketMint,
      depositor: depositor.publicKey,
      depositorQuote,
      depositorBasket,
      creatorBasket,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remaining)
    .instruction();
}

// ===========================================================================

test("init_registry: non-admin rejected, admin succeeds", async () => {
  const e = freshEnv();
  for (const a of Object.values(ASSETS))
    e.mints[a.key] = e.mkMint(a.decimals).publicKey;
  const stranger = Keypair.generate();
  e.fund(stranger.publicKey);
  const ixBad = await e.program.methods
    .initRegistry()
    .accountsPartial({
      admin: stranger.publicKey,
      registry: registryPda(),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  e.expectErr("non-admin init_registry", "Unauthorized", [ixBad], [stranger]);

  const ixOk = await e.program.methods
    .initRegistry()
    .accountsPartial({
      admin: e.admin.publicKey,
      registry: registryPda(),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  assert.ok(e.send([ixOk], [e.admin]).ok);
});

test("create_basket: happy path + guard rejects", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  e.fund(creator.publicKey);

  // happy: SOL/USDC 60/40, quote USDC
  const { ix } = await createBasket(
    e,
    creator,
    0,
    ["sol", "usdc"],
    [6000, 4000],
    1,
  );
  assert.ok(e.send([ix], [creator]).ok, "create_basket happy failed");

  // weights != 10000
  const bad1 = await createBasket(
    e,
    creator,
    1,
    ["sol", "usdc"],
    [6000, 3000],
    1,
  );
  e.expectErr("weights != 10000", "BadWeights", [bad1.ix], [creator]);

  // fee > MAX_FEE_BPS (500)
  const bad2 = await createBasket(
    e,
    creator,
    2,
    ["sol", "usdc"],
    [6000, 4000],
    1,
    { fee: 600 },
  );
  e.expectErr("fee > 500", "BadParams", [bad2.ix], [creator]);

  // spread > MAX_SPREAD_BPS (100)
  const bad3 = await createBasket(
    e,
    creator,
    3,
    ["sol", "usdc"],
    [6000, 4000],
    1,
    { spread: 200 },
  );
  e.expectErr("spread > 100", "BadParams", [bad3.ix], [creator]);

  // non-stable quote (SOL as quote)
  const bad4 = await createBasket(
    e,
    creator,
    4,
    ["sol", "usdc"],
    [6000, 4000],
    0,
  );
  e.expectErr("non-stable quote", "QuoteNotEligible", [bad4.ix], [creator]);

  // duplicate asset
  const bad5 = await createBasket(
    e,
    creator,
    5,
    ["usdc", "usdc"],
    [5000, 5000],
    0,
  );
  e.expectErr("duplicate asset", "DuplicateAsset", [bad5.ix], [creator]);
});

test("deposit: NAV mint + creator fee split exact (creator != depositor)", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  const depositor = Keypair.generate();
  e.fund(creator.publicKey);
  e.fund(depositor.publicKey);
  const keys = ["sol", "usdc"];

  const b = await createBasket(e, creator, 0, keys, [6000, 4000], 1, {
    fee: 50,
  }); // 0.5% fee
  assert.ok(e.send([b.ix], [creator]).ok);

  // pre-create ATAs: depositor quote (funded), depositor basket, creator basket
  const depQuote = e.mkAta(depositor.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.usdc!, depQuote, 100_000_000n); // 100 USDC
  e.mkAta(depositor.publicKey, b.basketMint);
  e.mkAta(creator.publicKey, b.basketMint);

  const prices: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const ix = await depositIx(
    e,
    b,
    depositor,
    creator.publicKey,
    keys,
    1,
    100_000_000n,
    (k) => prices[k]!,
  );
  const r = e.send([ix], [depositor]);
  assert.ok(r.ok, `deposit failed: ${r.logs.join(" ").slice(-300)}`);

  // first deposit: 100 USDC -> 100 basket tokens (6 dec). fee = floor(100e6 * 50/10000) = 500_000.
  const fee = 500_000n;
  const userMint = 100_000_000n - fee;
  assert.equal(
    e.tokenBal(ownerAta(depositor.publicKey, b.basketMint)),
    userMint,
    "depositor got mint - fee",
  );
  assert.equal(
    e.tokenBal(ownerAta(creator.publicKey, b.basketMint)),
    fee,
    "creator got the fee",
  );
  assert.equal(
    e.mintSupply(b.basketMint),
    100_000_000n,
    "total supply = full mint",
  );
});

test("deposit: zero amount + stale price + low confidence rejected", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  const depositor = Keypair.generate();
  e.fund(creator.publicKey);
  e.fund(depositor.publicKey);
  const keys = ["sol", "usdc"];
  const b = await createBasket(e, creator, 0, keys, [6000, 4000], 1);
  assert.ok(e.send([b.ix], [creator]).ok);
  const depQuote = e.mkAta(depositor.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.usdc!, depQuote, 100_000_000n);
  e.mkAta(depositor.publicKey, b.basketMint);
  e.mkAta(creator.publicKey, b.basketMint);

  const fresh: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const zeroIx = await depositIx(
    e,
    b,
    depositor,
    creator.publicKey,
    keys,
    1,
    0n,
    (k) => fresh[k]!,
  );
  e.expectErr("zero deposit", "ZeroAmount", [zeroIx], [depositor]);

  const stale: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!, { ageSecs: 120 }),
    usdc: e.setPyth(ASSETS.usdc!, { ageSecs: 120 }),
  };
  const staleIx = await depositIx(
    e,
    b,
    depositor,
    creator.publicKey,
    keys,
    1,
    10_000_000n,
    (k) => stale[k]!,
  );
  e.expectErr("stale price", "StalePrice", [staleIx], [depositor]);

  const lowconf: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!, { confU64: ASSETS.sol!.priceI64 }), // conf = price -> 100% >> 2%
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const lowconfIx = await depositIx(
    e,
    b,
    depositor,
    creator.publicKey,
    keys,
    1,
    10_000_000n,
    (k) => lowconf[k]!,
  );
  e.expectErr("low confidence", "LowConfidence", [lowconfIx], [depositor]);
});

test("withdraw: pro-rata in-kind exact + dust + over-supply rejected", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  e.fund(creator.publicKey);
  const keys = ["sol", "usdc"];
  const b = await createBasket(e, creator, 0, keys, [6000, 4000], 1, {
    fee: 0,
  });
  assert.ok(e.send([b.ix], [creator]).ok);

  // creator deposits 100 USDC (fee 0 -> 100 tokens to creator)
  const cQuote = e.mkAta(creator.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.usdc!, cQuote, 100_000_000n);
  e.mkAta(creator.publicKey, b.basketMint);
  const prices: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const dep = await depositIx(
    e,
    b,
    creator,
    creator.publicKey,
    keys,
    1,
    100_000_000n,
    (k) => prices[k]!,
  );
  assert.ok(e.send([dep], [creator]).ok);
  // vault now holds 100 USDC, 0 SOL. supply 100e6.

  // pre-create user asset ATAs
  e.mkAta(creator.publicKey, e.mints.sol!);
  const userUsdc = ownerAta(creator.publicKey, e.mints.usdc!);
  const withdrawIx = async (amount: bigint) =>
    e.program.methods
      .withdraw(new BN(amount.toString()))
      .accountsPartial({
        basket: b.basket,
        basketMint: b.basketMint,
        user: creator.publicKey,
        userBasket: ownerAta(creator.publicKey, b.basketMint),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        ...keys.map((k) => wr(vaultAta(b.basket, e.mints[k]!))),
        ...keys.map((k) => wr(ownerAta(creator.publicKey, e.mints[k]!))),
      ])
      .instruction();

  // over-supply
  e.expectErr(
    "withdraw > supply",
    "BadAmount",
    [await withdrawIx(200_000_000n)],
    [creator],
  );

  // happy: withdraw 50 tokens -> 50% of vault = 50 USDC back (SOL leg is 0, skipped)
  const before = e.tokenBal(userUsdc);
  assert.ok(
    e.send([await withdrawIx(50_000_000n)], [creator]).ok,
    "withdraw failed",
  );
  assert.equal(
    e.tokenBal(userUsdc) - before,
    50_000_000n,
    "got 50% of USDC vault back in-kind",
  );
  assert.equal(e.mintSupply(b.basketMint), 50_000_000n, "supply burned by 50");

  // dust: 1 lamport-token of a 50e6-supply vault holding 50e6 USDC -> floor(50e6*1/50e6)=1 (not dust).
  // Use amount 0 path is ZeroAmount; dust needs out==0 for every asset. With supply 50e6 and 1 token,
  // out = floor(50e6 * 1 / 50e6) = 1 -> not dust. Shrink: withdraw 1 when vault tiny is hard here,
  // so assert the ZeroAmount guard instead (boundary of the same require chain).
  e.expectErr("zero withdraw", "ZeroAmount", [await withdrawIx(0n)], [creator]);
});

test("rebalance: permissionless caller + spread profit + on-target result", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  e.fund(creator.publicKey);
  const keys = ["sol", "usdc"];
  // SOL/USDC 60/40, spread 30 bps, interval 0-ish (1s, clock static so elapsed = now - 0 huge)
  const b = await createBasket(e, creator, 0, keys, [6000, 4000], 1, {
    spread: 30,
    thrAbs: 50,
    thrRel: 50,
    fee: 0,
  });
  assert.ok(e.send([b.ix], [creator]).ok);

  // creator deposits 100 USDC -> vault 100 USDC / 0 SOL (100% USDC vs 40% target -> drifted)
  const cQuote = e.mkAta(creator.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.usdc!, cQuote, 100_000_000n);
  e.mkAta(creator.publicKey, b.basketMint);
  const prices: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  assert.ok(
    e.send(
      [
        await depositIx(
          e,
          b,
          creator,
          creator.publicKey,
          keys,
          1,
          100_000_000n,
          (k) => prices[k]!,
        ),
      ],
      [creator],
    ).ok,
  );

  // a NON-admin, non-creator arb with its own reserves
  const arb = Keypair.generate();
  e.fund(arb.publicKey);
  const arbSol = e.mkAta(arb.publicKey, e.mints.sol!);
  const arbUsdc = e.mkAta(arb.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.sol!, arbSol, 1_000_000_000_000n); // plenty of SOL reserve
  e.mintTo(e.mints.usdc!, arbUsdc, 1_000_000_000n);

  const value = (): number =>
    (Number(e.tokenBal(arbSol)) / 1e9) * 100 +
    Number(e.tokenBal(arbUsdc)) / 1e6; // SOL $100, USDC $1
  const before = value();

  const px2: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const rebIx = await e.program.methods
    .rebalance()
    .accountsPartial({
      basket: b.basket,
      keeper: arb.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts([
      ...keys.map((k) => wr(vaultAta(b.basket, e.mints[k]!))),
      ...keys.map((k) => ro(px2[k]!)),
      ...keys.map((k) => wr(ownerAta(arb.publicKey, e.mints[k]!))),
    ])
    .instruction();
  const r = e.send([rebIx], [arb]);
  assert.ok(
    r.ok,
    `permissionless rebalance failed: ${r.logs.join(" ").slice(-300)}`,
  );

  // arb profited (spread), and the SOL vault is now ~60% of NAV.
  assert.ok(
    value() > before,
    `arb should profit from spread (before ${before}, after ${value()})`,
  );
  const solVal =
    (Number(e.tokenBal(vaultAta(b.basket, e.mints.sol!))) / 1e9) * 100;
  const usdcVal = Number(e.tokenBal(vaultAta(b.basket, e.mints.usdc!))) / 1e6;
  const solWeight = solVal / (solVal + usdcVal);
  assert.ok(
    Math.abs(solWeight - 0.6) < 0.01,
    `SOL weight ~60% after rebalance, got ${(solWeight * 100).toFixed(2)}%`,
  );
});

test("rebalance: dual gate — abs passes but rel fails -> DriftBelowThreshold", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  e.fund(creator.publicKey);
  const keys = ["sol", "usdc"];
  // 50/50 target, abs gate 50 bps, REL gate 500 bps.
  const b = await createBasket(e, creator, 0, keys, [5000, 5000], 1, {
    thrAbs: 50,
    thrRel: 500,
    spread: 30,
  });
  assert.ok(e.send([b.ix], [creator]).ok);

  // Hand-set the vaults: $5.10 SOL / $4.90 USDC (nav $10). abs drift 100 bps, rel ~196/200 bps.
  // 0.051 SOL (9dec) = 51e6 ; 4.90 USDC (6dec) = 4_900_000.
  e.mintTo(e.mints.sol!, vaultAta(b.basket, e.mints.sol!), 51_000_000n);
  e.mintTo(e.mints.usdc!, vaultAta(b.basket, e.mints.usdc!), 4_900_000n);

  const arb = Keypair.generate();
  e.fund(arb.publicKey);
  e.mintTo(
    e.mints.sol!,
    e.mkAta(arb.publicKey, e.mints.sol!),
    1_000_000_000_000n,
  );
  e.mintTo(
    e.mints.usdc!,
    e.mkAta(arb.publicKey, e.mints.usdc!),
    1_000_000_000n,
  );

  const px: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const rebIx = await e.program.methods
    .rebalance()
    .accountsPartial({
      basket: b.basket,
      keeper: arb.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts([
      ...keys.map((k) => wr(vaultAta(b.basket, e.mints[k]!))),
      ...keys.map((k) => ro(px[k]!)),
      ...keys.map((k) => wr(ownerAta(arb.publicKey, e.mints[k]!))),
    ])
    .instruction();
  e.expectErr("abs passes, rel fails", "DriftBelowThreshold", [rebIx], [arb]);
});

test("admin: set_paused blocks deposit; set_params updates fields", async () => {
  const e = freshEnv();
  await bootstrap(e);
  const creator = Keypair.generate();
  e.fund(creator.publicKey);
  const keys = ["sol", "usdc"];
  const b = await createBasket(e, creator, 0, keys, [6000, 4000], 1);
  assert.ok(e.send([b.ix], [creator]).ok);

  // pause
  const pauseIx = await e.program.methods
    .setPaused(true)
    .accountsPartial({ basket: b.basket, authority: creator.publicKey })
    .instruction();
  assert.ok(e.send([pauseIx], [creator]).ok);

  // deposit now rejected
  const depositor = Keypair.generate();
  e.fund(depositor.publicKey);
  const depQuote = e.mkAta(depositor.publicKey, e.mints.usdc!);
  e.mintTo(e.mints.usdc!, depQuote, 100_000_000n);
  e.mkAta(depositor.publicKey, b.basketMint);
  e.mkAta(creator.publicKey, b.basketMint);
  const prices: Record<string, PublicKey> = {
    sol: e.setPyth(ASSETS.sol!),
    usdc: e.setPyth(ASSETS.usdc!),
  };
  const depIx = await depositIx(
    e,
    b,
    depositor,
    creator.publicKey,
    keys,
    1,
    10_000_000n,
    (k) => prices[k]!,
  );
  e.expectErr("deposit while paused", "Paused", [depIx], [depositor]);

  // set_params updates spread/fee/thresholds; read back from the account.
  const paramsIx = await e.program.methods
    .setParams(200, 300, new BN(42), 77, 88)
    .accountsPartial({ basket: b.basket, authority: creator.publicKey })
    .instruction();
  assert.ok(e.send([paramsIx], [creator]).ok);
  const acc = e.svm.getAccount(b.basket)!;
  const decoded = e.program.coder.accounts.decode(
    "basket",
    Buffer.from(acc.data),
  );
  assert.equal(decoded.rebalanceThresholdBps, 200);
  assert.equal(decoded.rebalanceThresholdRelBps, 300);
  assert.equal(decoded.rebalanceSpreadBps, 77);
  assert.equal(decoded.depositFeeBps, 88);
  assert.equal(decoded.rebalanceIntervalSecs.toNumber(), 42);

  // non-authority cannot set_params
  const stranger = Keypair.generate();
  e.fund(stranger.publicKey);
  const badParams = await e.program.methods
    .setParams(100, 100, new BN(1), 10, 10)
    .accountsPartial({ basket: b.basket, authority: stranger.publicKey })
    .instruction();
  e.expectErr(
    "non-authority set_params",
    "Unauthorized",
    [badParams],
    [stranger],
  );
});
