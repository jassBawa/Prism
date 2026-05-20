use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::{ADMIN, ASSET_SEED};
use crate::error::MsError;
use crate::events::SupportedAssetSet;
use crate::state::SupportedAsset;

pub fn set_supported_asset_handler(
    ctx: Context<SetSupportedAsset>,
    feed_id: [u8; 32],
    is_quote_eligible: bool,
) -> Result<()> {
    let s = &mut ctx.accounts.supported_asset;
    s.mint = ctx.accounts.mint.key();
    s.feed_id = feed_id;
    s.decimals = ctx.accounts.mint.decimals;
    s.is_quote_eligible = is_quote_eligible;
    s.bump = ctx.bumps.supported_asset;
    emit!(SupportedAssetSet { mint: s.mint, is_quote_eligible });
    Ok(())
}

#[derive(Accounts)]
pub struct SetSupportedAsset<'info> {
    #[account(mut, address = ADMIN @ MsError::Unauthorized)]
    pub admin: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + SupportedAsset::INIT_SPACE,
        seeds = [ASSET_SEED, mint.key().as_ref()],
        bump
    )]
    pub supported_asset: Box<Account<'info, SupportedAsset>>,
    pub system_program: Program<'info, System>,
}
