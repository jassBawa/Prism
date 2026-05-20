use anchor_lang::prelude::*;

use crate::constants::{MIN_INTERVAL_SECS, MIN_THRESHOLD_BPS};
use crate::error::MsError;
use crate::state::Basket;

/// Owner: set a basket's rebalance threshold + interval.
pub fn set_params_handler(ctx: Context<BasketAdmin>, threshold_bps: u16, interval_secs: i64) -> Result<()> {
    require!(threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(interval_secs >= MIN_INTERVAL_SECS, MsError::BadParams);
    let b = &mut ctx.accounts.basket;
    b.rebalance_threshold_bps = threshold_bps;
    b.rebalance_interval_secs = interval_secs;
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
