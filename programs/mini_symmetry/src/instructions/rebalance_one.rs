use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::get_associated_token_address;

use crate::constants::*;
use crate::error::MsError;
use crate::events::Rebalanced;
use crate::pricing::{micro_to_token, read_price, token_value_micro};
use crate::state::Basket;
use crate::validation::validate_vault_amount;

/// Real rebalance: swap ONE asset against the quote on Raydium CPMM (the basket PDA
/// signs the vault → vault swap), bounded by the Pyth oracle. The leg is sized to its
/// **absolute NAV share** (`value_i → NAV * w_i / BPS`), NOT a pairwise ratio vs the
/// live quote. NAV-share sizing lands every leg on target in a SINGLE pass: doing each
/// non-quote asset once leaves the quote at its own target automatically (weights sum
/// to NAV). The old pairwise form (`value_i/value_q → w_i/w_q`) sized against the live
/// quote, so a deposit that inflates the quote made each leg overshoot and required
/// many keeper passes (each bleeding spread) to converge. Reading all n feeds costs a
/// few extra accounts but is what makes one-pass convergence possible.
///
/// `remaining_accounts` (2n + 14):
///   [vault_0..vault_{n-1}, price_0..price_{n-1}, <13 CPMM swap accounts>, cpmm_program].
/// The CPMM swap account order (decoded from a real swap): payer, authority, amm_config,
/// pool_state, input_token_account, output_token_account, input_vault, output_vault,
/// input_token_program, output_token_program, input_mint, output_mint, observation.
pub fn rebalance_one_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, RebalanceOne<'info>>,
    asset_index: u8,
) -> Result<()> {
    let b = &ctx.accounts.basket;
    require!(!b.paused, MsError::Paused);
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp - b.last_rebalance_ts >= b.rebalance_interval_secs,
        MsError::IntervalNotElapsed
    );

    let n = b.num_assets as usize;
    let i = asset_index as usize;
    let qi = b.quote_index as usize;
    require!(i < n && i != qi, MsError::BadParams);
    require!(ctx.remaining_accounts.len() == 2 * n + 14, MsError::BadRemainingAccounts);

    // Copy out every field we need so the `&basket` borrow is released before the swap
    // CPI + the `last_rebalance_ts` write at the end.
    let assets = b.assets;
    let threshold = b.rebalance_threshold_bps as u128;
    let basket_key = b.key();
    let authority = b.authority;
    let id_bytes = b.id.to_le_bytes();
    let bump = b.bump;
    let asset = assets[i];
    let quote = assets[qi];
    let w_i = asset.target_weight_bps as u128;
    require!(w_i > 0, MsError::BadParams);

    let vaults = &ctx.remaining_accounts[0..n];
    let prices = &ctx.remaining_accounts[n..2 * n];
    let swap = &ctx.remaining_accounts[2 * n..2 * n + 13]; // 13 CPMM accounts
    let cpmm = &ctx.remaining_accounts[2 * n + 13];
    require_keys_eq!(cpmm.key(), CPMM_PROGRAM, MsError::BadCpmmProgram);

    let vault_i_key = get_associated_token_address(&basket_key, &asset.mint);
    let vault_q_key = get_associated_token_address(&basket_key, &quote.mint);

    // NAV over ALL vault balances — so leg `i` targets its absolute NAV share.
    let mut nav: u128 = 0;
    let mut value = [0u128; MAX_ASSETS];
    let mut px = [0i64; MAX_ASSETS];
    let mut ex = [0i32; MAX_ASSETS];
    let mut seen_price: [Pubkey; MAX_ASSETS] = Default::default();
    for k in 0..n {
        let bal = validate_vault_amount(&vaults[k], &basket_key, &assets[k].mint)?;
        for p in seen_price.iter().take(k) {
            require_keys_neq!(*p, prices[k].key(), MsError::DuplicatePrice);
        }
        seen_price[k] = prices[k].key();
        let (p, e) = read_price(&prices[k], &assets[k].feed_id, &clock)?;
        px[k] = p;
        ex[k] = e;
        value[k] = token_value_micro(bal, assets[k].decimals, p, e)?;
        nav += value[k];
    }
    require!(nav > 0, MsError::EmptyVault);

    let value_i = value[i];
    let target_i = nav * w_i / BPS;

    // Relative drift of THIS leg vs its NAV-share target. Gate matches the keeper's
    // per-leg `someLegQualifies`, so the keeper never fires a no-op (AlreadyBalanced).
    let denom = core::cmp::max(value_i, target_i);
    let drift_bps = if denom == 0 { 0 } else { value_i.abs_diff(target_i) * BPS / denom };
    require!(drift_bps >= threshold, MsError::AlreadyBalanced);

    let buy = target_i > value_i; // under-weight -> buy asset i with quote
    let delta_value = value_i.abs_diff(target_i);
    require!(delta_value > 0, MsError::AlreadyBalanced);

    // Do any OTHER non-quote legs still breach the threshold? A multi-asset basket is
    // rebalanced as one cycle of N-1 legs (one tx each); this swap only moves asset i ↔
    // quote, leaving the other legs' values untouched. If some other leg is still off, we
    // are MID-cycle: don't advance `last_rebalance_ts`, so the next leg clears the interval
    // gate and runs in the same keeper tick. The interval then throttles cycle-to-cycle
    // (anti-grief) rather than leg-to-leg — without it, the gate would serialize legs one
    // per interval and a deposit would take N-1 ticks to settle.
    let mut others_drifted = false;
    for k in 0..n {
        if k == qi || k == i {
            continue;
        }
        let tgt_k = nav * assets[k].target_weight_bps as u128 / BPS;
        let denom_k = core::cmp::max(value[k], tgt_k);
        let drift_k = if denom_k == 0 { 0 } else { value[k].abs_diff(tgt_k) * BPS / denom_k };
        if drift_k >= threshold {
            others_drifted = true;
            break;
        }
    }

    let (px_i, ex_i) = (px[i], ex[i]);
    let (px_q, ex_q) = (px[qi], ex[qi]);

    // amount_in (input token raw) + oracle-bounded minimum_amount_out (output token raw).
    let min_value = delta_value * (BPS - MAX_REBAL_SLIPPAGE_BPS) / BPS;
    let (amount_in, min_out) = if buy {
        // input = quote, output = asset
        (
            micro_to_token(delta_value, quote.decimals, px_q, ex_q)?,
            micro_to_token(min_value, asset.decimals, px_i, ex_i)?,
        )
    } else {
        // input = asset, output = quote
        (
            micro_to_token(delta_value, asset.decimals, px_i, ex_i)?,
            micro_to_token(min_value, quote.decimals, px_q, ex_q)?,
        )
    };
    require!(amount_in > 0 && min_out > 0, MsError::BadAmount);

    // Verify the swap accounts are oriented for the direction we decided.
    let in_mint = if buy { quote.mint } else { asset.mint };
    let out_mint = if buy { asset.mint } else { quote.mint };
    let in_vault_key = if buy { vault_q_key } else { vault_i_key };
    let out_vault_key = if buy { vault_i_key } else { vault_q_key };
    require_keys_eq!(swap[0].key(), basket_key, MsError::SwapDirectionMismatch); // payer = basket PDA
    require_keys_eq!(swap[4].key(), in_vault_key, MsError::SwapDirectionMismatch);
    require_keys_eq!(swap[5].key(), out_vault_key, MsError::SwapDirectionMismatch);
    require_keys_eq!(swap[10].key(), in_mint, MsError::SwapDirectionMismatch);
    require_keys_eq!(swap[11].key(), out_mint, MsError::SwapDirectionMismatch);

    // Build swap_base_input(amount_in, minimum_amount_out) + CPI, signed by the basket PDA.
    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&CPMM_SWAP_DISC);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    let metas = vec![
        AccountMeta::new_readonly(swap[0].key(), true), // payer (basket PDA, signer)
        AccountMeta::new_readonly(swap[1].key(), false), // authority
        AccountMeta::new_readonly(swap[2].key(), false), // amm_config
        AccountMeta::new(swap[3].key(), false),          // pool_state
        AccountMeta::new(swap[4].key(), false),          // input_token_account
        AccountMeta::new(swap[5].key(), false),          // output_token_account
        AccountMeta::new(swap[6].key(), false),          // input_vault
        AccountMeta::new(swap[7].key(), false),          // output_vault
        AccountMeta::new_readonly(swap[8].key(), false), // input_token_program
        AccountMeta::new_readonly(swap[9].key(), false), // output_token_program
        AccountMeta::new_readonly(swap[10].key(), false), // input_mint
        AccountMeta::new_readonly(swap[11].key(), false), // output_mint
        AccountMeta::new(swap[12].key(), false),         // observation_state
    ];
    let ix = Instruction { program_id: CPMM_PROGRAM, accounts: metas, data };
    let infos: Vec<AccountInfo> = swap.to_vec();
    let seeds: &[&[u8]] = &[BASKET_SEED, authority.as_ref(), id_bytes.as_ref(), &[bump]];
    invoke_signed(&ix, &infos, &[seeds])?;

    // Only advance the throttle when the basket has reached target (no other leg drifted),
    // so the interval gates whole rebalance cycles, not individual legs.
    if !others_drifted {
        ctx.accounts.basket.last_rebalance_ts = clock.unix_timestamp;
    }
    emit!(Rebalanced {
        keeper: ctx.accounts.keeper.key(),
        basket: basket_key,
        max_drift_bps: drift_bps.min(u16::MAX as u128) as u16,
        nav: nav as u64,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RebalanceOne<'info> {
    #[account(mut)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub keeper: Signer<'info>,
}
