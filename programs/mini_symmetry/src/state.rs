use anchor_lang::prelude::*;

use crate::constants::{MAX_ASSETS, MAX_BASKETS};

#[account]
#[derive(InitSpace)]
pub struct Basket {
    pub authority: Pubkey,
    pub basket_mint: Pubkey,
    pub id: u64,
    #[max_len(32)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    #[max_len(96)]
    pub website: String,
    #[max_len(96)]
    pub twitter: String,
    #[max_len(96)]
    pub telegram: String,
    #[max_len(96)]
    pub discord: String,
    pub created_ts: i64,
    pub num_assets: u8,
    pub quote_index: u8,
    pub assets: [AssetConfig; MAX_ASSETS],
    pub rebalance_threshold_bps: u16,
    pub rebalance_threshold_rel_bps: u16,
    pub rebalance_spread_bps: u16,
    pub deposit_fee_bps: u16,
    pub rebalance_interval_secs: i64,
    pub last_rebalance_ts: i64,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Default)]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub target_weight_bps: u16,
    pub feed_id: [u8; 32],
    pub decimals: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SupportedAsset {
    pub mint: Pubkey,
    pub feed_id: [u8; 32],
    pub decimals: u8,
    pub is_quote_eligible: bool,
    pub bump: u8,
}

/// On-chain index of every basket pubkey — read with getAccountInfo +
/// getMultipleAccounts instead of getProgramAccounts. Zero-copy: the ~8 KB array
/// must be accessed in place, never deserialized onto the BPF stack.
#[account(zero_copy)]
#[repr(C)]
pub struct Registry {
    pub count: u32,
    pub bump: u8,
    pub _pad: [u8; 3],
    pub baskets: [Pubkey; MAX_BASKETS],
}

/// A time-locked, pending param change for a basket (one per basket).
/// The owner proposes it; anyone can activate it once `activate_ts` passes —
/// so depositors see a fee/param change coming and can exit first.
#[account]
#[derive(InitSpace)]
pub struct Intent {
    pub basket: Pubkey,
    pub proposer: Pubkey,
    pub activate_ts: i64,
    pub threshold_bps: u16,
    pub threshold_rel_bps: u16,
    pub spread_bps: u16,
    pub deposit_fee_bps: u16,
    pub interval_secs: i64,
    pub bump: u8,
}
