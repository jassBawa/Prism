use anchor_lang::prelude::*;

use crate::constants::{MAX_FEE_BPS, MAX_SPREAD_BPS, MIN_INTERVAL_SECS, MIN_THRESHOLD_BPS};
use crate::error::MsError;
use crate::state::Basket;

/// Owner: set a basket's rebalance thresholds (abs + rel), interval, spread, and
/// deposit fee. Same bounds as `create_basket`.
pub fn set_params_handler(
    ctx: Context<BasketAdmin>,
    threshold_bps: u16,
    threshold_rel_bps: u16,
    interval_secs: i64,
    spread_bps: u16,
    deposit_fee_bps: u16,
) -> Result<()> {
    require!(threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(threshold_rel_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(interval_secs >= MIN_INTERVAL_SECS, MsError::BadParams);
    require!(spread_bps <= MAX_SPREAD_BPS, MsError::BadParams);
    require!(deposit_fee_bps <= MAX_FEE_BPS, MsError::BadParams);
    let b = &mut ctx.accounts.basket;
    b.rebalance_threshold_bps = threshold_bps;
    b.rebalance_threshold_rel_bps = threshold_rel_bps;
    b.rebalance_interval_secs = interval_secs;
    b.rebalance_spread_bps = spread_bps;
    b.deposit_fee_bps = deposit_fee_bps;
    Ok(())
}

/// Owner: pause / unpause a basket (halts deposit + rebalance).
pub fn set_paused_handler(ctx: Context<BasketAdmin>, paused: bool) -> Result<()> {
    ctx.accounts.basket.paused = paused;
    Ok(())
}

#[derive(Accounts)]
pub struct BasketAdmin<'info> {
    #[account(mut, has_one = authority @ MsError::Unauthorized)]
    pub basket: Box<Account<'info, Basket>>,
    pub authority: Signer<'info>,
}
