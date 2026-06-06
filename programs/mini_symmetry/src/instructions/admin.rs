use anchor_lang::prelude::*;

use crate::error::MsError;
use crate::state::Basket;

/// Owner: pause / unpause a basket (halts deposit + rebalance). Instant —
/// pausing is protective; extractive param changes go through `propose_intent`.
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
