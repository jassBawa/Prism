export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "#";

export const PROGRAM_ID = "8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe";

export const EXPLORER_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

export const HERO = {
  eyebrow: "Live on Solana Devnet",
  headline: "One deposit, a balanced on-chain portfolio.",
  backgroundSrc: "/images/hero-bg.jpg",
} as const;

export const HOW_IT_WORKS = {
  eyebrow: "How it works",
  headline: "Tokenized vaults, kept on target.",
  summary:
    "Deposit USDC and hold a single basket token for diversified SOL, JUP, and USDC exposure. Pyth prices the basket; a keeper keeps it balanced.",
} as const;

export const STEPS = [
  {
    number: "01",
    title: "Deposit USDC",
    description:
      "Send USDC to the vault and receive basket tokens minted at live net asset value, priced from Pyth oracles.",
  },
  {
    number: "02",
    title: "Stay balanced",
    description:
      "A keeper watches weight drift and rebalances back to target weights when prices move — no manual work.",
  },
  {
    number: "03",
    title: "Withdraw anytime",
    description:
      "Burn your basket token for a pro-rata, in-kind share of every asset in the vault. No swap, no slippage.",
  },
] as const;

export const SHOWCASE = [
  {
    visual: "basket" as const,
    title: {
      prefix: "Up to ",
      highlight: "3 assets",
      suffix: ", represented by a single token",
    },
    description:
      "Diversified exposure to SOL, JUP, and USDC in one mint you can hold, transfer, or integrate.",
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

export const FAQ_SECTION = {
  eyebrow: "FAQ",
  headline: "Questions, answered.",
} as const;

export const FAQ = [
  {
    id: "what",
    question: "What is Prism?",
    answer:
      "A reference implementation of on-chain basket vaults on Solana. You deposit USDC and receive a single basket token representing weighted exposure to SOL, JUP, and USDC.",
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
      "It monitors weight drift against the target allocation and rebalances when thresholds are met, posting fresh Pyth updates before executing each swap.",
  },
  {
    id: "withdraw",
    question: "How do withdrawals work?",
    answer:
      "Burn your basket token and receive a pro-rata, in-kind share of every asset held by the vault — atomic, oracle-free, and without swap slippage.",
  },
  {
    id: "network",
    question: "Is this on mainnet?",
    answer:
      "It runs on Solana devnet today as a working reference. The same interfaces are designed to route to real DEX liquidity on mainnet.",
  },
  {
    id: "safety",
    question: "Is it production-ready?",
    answer:
      "It is an educational reference build. Guards include Pyth staleness and confidence checks plus weight-sum validation, but it has not been audited for production use.",
  },
] as const;

export const STACK = [
  { name: "Solana", logoSrc: "/solana.svg" },
  { name: "Pyth", logoSrc: "/pyth.svg" },
  { name: "Anchor" },
  { name: "SPL Token" },
  { name: "Jupiter" },
] as const;
