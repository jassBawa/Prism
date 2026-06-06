export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "#";

/** Whether a real docs link is configured (used to hide dead "#" links). */
export const HAS_DOCS = DOCS_URL !== "#";

export const PROGRAM_ID = "8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe";

export const EXPLORER_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

export const GITHUB_URL = "https://github.com/jassBawa/Prism";

export const TWITTER_URL = "https://x.com/jaspreetbawa_";

export const HERO = {
  eyebrow: "Live on Solana Devnet",
  headline: "One deposit. A whole portfolio.",
  subcopy:
    "Diversified on-chain exposure in a single token — priced by Pyth, kept on target by auto-rebalancing keepers, and redeemable in-kind anytime.",
  backgroundSrc: "/images/hero-bg.jpg",
} as const;

export const HOW_IT_WORKS = {
  eyebrow: "How it works",
  headline: "Tokenized vaults, kept on target.",
  summary:
    "Deposit and hold a single basket token for diversified, auto-rebalanced exposure. Pyth prices the basket; a keeper keeps it on target.",
} as const;

export const STEPS = [
  {
    number: "01",
    title: "Deposit",
    description:
      "Send USDC — or any underlying asset — and receive basket tokens minted at live net asset value, priced from Pyth oracles.",
  },
  {
    number: "02",
    title: "Stay balanced",
    description:
      "A keeper watches weight drift and rebalances back to target — on Raydium liquidity, or oracle-priced reserves. No manual work.",
  },
  {
    number: "03",
    title: "Withdraw anytime",
    description:
      "Burn your basket token for a pro-rata, in-kind share of every asset. Atomic, oracle-free, no slippage.",
  },
] as const;

export const SHOWCASE = [
  {
    visual: "basket" as const,
    title: {
      prefix: "Up to ",
      highlight: "4 assets",
      suffix: ", represented by a single token",
    },
    description:
      "Diversified on-chain exposure in one mint you can hold, transfer, or integrate.",
  },
  {
    visual: "rebalance" as const,
    title: {
      prefix: "Automated rebalancing, ",
      highlight: "minimized drift",
      suffix: "",
    },
    description:
      "Oracle snapshots and confidence bands keep every rebalance aligned with on-chain prices.",
  },
] as const;

/** Roadmap / coming-soon. Items are NOT live — always labeled. */
export const ROADMAP = {
  eyebrow: "Roadmap",
  headline: "Where Prism is going.",
  intro:
    "Prism today is a working devnet engine for tokenized index funds. Next, we point that engine at the assets and risks that matter.",
  items: [
    {
      tag: "Coming soon",
      title: "RWA baskets — tokenized equities & treasuries",
      body: "Index the tokenized stock market on Solana (xStocks: AAPLx, NVDAx, TSLAx, SPYx) and tokenized T-bills — one token, auto-rebalanced.",
    },
    {
      tag: "Planned",
      title: "On-chain governance",
      body: "Weight and fee changes proposed on-chain with a delay and exit window before they take effect.",
    },
    {
      tag: "Planned",
      title: "Mainnet",
      body: "Route to real DEX liquidity (Jupiter / Raydium) and real RWA tokens.",
    },
  ],
  note: "Roadmap items are not live yet. Today's app runs on Solana devnet with controlled test mints.",
} as const;

export const FAQ_SECTION = {
  eyebrow: "FAQ",
  headline: "Questions, answered.",
} as const;

export const FAQ = [
  {
    id: "what",
    question: "What is Prism?",
    answer:
      "Prism is on-chain index funds on Solana. Deposit and hold a single basket token representing weighted exposure to a diversified set of on-chain assets — auto-rebalanced and redeemable in-kind.",
  },
  {
    id: "pricing",
    question: "How is the basket priced?",
    answer:
      "Net asset value is computed from Pyth oracle prices, with staleness and confidence checks. Basket tokens are minted and redeemed at the live NAV.",
  },
  {
    id: "keeper",
    question: "What does the keeper do?",
    answer:
      "It watches weight drift against the target allocation and rebalances when thresholds are met — on Raydium liquidity when a pool exists, or oracle-priced reserves — posting fresh Pyth updates first.",
  },
  {
    id: "withdraw",
    question: "How do withdrawals work?",
    answer:
      "Burn your basket token and receive a pro-rata, in-kind share of every asset held by the vault — atomic, oracle-free, and without swap slippage.",
  },
  {
    id: "create",
    question: "Can I create my own basket?",
    answer:
      "Yes — basket creation is permissionless. Choose 2–4 supported assets and target weights, and the keeper handles rebalancing.",
  },
  {
    id: "network",
    question: "Is this on mainnet?",
    answer:
      "It runs on Solana devnet today as a working reference, using controlled test mints. Mainnet — real DEX liquidity and real assets — is on the roadmap.",
  },
  {
    id: "next",
    question: "What's coming next?",
    answer:
      "RWA baskets (tokenized equities and treasuries), depeg-protected stablecoin baskets, on-chain governance, and mainnet. See the roadmap above.",
  },
  {
    id: "safety",
    question: "Is it production-ready?",
    answer:
      "It's a working devnet reference, not audited for production, and assets are controlled test mints. Guards include Pyth staleness and confidence checks plus weight-sum validation.",
  },
] as const;

export const STACK = [
  { name: "Solana", logoSrc: "/solana.svg" },
  { name: "Pyth", logoSrc: "/pyth.svg" },
  { name: "Anchor" },
  { name: "SPL Token" },
  { name: "Raydium" },
  { name: "Jupiter" },
] as const;
