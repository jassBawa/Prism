use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::constants::BASKET_SEED;
use crate::error::MsError;
use crate::events::Withdrawn;
use crate::state::Basket;
use crate::validation::{validate_user_token, validate_vault_amount};

/// Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.
/// Oracle-free, swap-free, atomic — the un-gameable exit.
/// `remaining_accounts`: [vault_0..vault_{n-1}, user_ata_0..user_ata_{n-1}].
pub fn withdraw_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    basket_amount: u64,
) -> Result<()> {
    require!(basket_amount > 0, MsError::ZeroAmount);
    let supply = ctx.accounts.basket_mint.supply;
    require!(supply > 0 && basket_amount <= supply, MsError::BadAmount);

    let n = ctx.accounts.basket.num_assets as usize;
    let assets = ctx.accounts.basket.assets;
    let authority = ctx.accounts.basket.authority;
    let id_bytes = ctx.accounts.basket.id.to_le_bytes();
    let bump = ctx.accounts.basket.bump;
    let basket_key = ctx.accounts.basket.key();
    let user_key = ctx.accounts.user.key();
    require!(ctx.remaining_accounts.len() == 2 * n, MsError::BadRemainingAccounts);

    let seeds: &[&[u8]] = &[BASKET_SEED, authority.as_ref(), id_bytes.as_ref(), &[bump]];
    let mut total_out: u64 = 0;
    for i in 0..n {
        let vault_ai = &ctx.remaining_accounts[i];
        let user_ai = &ctx.remaining_accounts[n + i];
        let bal = validate_vault_amount(vault_ai, &basket_key, &assets[i].mint)?;
        validate_user_token(user_ai, &user_key, &assets[i].mint)?;
        // floor(balance * basket_amount / supply) — rounds in the vault's favor.
        let out = (bal as u128)
            .checked_mul(basket_amount as u128)
            .and_then(|x| x.checked_div(supply as u128))
            .ok_or(MsError::MathOverflow)? as u64;
        if out == 0 {
            continue;
        }
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: vault_ai.clone(),
                    to: user_ai.clone(),
                    authority: ctx.accounts.basket.to_account_info(),
                },
                &[seeds],
            ),
            out,
        )?;
        total_out = total_out.saturating_add(out);
    }
    require!(total_out > 0, MsError::DustWithdraw);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.basket_mint.to_account_info(),
                from: ctx.accounts.user_basket.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        basket_amount,
    )?;

    emit!(Withdrawn { user: user_key, basket: basket_key, burned: basket_amount });
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut, address = basket.basket_mint)]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, token::mint = basket.basket_mint, token::authority = user)]
    pub user_basket: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
