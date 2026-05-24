#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod pricing;
pub mod state;
pub mod validation;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe");

// ----------------------------------------------------------------------------
// mini_symmetry — an on-chain index-fund / basket protocol.
//
// Any wallet composes its own basket from a curated supported-asset set: pick
// 2..=4 assets + target weights (bps, summing 10000). Deposit the quote asset
// -> basket token priced by NAV; withdraw -> in-kind pro-rata; a permissionless
// keeper rebalances toward target weights via an oracle-priced mock swap against
// its own reserve.
//
// The per-asset accounts (vault / Pyth price / keeper reserve) are passed as
// `remaining_accounts` and validated in-handler (ATA derivation + SPL unpack),
// since their count is only known at runtime. A SupportedAsset PDA per mint is
// the on-chain allowlist that binds (mint, feed_id, decimals) — this is what
// stops a creator pairing a cheap token with an expensive feed, or lying about
// decimals, and what bounds the keeper's reserve set to a vetted few.
//
// Layout: each instruction lives in `instructions/<name>.rs` (Accounts struct +
// `handler`). Shared pieces live in `constants` / `error` / `events` / `state`
// / `pricing` / `validation`. The handlers below stay thin — they only forward.
// ----------------------------------------------------------------------------

#[program]
pub mod mini_symmetry {
    use super::*;

    /// Admin: add or update a supported asset. Binds the mint to its Pyth feed
    /// and reads `decimals` from the real Mint (never trusts a caller arg).
    pub fn set_supported_asset(
        ctx: Context<SetSupportedAsset>,
        feed_id: [u8; 32],
        is_quote_eligible: bool,
    ) -> Result<()> {
        instructions::set_supported_asset::set_supported_asset_handler(ctx, feed_id, is_quote_eligible)
    }

    /// Admin: create the basket registry (one-time). Lets clients/keeper enumerate
    /// baskets with getAccountInfo + getMultipleAccounts — no getProgramAccounts,
    /// which public/forked RPCs throttle or don't serve.
    pub fn init_registry(ctx: Context<InitRegistry>) -> Result<()> {
        instructions::init_registry::init_registry_handler(ctx)
    }

    /// Create a basket from `num_assets` supported assets + target weights.
    /// `remaining_accounts`: for each asset i, the triple [mint_i, supported_i, vault_i].
    pub fn create_basket<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateBasket<'info>>,
        id: u64,
        name: String,
        description: String,
        num_assets: u8,
        quote_index: u8,
        weights_bps: Vec<u16>,
        rebalance_threshold_bps: u16,
        rebalance_threshold_rel_bps: u16,
        rebalance_spread_bps: u16,
        deposit_fee_bps: u16,
        rebalance_interval_secs: i64,
    ) -> Result<()> {
        instructions::create_basket::create_basket_handler(
            ctx,
            id,
            name,
            description,
            num_assets,
            quote_index,
            weights_bps,
            rebalance_threshold_bps,
            rebalance_threshold_rel_bps,
            rebalance_spread_bps,
            deposit_fee_bps,
            rebalance_interval_secs,
        )
    }

    /// Deposit the quote asset; receive basket tokens priced by NAV (before this deposit).
    /// `remaining_accounts`: [vault_0..vault_{n-1}, price_0..price_{n-1}].
    pub fn deposit<'info>(
        ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        quote_amount: u64,
    ) -> Result<()> {
        instructions::deposit::deposit_handler(ctx, quote_amount)
    }

    /// Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.
    /// Oracle-free, swap-free, atomic — the un-gameable exit.
    /// `remaining_accounts`: [vault_0..vault_{n-1}, user_ata_0..user_ata_{n-1}].
    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        basket_amount: u64,
    ) -> Result<()> {
        instructions::withdraw::withdraw_handler(ctx, basket_amount)
    }

    /// Keeper-driven rebalance toward target weights via an oracle-priced mock swap
    /// against the keeper's own reserve. Per-asset best-effort: an asset whose
    /// reserve can't cover the delta is skipped, never reverting the whole tx.
    /// `remaining_accounts`: [vault_0.., price_0.., reserve_0..] (three n-blocks).
    pub fn rebalance<'info>(ctx: Context<'_, '_, '_, 'info, Rebalance<'info>>) -> Result<()> {
        instructions::rebalance::rebalance_handler(ctx)
    }

    /// Owner: set a basket's rebalance thresholds (abs + rel), interval, spread,
    /// and deposit fee.
    pub fn set_params(
        ctx: Context<BasketAdmin>,
        threshold_bps: u16,
        threshold_rel_bps: u16,
        interval_secs: i64,
        spread_bps: u16,
        deposit_fee_bps: u16,
    ) -> Result<()> {
        instructions::admin::set_params_handler(
            ctx,
            threshold_bps,
            threshold_rel_bps,
            interval_secs,
            spread_bps,
            deposit_fee_bps,
        )
    }

    /// Owner: pause / unpause a basket (halts deposit + rebalance).
    pub fn set_paused(ctx: Context<BasketAdmin>, paused: bool) -> Result<()> {
        instructions::admin::set_paused_handler(ctx, paused)
    }
}
