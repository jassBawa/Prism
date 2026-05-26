use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::constants::{BASKET_SEED, BPS, MAX_ASSETS, VIRTUAL_OFFSET};
use crate::error::MsError;
use crate::events::Deposited;
use crate::pricing::{read_price, token_value_micro};
use crate::state::Basket;
use crate::validation::{validate_user_token, validate_vault_amount};

/// Multi-asset (in-kind) deposit: contribute any subset of the fund's underlying
/// tokens. Each deposited token is transferred straight into its vault; basket
/// tokens are minted by the TOTAL USD value of the deposit, priced at NAV.
/// `amounts[i]` is the raw amount of asset i to deposit (0 to skip).
/// `remaining_accounts`: [user_ata_0..n-1, vault_0..n-1, price_0..n-1].
pub fn deposit_assets_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositAssets<'info>>,
    amounts: Vec<u64>,
) -> Result<()> {
    require!(!ctx.accounts.basket.paused, MsError::Paused);
    let clock = Clock::get()?;

    let n = ctx.accounts.basket.num_assets as usize;
    let assets = ctx.accounts.basket.assets;
    let authority = ctx.accounts.basket.authority;
    let deposit_fee_bps = ctx.accounts.basket.deposit_fee_bps as u128;
    let id_bytes = ctx.accounts.basket.id.to_le_bytes();
    let bump = ctx.accounts.basket.bump;
    let basket_key = ctx.accounts.basket.key();
    let depositor_key = ctx.accounts.depositor.key();

    require!(amounts.len() == n, MsError::BadParams);
    require!(ctx.remaining_accounts.len() == 3 * n, MsError::BadRemainingAccounts);
    require!(amounts.iter().any(|a| *a > 0), MsError::ZeroAmount);

    // NAV (BEFORE this deposit) + the USD value being deposited, in one price pass.
    let mut nav_before: u128 = 0;
    let mut deposit_value: u128 = 0;
    let mut seen_price: [Pubkey; MAX_ASSETS] = Default::default();
    for i in 0..n {
        let user_ai = &ctx.remaining_accounts[i];
        let vault_ai = &ctx.remaining_accounts[n + i];
        let price_ai = &ctx.remaining_accounts[2 * n + i];

        let bal = validate_vault_amount(vault_ai, &basket_key, &assets[i].mint)?;
        for p in seen_price.iter().take(i) {
            require_keys_neq!(*p, price_ai.key(), MsError::DuplicatePrice);
        }
        seen_price[i] = price_ai.key();
        let (px, expo) = read_price(price_ai, &assets[i].feed_id, &clock)?;
        nav_before += token_value_micro(bal, assets[i].decimals, px, expo)?;

        if amounts[i] > 0 {
            // depositor must own the source account and it must hold this mint.
            validate_user_token(user_ai, &depositor_key, &assets[i].mint)?;
            deposit_value += token_value_micro(amounts[i], assets[i].decimals, px, expo)?;
        }
    }
    require!(deposit_value > 0, MsError::ZeroAmount);

    let supply = ctx.accounts.basket_mint.supply as u128;
    // Virtual offset blocks first-depositor inflation; bootstrap reduces to ~1:1.
    let mint_amount: u64 = deposit_value
        .checked_mul(supply + VIRTUAL_OFFSET)
        .and_then(|x| x.checked_div(nav_before + VIRTUAL_OFFSET))
        .ok_or(MsError::MathOverflow)?
        .try_into()
        .map_err(|_| MsError::MathOverflow)?;
    require!(mint_amount > 0, MsError::ZeroMint);

    let fee: u64 = ((mint_amount as u128) * deposit_fee_bps / BPS) as u64;
    let user_mint = mint_amount - fee;
    require!(user_mint > 0, MsError::ZeroMint);

    // pull each contributed token: depositor -> its vault.
    for i in 0..n {
        if amounts[i] == 0 {
            continue;
        }
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.remaining_accounts[i].clone(),
                    to: ctx.remaining_accounts[n + i].clone(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amounts[i],
        )?;
    }

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
        user_mint,
    )?;

    if fee > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.basket_mint.to_account_info(),
                    to: ctx.accounts.creator_basket.to_account_info(),
                    authority: ctx.accounts.basket.to_account_info(),
                },
                &[seeds],
            ),
            fee,
        )?;
    }

    emit!(Deposited {
        depositor: depositor_key,
        basket: basket_key,
        quote_amount: deposit_value as u64,
        minted: mint_amount,
        fee,
        nav_before: nav_before as u64,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositAssets<'info> {
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut, address = basket.basket_mint)]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, token::mint = basket.basket_mint, token::authority = depositor)]
    pub depositor_basket: Box<Account<'info, TokenAccount>>,
    /// Creator's basket-token ATA — receives the deposit fee. Must already exist.
    #[account(mut, token::mint = basket.basket_mint, token::authority = basket.authority)]
    pub creator_basket: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
