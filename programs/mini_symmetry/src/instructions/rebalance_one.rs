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
/// signs the vault → vault swap), bounded by the Pyth oracle. Pairwise vs the quote —
/// `value_i / value_q` is driven to `w_i / w_q`; doing each asset converges to the
/// global target (since every weight is a share of the same NAV). Needs only 2 feeds.
///
/// `remaining_accounts` (16): [price_i, price_q, <13 CPMM swap_base_input accounts>, cpmm_program].
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
    require!(ctx.remaining_accounts.len() == 16, MsError::BadRemainingAccounts);

    let price_i = &ctx.remaining_accounts[0];
    let price_q = &ctx.remaining_accounts[1];
    let swap = &ctx.remaining_accounts[2..15]; // 13 CPMM accounts
    let cpmm = &ctx.remaining_accounts[15];
    require_keys_eq!(cpmm.key(), CPMM_PROGRAM, MsError::BadCpmmProgram);

    let asset = b.assets[i];
    let quote = b.assets[qi];
    let basket_key = b.key();
    let authority = b.authority;
    let id_bytes = b.id.to_le_bytes();
    let bump = b.bump;
    let interval = b.rebalance_interval_secs;
    let w_i = asset.target_weight_bps as u128;
    let w_q = quote.target_weight_bps as u128;
    require!(w_q > 0, MsError::BadParams);

    let vault_i_key = get_associated_token_address(&basket_key, &asset.mint);
    let vault_q_key = get_associated_token_address(&basket_key, &quote.mint);

    // swap[4] = input_token_account, swap[5] = output_token_account (both basket vaults).
    let tok_in = &swap[4];
    let tok_out = &swap[5];

    // Read both vault balances regardless of direction (match by ATA key).
    let (bal_i, bal_q) = if tok_in.key() == vault_i_key && tok_out.key() == vault_q_key {
        (
            validate_vault_amount(tok_in, &basket_key, &asset.mint)?,
            validate_vault_amount(tok_out, &basket_key, &quote.mint)?,
        )
    } else if tok_in.key() == vault_q_key && tok_out.key() == vault_i_key {
        (
            validate_vault_amount(tok_out, &basket_key, &asset.mint)?,
            validate_vault_amount(tok_in, &basket_key, &quote.mint)?,
        )
    } else {
        return err!(MsError::BadVault);
    };

    let (px_i, ex_i) = read_price(price_i, &asset.feed_id, &clock)?;
    let (px_q, ex_q) = read_price(price_q, &quote.feed_id, &clock)?;
    require_keys_neq!(price_i.key(), price_q.key(), MsError::DuplicatePrice);

    let value_i = token_value_micro(bal_i, asset.decimals, px_i, ex_i)?;
    let value_q = token_value_micro(bal_q, quote.decimals, px_q, ex_q)?;
    require!(value_q > 0, MsError::EmptyVault);

    // Target: value_i / value_q == w_i / w_q. Tolerance band from MIN_THRESHOLD.
    // cur_ratio = value_i / value_q; tgt_ratio = w_i / w_q. Compare cross-multiplied.
    let lhs = value_i * w_q; // value_i / value_q vs w_i / w_q  ->  value_i*w_q vs w_i*value_q
    let rhs = w_i * value_q;
    let denom = core::cmp::max(lhs, rhs);
    let drift_bps = if denom == 0 { 0 } else { lhs.abs_diff(rhs) * BPS / denom };
    require!(drift_bps >= b.rebalance_threshold_bps as u128, MsError::AlreadyBalanced);

    // value to shift so the pair hits target: delta = |w_i*value_q - w_q*value_i| / (w_i + w_q)
    let buy = rhs > lhs; // asset under-weight vs quote -> buy asset with quote
    let delta_value = rhs.abs_diff(lhs) / (w_i + w_q);
    require!(delta_value > 0, MsError::AlreadyBalanced);

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

    ctx.accounts.basket.last_rebalance_ts = clock.unix_timestamp;
    let _ = interval;
    emit!(Rebalanced {
        keeper: ctx.accounts.keeper.key(),
        basket: basket_key,
        max_drift_bps: drift_bps.min(u16::MAX as u128) as u16,
        nav: (value_i + value_q) as u64,
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
