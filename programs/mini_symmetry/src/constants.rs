use anchor_lang::prelude::*;

pub const MAX_ASSETS: usize = 8; // storage cap — fixed account size, forward-compatible
pub const MIN_ASSETS: usize = 2;
pub const PRICED_MAX_ASSETS: usize = 4; // atomic-Pyth tx-size practical cap (enforced at create)

pub const BASKET_SEED: &[u8] = b"basket";
pub const MINT_SEED: &[u8] = b"mint";
pub const ASSET_SEED: &[u8] = b"asset";
pub const REGISTRY_SEED: &[u8] = b"registry";
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

/// Pyth Solana Receiver program — owner of valid PriceUpdateV2 accounts.
pub const PYTH_RECEIVER_PROGRAM: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
/// Protocol admin — may curate the supported-asset allowlist.
pub const ADMIN: Pubkey = pubkey!("Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ");
