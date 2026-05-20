use anchor_lang::prelude::*;

use crate::constants::{ADMIN, REGISTRY_SEED};
use crate::error::MsError;
use crate::state::Registry;

pub fn init_registry_handler(ctx: Context<InitRegistry>) -> Result<()> {
    let mut r = ctx.accounts.registry.load_init()?;
    r.count = 0;
    r.bump = ctx.bumps.registry;
    Ok(())
}

#[derive(Accounts)]
pub struct InitRegistry<'info> {
    #[account(mut, address = ADMIN @ MsError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + std::mem::size_of::<Registry>(),
        seeds = [REGISTRY_SEED],
        bump
    )]
    pub registry: AccountLoader<'info, Registry>,
    pub system_program: Program<'info, System>,
}
