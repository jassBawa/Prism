use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::constants::{BASKET_SEED, MAX_ASSETS, VIRTUAL_OFFSET};
use crate::error::MsError;
use crate::events::Deposited;
use crate::pricing::{read_price, token_value_micro};
use crate::state::Basket;
use crate::validation::validate_vault_amount;

/// Deposit the quote asset; receive basket tokens priced by NAV (before this deposit).
/// `remaining_accounts`: [vault_0..vault_{n-1}, price_0..price_{n-1}].
pub fn deposit_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
    quote_amount: u64,
) -> Result<()> {
    require!(!ctx.accounts.basket.paused, MsError::Paused);
    require!(quote_amount > 0, MsError::ZeroAmount);
    let clock = Clock::get()?;

    let n = ctx.accounts.basket.num_assets as usize;
    let qi = ctx.accounts.basket.quote_index as usize;
    let assets = ctx.accounts.basket.assets;
    let authority = ctx.accounts.basket.authority;
    let id_bytes = ctx.accounts.basket.id.to_le_bytes();
    let bump = ctx.accounts.basket.bump;
    let basket_key = ctx.accounts.basket.key();
    require!(ctx.remaining_accounts.len() == 2 * n, MsError::BadRemainingAccounts);

    // NAV over all vault balances (BEFORE crediting the new deposit).
    let mut nav_before: u128 = 0;
    let mut seen_price: [Pubkey; MAX_ASSETS] = Default::default();
    for i in 0..n {
        let vault_ai = &ctx.remaining_accounts[i];
        let price_ai = &ctx.remaining_accounts[n + i];
        let bal = validate_vault_amount(vault_ai, &basket_key, &assets[i].mint)?;
        for p in seen_price.iter().take(i) {
            require_keys_neq!(*p, price_ai.key(), MsError::DuplicatePrice);
        }
        seen_price[i] = price_ai.key();
        let (px, expo) = read_price(price_ai, &assets[i].feed_id, &clock)?;
        nav_before += token_value_micro(bal, assets[i].decimals, px, expo)?;
    }

    let supply = ctx.accounts.basket_mint.supply as u128;
    // Virtual offset blocks first-depositor inflation; bootstrap reduces to ~1:1.
    let mint_amount: u64 = (quote_amount as u128)
        .checked_mul(supply + VIRTUAL_OFFSET)
        .and_then(|x| x.checked_div(nav_before + VIRTUAL_OFFSET))
        .ok_or(MsError::MathOverflow)?
        .try_into()
        .map_err(|_| MsError::MathOverflow)?;
    require!(mint_amount > 0, MsError::ZeroMint);

    // pull quote: depositor -> quote vault (= remaining_accounts[quote_index]).
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_quote.to_account_info(),
                to: ctx.remaining_accounts[qi].clone(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        quote_amount,
    )?;

    // mint basket tokens to the depositor (Basket PDA is the mint authority).
    let seeds: &[&[u8]] = &[BASKET_SEED, authority.as_ref(), id_bytes.as_ref(), &[bump]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.basket_mint.to_account_info(),
                to: ctx.accounts.depositor_basket.to_account_info(),
                authority: ctx.accounts.basket.to_account_info(),
            },
            &[seeds],
        ),
        mint_amount,
    )?;

    emit!(Deposited {
        depositor: ctx.accounts.depositor.key(),
        basket: basket_key,
        quote_amount,
        minted: mint_amount,
        nav_before: nav_before as u64,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut, address = basket.basket_mint)]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, token::authority = depositor)]
    pub depositor_quote: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.basket_mint, token::authority = depositor)]
    pub depositor_basket: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
