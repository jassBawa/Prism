use anchor_lang::prelude::*;

use crate::constants::{
    INTENT_SEED, MAX_FEE_BPS, MAX_SPREAD_BPS, MIN_INTENT_DELAY, MIN_INTERVAL_SECS,
    MIN_THRESHOLD_BPS,
};
use crate::error::MsError;
use crate::events::{IntentActivated, IntentCanceled, IntentProposed};
use crate::state::{Basket, Intent};

/// Owner proposes a time-locked param change. One pending intent per basket
/// (`init` → a second proposal fails until the first is activated or cancelled).
pub fn propose_intent_handler(
    ctx: Context<ProposeIntent>,
    threshold_bps: u16,
    threshold_rel_bps: u16,
    interval_secs: i64,
    spread_bps: u16,
    deposit_fee_bps: u16,
    delay_secs: i64,
) -> Result<()> {
    require!(threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(threshold_rel_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(interval_secs >= MIN_INTERVAL_SECS, MsError::BadParams);
    require!(spread_bps <= MAX_SPREAD_BPS, MsError::BadParams);
    require!(deposit_fee_bps <= MAX_FEE_BPS, MsError::BadParams);
    require!(delay_secs >= MIN_INTENT_DELAY, MsError::BadDelay);

    let now = Clock::get()?.unix_timestamp;
    let intent = &mut ctx.accounts.intent;
    intent.basket = ctx.accounts.basket.key();
    intent.proposer = ctx.accounts.authority.key();
    intent.activate_ts = now + delay_secs;
    intent.threshold_bps = threshold_bps;
    intent.threshold_rel_bps = threshold_rel_bps;
    intent.spread_bps = spread_bps;
    intent.deposit_fee_bps = deposit_fee_bps;
    intent.interval_secs = interval_secs;
    intent.bump = ctx.bumps.intent;

    emit!(IntentProposed {
        basket: intent.basket,
        proposer: intent.proposer,
        activate_ts: intent.activate_ts,
    });
    Ok(())
}

/// Permissionless: once the time-lock passes, apply the change to the basket and
/// close the intent (rent → activator, a small keeper incentive).
pub fn activate_intent_handler(ctx: Context<ActivateIntent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.intent.activate_ts, MsError::IntentNotReady);

    let i = &ctx.accounts.intent;
    let b = &mut ctx.accounts.basket;
    b.rebalance_threshold_bps = i.threshold_bps;
    b.rebalance_threshold_rel_bps = i.threshold_rel_bps;
    b.rebalance_interval_secs = i.interval_secs;
    b.rebalance_spread_bps = i.spread_bps;
    b.deposit_fee_bps = i.deposit_fee_bps;

    emit!(IntentActivated { basket: b.key() });
    Ok(())
}

/// Owner cancels a pending intent before it activates (rent → owner).
pub fn cancel_intent_handler(ctx: Context<CancelIntent>) -> Result<()> {
    emit!(IntentCanceled { basket: ctx.accounts.basket.key() });
    Ok(())
}

#[derive(Accounts)]
pub struct ProposeIntent<'info> {
    #[account(has_one = authority @ MsError::Unauthorized)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Intent::INIT_SPACE,
        seeds = [INTENT_SEED, basket.key().as_ref()],
        bump
    )]
    pub intent: Box<Account<'info, Intent>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActivateIntent<'info> {
    #[account(mut)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(
        mut,
        close = activator,
        seeds = [INTENT_SEED, basket.key().as_ref()],
        bump = intent.bump,
    )]
    pub intent: Box<Account<'info, Intent>>,
    #[account(mut)]
    pub activator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelIntent<'info> {
    #[account(has_one = authority @ MsError::Unauthorized)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = authority,
        seeds = [INTENT_SEED, basket.key().as_ref()],
        bump = intent.bump,
    )]
    pub intent: Box<Account<'info, Intent>>,
}
