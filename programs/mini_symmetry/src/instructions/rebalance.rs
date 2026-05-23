use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::{BASKET_SEED, BPS, MAX_ASSETS};
use crate::error::MsError;
use crate::events::Rebalanced;
use crate::pricing::{micro_to_token, read_price, token_value_micro};
use crate::state::Basket;
use crate::validation::{token_amount, validate_user_token, validate_vault_amount};

/// Keeper-driven rebalance toward target weights via an oracle-priced mock swap
/// against the keeper's own reserve. Per-asset best-effort: an asset whose
/// reserve can't cover the delta is skipped, never reverting the whole tx.
/// `remaining_accounts`: [vault_0.., price_0.., reserve_0..] (three n-blocks).
pub fn rebalance_handler<'info>(ctx: Context<'_, '_, '_, 'info, Rebalance<'info>>) -> Result<()> {
    require!(!ctx.accounts.basket.paused, MsError::Paused);
    let clock = Clock::get()?;

    let n = ctx.accounts.basket.num_assets as usize;
    let qi = ctx.accounts.basket.quote_index as usize;
    let assets = ctx.accounts.basket.assets;
    let threshold = ctx.accounts.basket.rebalance_threshold_bps as u128;
    let threshold_rel = ctx.accounts.basket.rebalance_threshold_rel_bps as u128;
    let spread = ctx.accounts.basket.rebalance_spread_bps as u128;
    let interval = ctx.accounts.basket.rebalance_interval_secs;
    let last_ts = ctx.accounts.basket.last_rebalance_ts;
    let authority = ctx.accounts.basket.authority;
    let id_bytes = ctx.accounts.basket.id.to_le_bytes();
    let bump = ctx.accounts.basket.bump;
    let basket_key = ctx.accounts.basket.key();
    let keeper_key = ctx.accounts.keeper.key();
    require!(ctx.remaining_accounts.len() == 3 * n, MsError::BadRemainingAccounts);
    require!(clock.unix_timestamp - last_ts >= interval, MsError::IntervalNotElapsed);

    // Validate every account, read balances + prices.
    let mut bal = [0u64; MAX_ASSETS];
    let mut px = [0i64; MAX_ASSETS];
    let mut ex = [0i32; MAX_ASSETS];
    let mut value = [0u128; MAX_ASSETS];
    let mut seen_price: [Pubkey; MAX_ASSETS] = Default::default();
    let mut nav: u128 = 0;
    for i in 0..n {
        let vault_ai = &ctx.remaining_accounts[i];
        let price_ai = &ctx.remaining_accounts[n + i];
        let reserve_ai = &ctx.remaining_accounts[2 * n + i];
        bal[i] = validate_vault_amount(vault_ai, &basket_key, &assets[i].mint)?;
        validate_user_token(reserve_ai, &keeper_key, &assets[i].mint)?;
        for p in seen_price.iter().take(i) {
            require_keys_neq!(*p, price_ai.key(), MsError::DuplicatePrice);
        }
        seen_price[i] = price_ai.key();
        let (p, e) = read_price(price_ai, &assets[i].feed_id, &clock)?;
        px[i] = p;
        ex[i] = e;
        value[i] = token_value_micro(bal[i], assets[i].decimals, p, e)?;
        nav += value[i];
    }
    require!(nav > 0, MsError::EmptyVault);

    // Dual drift gate: rebalance only if some asset breaches BOTH the absolute
    // threshold (share-of-NAV) AND the relative threshold (vs. its own target).
    //   abs_i = |cur_bps - tgt_bps|                      (bps of NAV)
    //   rel_i = |value_i - target_value_i| / max(value_i, target_value_i)  (bps)
    // The absolute gate stops a small wiggle in a big slot from churning; the
    // relative gate catches a small slot that's far off its own target.
    let mut max_drift_bps: u128 = 0;
    let mut triggered = false;
    for i in 0..n {
        let cur_bps = value[i] * BPS / nav;
        let tgt_bps = assets[i].target_weight_bps as u128;
        let abs_d = if cur_bps > tgt_bps { cur_bps - tgt_bps } else { tgt_bps - cur_bps };
        if abs_d > max_drift_bps {
            max_drift_bps = abs_d;
        }
        let target_value = nav * tgt_bps / BPS;
        let diff = if value[i] > target_value { value[i] - target_value } else { target_value - value[i] };
        let denom = core::cmp::max(value[i], target_value);
        // denom == 0 only when value_i == 0 AND tgt_bps == 0 (a zero-weight slot);
        // then abs_d == 0 too, so the asset can never trigger — safe.
        let rel = if denom == 0 { 0 } else { diff * BPS / denom };
        if abs_d >= threshold && rel >= threshold_rel {
            triggered = true;
        }
    }
    require!(triggered, MsError::DriftBelowThreshold);

    let seeds: &[&[u8]] = &[BASKET_SEED, authority.as_ref(), id_bytes.as_ref(), &[bump]];
    let vault_q = &ctx.remaining_accounts[qi];
    let reserve_q = &ctx.remaining_accounts[2 * n + qi];

    for i in 0..n {
        if i == qi {
            continue;
        }
        let vault_i = &ctx.remaining_accounts[i];
        let reserve_i = &ctx.remaining_accounts[2 * n + i];
        let target_value = nav * assets[i].target_weight_bps as u128 / BPS;

        if target_value > value[i] {
            // under-weight: buy asset i, pay quote.
            let delta_value = target_value - value[i];
            let delta_amount = micro_to_token(delta_value, assets[i].decimals, px[i], ex[i])?;
            if delta_amount == 0 {
                continue;
            }
            // Vault BUYS asset i: pays the fair value of the amount received PLUS a
            // `spread` premium, so the caller (any arbitrageur) profits and rebalances
            // the fund for free. fair_value is floored, favoring the vault.
            let fair_value = token_value_micro(delta_amount, assets[i].decimals, px[i], ex[i])?;
            let quote_pay: u64 = fair_value
                .checked_mul(BPS + spread)
                .and_then(|x| x.checked_div(BPS))
                .ok_or(MsError::MathOverflow)?
                .try_into()
                .map_err(|_| MsError::MathOverflow)?;
            // best-effort: skip if the keeper's asset reserve or the quote vault can't
            // cover it (checked against the spread-adjusted quote_pay).
            if token_amount(reserve_i)? < delta_amount || bal[qi] < quote_pay {
                continue;
            }
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: reserve_i.clone(),
                        to: vault_i.clone(),
                        authority: ctx.accounts.keeper.to_account_info(),
                    },
                ),
                delta_amount,
            )?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: vault_q.clone(),
                        to: reserve_q.clone(),
                        authority: ctx.accounts.basket.to_account_info(),
                    },
                    &[seeds],
                ),
                quote_pay,
            )?;
            bal[qi] = bal[qi].saturating_sub(quote_pay);
        } else if value[i] > target_value {
            // over-weight: sell asset i, receive quote.
            let delta_value = value[i] - target_value;
            let delta_amount = micro_to_token(delta_value, assets[i].decimals, px[i], ex[i])?;
            if delta_amount == 0 {
                continue;
            }
            // Vault SELLS asset i: asks the fair value of the amount actually sold
            // (floored to delta_amount) MINUS a `spread` discount, so the caller
            // profits. Rebasing on delta_amount (not the un-floored delta_value) keeps
            // the quote consistent with the tokens moved.
            let fair_recv = token_value_micro(delta_amount, assets[i].decimals, px[i], ex[i])?;
            let quote_recv: u64 = fair_recv
                .checked_mul(BPS - spread)
                .and_then(|x| x.checked_div(BPS))
                .ok_or(MsError::MathOverflow)?
                .try_into()
                .map_err(|_| MsError::MathOverflow)?;
            // best-effort: skip if the asset vault or the keeper's quote reserve can't
            // cover it (checked against the spread-adjusted quote_recv).
            if bal[i] < delta_amount || token_amount(reserve_q)? < quote_recv {
                continue;
            }
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: vault_i.clone(),
                        to: reserve_i.clone(),
                        authority: ctx.accounts.basket.to_account_info(),
                    },
                    &[seeds],
                ),
                delta_amount,
            )?;
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: reserve_q.clone(),
                        to: vault_q.clone(),
                        authority: ctx.accounts.keeper.to_account_info(),
                    },
                ),
                quote_recv,
            )?;
            bal[qi] = bal[qi].saturating_add(quote_recv);
        }
    }

    ctx.accounts.basket.last_rebalance_ts = clock.unix_timestamp;
    emit!(Rebalanced {
        keeper: keeper_key,
        basket: basket_key,
        max_drift_bps: max_drift_bps as u16,
        nav: nav as u64,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(mut)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub keeper: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
