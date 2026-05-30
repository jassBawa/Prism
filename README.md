# Prism

### One deposit, a whole portfolio — that rebalances itself.

Prism turns a single deposit into a diversified basket of crypto assets, and keeps that basket balanced for you automatically. Think of it as an **index fund for Solana** — but on-chain, self-custodied, and open to anyone.

> 🧪 **Live on Solana devnet** — this is a working preview, not real money. Unaudited. Don't deposit funds you can't lose.

---

## The problem

Building a diversified crypto position is more work than it should be:

- You buy several tokens by hand, on different screens.
- The moment prices move, your mix drifts away from what you wanted.
- To fix it you rebalance manually — more trades, more fees, more slippage, more time.
- And you're constantly watching, because the market never closes.

Most people just… don't. They hold one or two tokens and hope.

## What Prism does

Prism gives you a **basket**: a set of 2–4 assets with target weights (say 50% SOL, 30% JUP, 20% USDC), wrapped into a **single token** you hold in your own wallet.

- **Deposit once.** Put in USDC, get one basket token representing the whole mix.
- **It stays on target.** When prices drift, an automated keeper trades the basket back to its target weights for you — using live [Pyth](https://pyth.network) oracle prices.
- **Leave whenever.** Redeem your basket token any time for your exact share of every asset inside. No lock-ups.

One token to hold. No manual rebalancing. No babysitting.

## How it works

| | Step | What happens |
|---|------|--------------|
| 1️⃣ | **Deposit** | You send USDC and receive a basket token, priced at the basket's live net asset value (NAV). |
| 2️⃣ | **Stay balanced** | A keeper watches each asset's drift and rebalances back to target when it moves too far — automatically, around the clock. |
| 3️⃣ | **Withdraw** | Burn your basket token and get a pro-rata share of every underlying asset back — directly, with no swap and no slippage. |

## Why it's different

- 🧺 **One token = a full portfolio.** Hold, transfer, or integrate it like any SPL token.
- 🤖 **Rebalancing is automatic.** You set the targets once; the keeper does the work.
- 🔍 **Honestly priced.** Every deposit and rebalance uses Pyth oracle prices, with staleness and confidence checks so a bad print can't move your money.
- 🔐 **You stay in control.** Funds live in on-chain vaults owned by the basket itself — not by us. Your exit is always a simple, oracle-free, in-kind withdrawal.
- 🌐 **Open by design.** Anyone can create a basket. Anyone can trigger a rebalance (and earn a small spread for doing it) — so the fund keeps itself on target even without us.

## What you can do today (devnet)

- Browse baskets and see live weights and NAV.
- Create your own basket from the supported assets, with custom weights.
- Deposit test USDC and receive basket tokens.
- Watch a basket drift and rebalance back to target.
- Withdraw and get every underlying asset back.

## FAQ

**What is a "basket"?**
A small portfolio — 2 to 4 assets with target weights — represented by one token you own.

**How is it priced?**
By [Pyth](https://pyth.network) oracle prices. Basket tokens are minted and redeemed at the live net asset value, with staleness and confidence checks.

**What does the keeper do?**
It watches how far each asset has drifted from its target and rebalances when the gap is too big — posting fresh prices before each trade.

**How do withdrawals work?**
You burn your basket token and receive your pro-rata share of *every* asset in the vault — atomic, oracle-free, and without swap slippage.

**Is this on mainnet?**
Not yet. It runs on Solana devnet today as a working reference; the same design is built to route to real liquidity on mainnet later.

**Is it safe to use with real money?**
No — it's an unaudited devnet preview. It has guards (Pyth checks, weight validation, bounded spreads), but it hasn't been audited. Use test funds only.

---

## Try it

The app runs against live devnet — no setup needed beyond installing and seeding:

```sh
pnpm setup    # install dependencies (once)
pnpm seed     # create test assets + demo baskets
pnpm dev      # open the dashboard at http://localhost:3001
```

Set your wallet to **Devnet**, then deposit into a basket and watch it rebalance.

## Building on Prism?

The full picture — the on-chain program, custody model, instructions, CLI, and deployment — lives in the **[Technical Guide →](./docs/TECHNICAL.md)**.

<sub>Built on **Solana** · priced by **Pyth** · powered by **Anchor** + **SPL Token**. Program (devnet): [`8TrJeQa…X3jbe`](https://explorer.solana.com/address/8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe?cluster=devnet)</sub>
