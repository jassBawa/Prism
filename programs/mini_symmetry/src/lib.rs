#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::associated_token::{self, get_associated_token_address, AssociatedToken, Create};
use anchor_spl::token::{self, spl_token, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

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
// ----------------------------------------------------------------------------

pub const MAX_ASSETS: usize = 8; // storage cap — fixed account size, forward-compatible
pub const MIN_ASSETS: usize = 2;
pub const PRICED_MAX_ASSETS: usize = 4; // atomic-Pyth tx-size practical cap (enforced at create)

pub const BASKET_SEED: &[u8] = b"basket";
pub const MINT_SEED: &[u8] = b"mint";
pub const ASSET_SEED: &[u8] = b"asset";
pub const REGISTRY_SEED: &[u8] = b"registry";
/// Max baskets tracked in the on-chain registry (keeps init under the 10 KB CPI cap).
pub const MAX_BASKETS: usize = 256;

pub const BASKET_DECIMALS: u8 = 6;
pub const BPS: u128 = 10_000;
pub const PRICE_MAX_AGE_SECS: u64 = 60;
pub const MAX_CONF_BPS: i128 = 200; // reject if conf/price > 2%
/// Virtual shares/assets offset — blocks the first-depositor inflation attack.
pub const VIRTUAL_OFFSET: u128 = 1_000_000;
pub const MIN_THRESHOLD_BPS: u16 = 10; // 0.1% — anti-grief floor on rebalance cadence
pub const MIN_INTERVAL_SECS: i64 = 1;

/// Pyth Solana Receiver program — owner of valid PriceUpdateV2 accounts.
pub const PYTH_RECEIVER_PROGRAM: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
/// Protocol admin — may curate the supported-asset allowlist.
pub const ADMIN: Pubkey = pubkey!("Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ");

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
        let s = &mut ctx.accounts.supported_asset;
        s.mint = ctx.accounts.mint.key();
        s.feed_id = feed_id;
        s.decimals = ctx.accounts.mint.decimals;
        s.is_quote_eligible = is_quote_eligible;
        s.bump = ctx.bumps.supported_asset;
        emit!(SupportedAssetSet { mint: s.mint, is_quote_eligible });
        Ok(())
    }

    /// Admin: create the basket registry (one-time). Lets clients/keeper enumerate
    /// baskets with getAccountInfo + getMultipleAccounts — no getProgramAccounts,
    /// which public/forked RPCs throttle or don't serve.
    pub fn init_registry(ctx: Context<InitRegistry>) -> Result<()> {
        let mut r = ctx.accounts.registry.load_init()?;
        r.count = 0;
        r.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Create a basket from `num_assets` supported assets + target weights.
    /// `remaining_accounts`: for each asset i, the triple [mint_i, supported_i, vault_i].
    pub fn create_basket<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateBasket<'info>>,
        _id: u64,
        num_assets: u8,
        quote_index: u8,
        weights_bps: Vec<u16>,
        rebalance_threshold_bps: u16,
        rebalance_interval_secs: i64,
    ) -> Result<()> {
        let n = num_assets as usize;
        require!((MIN_ASSETS..=PRICED_MAX_ASSETS).contains(&n), MsError::BadAssetCount);
        require!(weights_bps.len() == n, MsError::BadWeights);
        require!((quote_index as usize) < n, MsError::BadQuoteIndex);
        require!(rebalance_threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
        require!(rebalance_interval_secs >= MIN_INTERVAL_SECS, MsError::BadParams);
        require!(ctx.remaining_accounts.len() == 3 * n, MsError::BadRemainingAccounts);

        let basket_key = ctx.accounts.basket.key();
        let mut assets: [AssetConfig; MAX_ASSETS] = Default::default();
        let mut weight_sum: u32 = 0;

        for i in 0..n {
            let mint_ai = &ctx.remaining_accounts[3 * i];
            let supported_ai = &ctx.remaining_accounts[3 * i + 1];
            let vault_ai = &ctx.remaining_accounts[3 * i + 2];
            let mint_key = mint_ai.key();

            // reject duplicate mints — would break weighting + vault-ATA uniqueness.
            for a in assets.iter().take(i) {
                require_keys_neq!(a.mint, mint_key, MsError::DuplicateAsset);
            }

            // mint must be a real SPL mint; read decimals from it directly.
            require_keys_eq!(*mint_ai.owner, spl_token::ID, MsError::BadMint);
            let decimals = {
                let data = mint_ai.try_borrow_data().map_err(|_| error!(MsError::BadMint))?;
                spl_token::state::Mint::unpack(&data[..])
                    .map_err(|_| error!(MsError::BadMint))?
                    .decimals
            };

            // supported-asset PDA binds (mint, feed_id, decimals, is_quote_eligible).
            let (expected_sa, _) =
                Pubkey::find_program_address(&[ASSET_SEED, mint_key.as_ref()], ctx.program_id);
            require_keys_eq!(supported_ai.key(), expected_sa, MsError::AssetNotSupported);
            require_keys_eq!(*supported_ai.owner, *ctx.program_id, MsError::AssetNotSupported);
            let supported: SupportedAsset = {
                let data = supported_ai
                    .try_borrow_data()
                    .map_err(|_| error!(MsError::AssetNotSupported))?;
                SupportedAsset::try_deserialize(&mut &data[..])
                    .map_err(|_| error!(MsError::AssetNotSupported))?
            };
            require!(supported.decimals == decimals, MsError::BadMint);
            if i == quote_index as usize {
                require!(supported.is_quote_eligible, MsError::QuoteNotEligible);
            }

            // create the vault ATA (owned by the basket PDA).
            let expected_vault = get_associated_token_address(&basket_key, &mint_key);
            require_keys_eq!(vault_ai.key(), expected_vault, MsError::BadVault);
            associated_token::create_idempotent(CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                Create {
                    payer: ctx.accounts.creator.to_account_info(),
                    associated_token: vault_ai.clone(),
                    authority: ctx.accounts.basket.to_account_info(),
                    mint: mint_ai.clone(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ))?;

            weight_sum += weights_bps[i] as u32;
            assets[i] = AssetConfig {
                mint: mint_key,
                target_weight_bps: weights_bps[i],
                feed_id: supported.feed_id,
                decimals,
            };
        }
        require!(weight_sum == BPS as u32, MsError::BadWeights);

        // register the basket for getProgramAccounts-free discovery.
        {
            let mut reg = ctx.accounts.registry.load_mut()?;
            let slot = reg.count as usize;
            require!(slot < MAX_BASKETS, MsError::RegistryFull);
            reg.baskets[slot] = basket_key;
            reg.count += 1;
        }

        let b = &mut ctx.accounts.basket;
        b.authority = ctx.accounts.creator.key();
        b.basket_mint = ctx.accounts.basket_mint.key();
        b.id = _id;
        b.num_assets = num_assets;
        b.quote_index = quote_index;
        b.assets = assets;
        b.rebalance_threshold_bps = rebalance_threshold_bps;
        b.rebalance_interval_secs = rebalance_interval_secs;
        b.last_rebalance_ts = 0;
        b.paused = false;
        b.bump = ctx.bumps.basket;
        emit!(BasketCreated {
            authority: b.authority,
            basket: basket_key,
            basket_mint: b.basket_mint,
            num_assets,
        });
        Ok(())
    }

    /// Deposit the quote asset; receive basket tokens priced by NAV (before this deposit).
    /// `remaining_accounts`: [vault_0..vault_{n-1}, price_0..price_{n-1}].
    pub fn deposit<'info>(
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

    /// Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.
    /// Oracle-free, swap-free, atomic — the un-gameable exit.
    /// `remaining_accounts`: [vault_0..vault_{n-1}, user_ata_0..user_ata_{n-1}].
    pub fn withdraw<'info>(
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

    /// Keeper-driven rebalance toward target weights via an oracle-priced mock swap
    /// against the keeper's own reserve. Per-asset best-effort: an asset whose
    /// reserve can't cover the delta is skipped, never reverting the whole tx.
    /// `remaining_accounts`: [vault_0.., price_0.., reserve_0..] (three n-blocks).
    pub fn rebalance<'info>(ctx: Context<'_, '_, '_, 'info, Rebalance<'info>>) -> Result<()> {
        require!(!ctx.accounts.basket.paused, MsError::Paused);
        let clock = Clock::get()?;

        let n = ctx.accounts.basket.num_assets as usize;
        let qi = ctx.accounts.basket.quote_index as usize;
        let assets = ctx.accounts.basket.assets;
        let threshold = ctx.accounts.basket.rebalance_threshold_bps as u128;
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

        // Max drift across assets (bps of NAV).
        let mut max_drift_bps: u128 = 0;
        for i in 0..n {
            let cur_bps = value[i] * BPS / nav;
            let tgt_bps = assets[i].target_weight_bps as u128;
            let d = if cur_bps > tgt_bps { cur_bps - tgt_bps } else { tgt_bps - cur_bps };
            if d > max_drift_bps {
                max_drift_bps = d;
            }
        }
        require!(max_drift_bps >= threshold, MsError::DriftBelowThreshold);

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
                // quote paid = value of the asset amount actually received (floored -> favors vault).
                let quote_pay: u64 = token_value_micro(delta_amount, assets[i].decimals, px[i], ex[i])?
                    .try_into()
                    .map_err(|_| MsError::MathOverflow)?;
                // best-effort: skip if the keeper's asset reserve or the quote vault can't cover it.
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
                let quote_recv: u64 = delta_value.try_into().map_err(|_| MsError::MathOverflow)?;
                // best-effort: skip if the asset vault or the keeper's quote reserve can't cover it.
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

    pub fn set_params(ctx: Context<BasketAdmin>, threshold_bps: u16, interval_secs: i64) -> Result<()> {
        require!(threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
        require!(interval_secs >= MIN_INTERVAL_SECS, MsError::BadParams);
        let b = &mut ctx.accounts.basket;
        b.rebalance_threshold_bps = threshold_bps;
        b.rebalance_interval_secs = interval_secs;
        Ok(())
    }

    pub fn set_paused(ctx: Context<BasketAdmin>, paused: bool) -> Result<()> {
        ctx.accounts.basket.paused = paused;
        Ok(())
    }
}

// ----------------------------------------------------------------------------
// remaining_accounts validation helpers
// ----------------------------------------------------------------------------

/// A vault must be the canonical ATA of (basket PDA, mint) AND deserialize to a
/// real, initialized token account with that mint/owner. Returns its balance.
fn validate_vault_amount(ai: &AccountInfo, basket: &Pubkey, mint: &Pubkey) -> Result<u64> {
    let expected = get_associated_token_address(basket, mint);
    require_keys_eq!(ai.key(), expected, MsError::BadVault);
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadVault))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadVault))?;
    require!(&ta.mint == mint && &ta.owner == basket, MsError::BadVault);
    Ok(ta.amount)
}

/// A user/reserve token account: any account the `owner` controls holding `mint`.
fn validate_user_token(ai: &AccountInfo, owner: &Pubkey, mint: &Pubkey) -> Result<()> {
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadUserAccount))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadUserAccount))?;
    require!(&ta.mint == mint && &ta.owner == owner, MsError::BadUserAccount);
    Ok(())
}

/// Read a token account's balance (borrow dropped before return — safe to CPI after).
fn token_amount(ai: &AccountInfo) -> Result<u64> {
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadUserAccount))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadUserAccount))?;
    Ok(ta.amount)
}

// ----------------------------------------------------------------------------
// Pricing helpers (all USD values in micro-USD = 1e6).
// ----------------------------------------------------------------------------

/// Manually parse a Pyth PriceUpdateV2 account (avoids the pyth crate's borsh
/// conflict with Anchor). Verifies owner, feed id, staleness, confidence.
/// Layout: 8 disc | 32 write_authority | verification_level (1B tag, +1B if Partial)
///         | PriceFeedMessage { feed_id[32], price i64, conf u64, expo i32, publish_time i64, ... }
fn read_price(price_ai: &AccountInfo, feed_id: &[u8; 32], clock: &Clock) -> Result<(i64, i32)> {
    require_keys_eq!(*price_ai.owner, PYTH_RECEIVER_PROGRAM, MsError::BadPriceOwner);
    let data = price_ai.try_borrow_data().map_err(|_| error!(MsError::BadPrice))?;
    let mut o = 8 + 32;
    require!(data.len() > o, MsError::BadPrice);
    let vtag = data[o];
    o += 1;
    if vtag == 0 {
        o += 1; // VerificationLevel::Partial { num_signatures: u8 }
    }
    require!(data.len() >= o + 32 + 8 + 8 + 4 + 8, MsError::BadPrice);
    require!(&data[o..o + 32] == feed_id, MsError::FeedMismatch);
    o += 32;
    let price = i64::from_le_bytes(data[o..o + 8].try_into().unwrap());
    o += 8;
    let conf = u64::from_le_bytes(data[o..o + 8].try_into().unwrap());
    o += 8;
    let exponent = i32::from_le_bytes(data[o..o + 4].try_into().unwrap());
    o += 4;
    let publish_time = i64::from_le_bytes(data[o..o + 8].try_into().unwrap());
    let age = clock.unix_timestamp - publish_time;
    require!(age >= 0 && age <= PRICE_MAX_AGE_SECS as i64, MsError::StalePrice);
    require!(price > 0, MsError::BadPrice);
    let conf_bps = (conf as i128) * 10_000 / (price as i128);
    require!(conf_bps <= MAX_CONF_BPS, MsError::LowConfidence);
    Ok((price, exponent))
}

/// micro-USD value of `balance` raw units of a token at Pyth (price, expo).
fn token_value_micro(balance: u64, decimals: u8, price: i64, expo: i32) -> Result<u128> {
    let price_micro = price_micro_usd(price, expo)?;
    let v = (balance as i128)
        .checked_mul(price_micro)
        .and_then(|x| x.checked_div(10i128.pow(decimals as u32)))
        .ok_or(MsError::MathOverflow)?;
    Ok(u128::try_from(v).map_err(|_| MsError::MathOverflow)?)
}

/// raw token amount worth `value_micro` micro-USD at Pyth (price, expo). Floors.
fn micro_to_token(value_micro: u128, decimals: u8, price: i64, expo: i32) -> Result<u64> {
    let price_micro = price_micro_usd(price, expo)?;
    require!(price_micro > 0, MsError::BadPrice);
    let amt = (value_micro as i128)
        .checked_mul(10i128.pow(decimals as u32))
        .and_then(|x| x.checked_div(price_micro))
        .ok_or(MsError::MathOverflow)?;
    Ok(u64::try_from(amt).map_err(|_| MsError::MathOverflow)?)
}

/// micro-USD per 1 whole token: price * 10^(expo + 6).
fn price_micro_usd(price: i64, expo: i32) -> Result<i128> {
    let p = price as i128;
    require!(p > 0, MsError::BadPrice);
    let e = expo + 6;
    let v = if e >= 0 {
        p.checked_mul(10i128.pow(e as u32)).ok_or(MsError::MathOverflow)?
    } else {
        p.checked_div(10i128.pow((-e) as u32)).ok_or(MsError::MathOverflow)?
    };
    Ok(v)
}

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Basket {
    pub authority: Pubkey,
    pub basket_mint: Pubkey,
    pub id: u64,
    pub num_assets: u8,
    pub quote_index: u8,
    pub assets: [AssetConfig; MAX_ASSETS],
    pub rebalance_threshold_bps: u16,
    pub rebalance_interval_secs: i64,
    pub last_rebalance_ts: i64,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Default)]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub target_weight_bps: u16,
    pub feed_id: [u8; 32],
    pub decimals: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SupportedAsset {
    pub mint: Pubkey,
    pub feed_id: [u8; 32],
    pub decimals: u8,
    pub is_quote_eligible: bool,
    pub bump: u8,
}

/// On-chain index of every basket pubkey — read with getAccountInfo +
/// getMultipleAccounts instead of getProgramAccounts. Zero-copy: the ~8 KB array
/// must be accessed in place, never deserialized onto the BPF stack.
#[account(zero_copy)]
#[repr(C)]
pub struct Registry {
    pub count: u32,
    pub bump: u8,
    pub _pad: [u8; 3],
    pub baskets: [Pubkey; MAX_BASKETS],
}

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------

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

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateBasket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Basket::INIT_SPACE,
        seeds = [BASKET_SEED, creator.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub basket: Box<Account<'info, Basket>>,
    #[account(
        init,
        payer = creator,
        seeds = [MINT_SEED, basket.key().as_ref()],
        bump,
        mint::decimals = BASKET_DECIMALS,
        mint::authority = basket,
    )]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut, seeds = [REGISTRY_SEED], bump)]
    pub registry: AccountLoader<'info, Registry>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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

#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(mut)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub keeper: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BasketAdmin<'info> {
    #[account(mut, has_one = authority @ MsError::Unauthorized)]
    pub basket: Box<Account<'info, Basket>>,
    pub authority: Signer<'info>,
}

// ----------------------------------------------------------------------------
// Events + errors
// ----------------------------------------------------------------------------

#[event]
pub struct SupportedAssetSet {
    pub mint: Pubkey,
    pub is_quote_eligible: bool,
}
#[event]
pub struct BasketCreated {
    pub authority: Pubkey,
    pub basket: Pubkey,
    pub basket_mint: Pubkey,
    pub num_assets: u8,
}
#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub basket: Pubkey,
    pub quote_amount: u64,
    pub minted: u64,
    pub nav_before: u64,
}
#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub basket: Pubkey,
    pub burned: u64,
}
#[event]
pub struct Rebalanced {
    pub keeper: Pubkey,
    pub basket: Pubkey,
    pub max_drift_bps: u16,
    pub nav: u64,
}

#[error_code]
pub enum MsError {
    #[msg("asset count must be between 2 and 4")]
    BadAssetCount,
    #[msg("weights must sum to 10000 bps and match asset count")]
    BadWeights,
    #[msg("quote index out of range")]
    BadQuoteIndex,
    #[msg("threshold/interval below minimum")]
    BadParams,
    #[msg("wrong number of remaining accounts")]
    BadRemainingAccounts,
    #[msg("duplicate asset in basket")]
    DuplicateAsset,
    #[msg("invalid SPL mint")]
    BadMint,
    #[msg("asset not in the supported allowlist")]
    AssetNotSupported,
    #[msg("quote asset is not quote-eligible")]
    QuoteNotEligible,
    #[msg("basket is paused")]
    Paused,
    #[msg("amount must be > 0")]
    ZeroAmount,
    #[msg("invalid amount")]
    BadAmount,
    #[msg("would mint zero basket tokens")]
    ZeroMint,
    #[msg("withdraw rounds to zero — increase amount")]
    DustWithdraw,
    #[msg("math overflow")]
    MathOverflow,
    #[msg("pyth price is stale")]
    StalePrice,
    #[msg("pyth price invalid")]
    BadPrice,
    #[msg("pyth price confidence too low")]
    LowConfidence,
    #[msg("vault is empty")]
    EmptyVault,
    #[msg("rebalance interval not elapsed")]
    IntervalNotElapsed,
    #[msg("drift below threshold")]
    DriftBelowThreshold,
    #[msg("unauthorized")]
    Unauthorized,
    #[msg("price account not owned by pyth receiver")]
    BadPriceOwner,
    #[msg("price feed id mismatch")]
    FeedMismatch,
    #[msg("invalid vault account")]
    BadVault,
    #[msg("invalid user/reserve token account")]
    BadUserAccount,
    #[msg("duplicate price account")]
    DuplicatePrice,
    #[msg("basket registry is full")]
    RegistryFull,
}
