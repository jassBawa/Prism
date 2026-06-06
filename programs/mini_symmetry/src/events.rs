use anchor_lang::prelude::*;

#[event]
pub struct SupportedAssetSet {
    pub mint: Pubkey,
    pub is_quote_eligible: bool,
}

#[event]
pub struct BasketCreated {
    pub authority: Pubkey,
    pub basket: Pubkey,
    pub basket_mint: Pubkey,
    pub num_assets: u8,
}

#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub basket: Pubkey,
    pub quote_amount: u64,
    pub minted: u64,
    pub fee: u64,
    pub nav_before: u64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub basket: Pubkey,
    pub burned: u64,
}

#[event]
pub struct Rebalanced {
    pub keeper: Pubkey,
    pub basket: Pubkey,
    pub max_drift_bps: u16,
    pub nav: u64,
}

#[event]
pub struct IntentProposed {
    pub basket: Pubkey,
    pub proposer: Pubkey,
    pub activate_ts: i64,
}

#[event]
pub struct IntentActivated {
    pub basket: Pubkey,
}

#[event]
pub struct IntentCanceled {
    pub basket: Pubkey,
}
