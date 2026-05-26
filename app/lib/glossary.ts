/** Plain-language explanations for every on-screen term. Used by <Info k="..." />.
 *  Copy is intentionally short — one or two sentences a newcomer can act on. */

export interface GlossaryEntry {
  term: string;
  body: string;
}

export const GLOSSARY = {
  nav: {
    term: "Total value",
    body: "Everything the fund holds, priced live by Pyth oracles. You deposit and withdraw at this value, so you always get a fair share.",
  },
  unitPrice: {
    term: "Price per token",
    body: "The fund's total value ÷ how many fund tokens exist — what one fund token is worth right now.",
  },
  basketToken: {
    term: "Fund token",
    body: "One token that represents your share of the whole fund. Hold it, transfer it, or redeem it for the underlying assets anytime.",
  },
  supply: {
    term: "Tokens in circulation",
    body: "How many fund tokens exist in total. Your share of the fund = your tokens ÷ this number.",
  },
  drift: {
    term: "Off target",
    body: "How far the fund has wandered from its target mix as prices move. Anyone can rebalance it back to target.",
  },
  driftAbs: {
    term: "Absolute drift",
    body: "An asset's drift measured as a share of the whole fund (e.g. 2% of total value). Ignores small wiggles in big positions.",
  },
  driftRel: {
    term: "Relative drift",
    body: "An asset's drift versus its own target (e.g. 20% off its slot). Catches a small position drifting far. A rebalance needs an asset past BOTH gates.",
  },
  spread: {
    term: "Rebalance reward",
    body: "A small edge the fund pays whoever rebalances it. Anyone can do it and keep the reward — so the fund stays balanced with no trusted operator.",
  },
  fee: {
    term: "Creator fee",
    body: "A small slice of the fund tokens minted on each deposit that goes to the fund's creator. Withdrawals are always free.",
  },
  inKind: {
    term: "What you get back",
    body: "Burn your fund tokens and receive your share of every underlying asset — no swap, no slippage. The safe exit.",
  },
  quoteAsset: {
    term: "Deposit asset",
    body: "The single token you deposit (a stablecoin like USDC). The fund prices your deposit and mints fund tokens against it.",
  },
  rebalance: {
    term: "Rebalance",
    body: "Trading the fund back toward its target mix once it drifts past the thresholds. Happens at most once per interval.",
  },
  interval: {
    term: "Rebalance interval",
    body: "Minimum time between rebalances — anti-churn, so the fund can't thrash on noise.",
  },
  pyth: {
    term: "Pyth oracle",
    body: "The price feed the fund trusts. Stale or low-confidence prices are rejected on-chain, so the value can't be gamed.",
  },
  deployCost: {
    term: "Deployment cost",
    body: "One-time rent + fees to create the fund's on-chain accounts (the basket, its token mint, and vaults). Roughly 0.02–0.04 SOL; most is refundable rent.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
