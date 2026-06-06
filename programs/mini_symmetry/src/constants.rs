use anchor_lang::prelude::*;

pub const MAX_ASSETS: usize = 8; // storage cap — fixed account size, forward-compatible
pub const MIN_ASSETS: usize = 2;
pub const PRICED_MAX_ASSETS: usize = 4; // atomic-Pyth tx-size practical cap (enforced at create)

pub const BASKET_SEED: &[u8] = b"basket";
pub const MINT_SEED: &[u8] = b"mint";
pub const ASSET_SEED: &[u8] = b"asset";
pub const REGISTRY_SEED: &[u8] = b"registry";
pub const INTENT_SEED: &[u8] = b"intent";
/// Minimum time-lock (seconds) on a proposed param change — gives depositors a
/// window to exit before a fee/param change takes effect.
pub const MIN_INTENT_DELAY: i64 = 60;
/// Max baskets tracked in the on-chain registry (keeps init under the 10 KB CPI cap).
pub const MAX_BASKETS: usize = 256;

pub const BASKET_DECIMALS: u8 = 6;
pub const BPS: u128 = 10_000;
pub const PRICE_MAX_AGE_SECS: u64 = 60;
pub const MAX_CONF_BPS: i128 = 200; // reject if conf/price > 2%
/// Virtual shares/assets offset — blocks the first-depositor inflation attack.
pub const VIRTUAL_OFFSET: u128 = 1_000_000;
pub const MIN_THRESHOLD_BPS: u16 = 10; // 0.1% — anti-grief floor on rebalance cadence
pub const MIN_INTERVAL_SECS: i64 = 1;
/// Max rebalance spread (1%) — the better-than-oracle edge the vault pays the
/// caller. Caps how much NAV one rebalance can bleed to an arbitrageur.
pub const MAX_SPREAD_BPS: u16 = 100;
/// Max creator deposit fee (5%) — slice of newly minted basket tokens routed
/// to the creator on deposit.
pub const MAX_FEE_BPS: u16 = 500;

/// Raydium CPMM program (devnet) — target of the rebalance swap CPI.
pub const CPMM_PROGRAM: Pubkey = pubkey!("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
/// swap_base_input discriminator = sha256("global:swap_base_input")[0..8].
pub const CPMM_SWAP_DISC: [u8; 8] = [0x8f, 0xbe, 0x5a, 0xda, 0xc4, 0x1e, 0x33, 0xde];
/// Max slippage the on-chain rebalance swap tolerates vs the Pyth oracle (1.5%).
pub const MAX_REBAL_SLIPPAGE_BPS: u128 = 150;

/// Pyth Solana Receiver program — owner of valid PriceUpdateV2 accounts.
pub const PYTH_RECEIVER_PROGRAM: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
/// Protocol admin — may curate the supported-asset allowlist.
pub const ADMIN: Pubkey = pubkey!("Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ");
