#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe");

// ----------------------------------------------------------------------------
// mini_symmetry — a minimal on-chain index-fund / basket protocol.
// One hardcoded basket: index 0 = SOL, 1 = JUP, 2 = USDC. Deposit USDC -> get a
// basket token priced by NAV; withdraw -> in-kind pro-rata; a keeper rebalances
// toward target weights via an oracle-priced mock swap against its own reserve.
// ----------------------------------------------------------------------------

pub const NUM_ASSETS: usize = 3;
pub const USDC_INDEX: usize = 2;
pub const BASKET_SEED: &[u8] = b"basket-v2";
pub const BASKET_DECIMALS: u8 = 6;
pub const BPS: u128 = 10_000;
pub const PRICE_MAX_AGE_SECS: u64 = 60;
pub const MAX_CONF_BPS: i128 = 200; // reject if conf/price > 2%
/// Virtual shares/assets offset — blocks the first-depositor inflation attack.
pub const VIRTUAL_OFFSET: u128 = 1_000_000;
/// Pyth Solana Receiver program — owner of valid PriceUpdateV2 accounts (same id on devnet/mainnet).
pub const PYTH_RECEIVER_PROGRAM: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

#[program]
pub mod mini_symmetry {
    use super::*;

    /// Admin: create the basket PDA, the basket-token mint, and the 3 vault ATAs.
    pub fn initialize_basket(
        ctx: Context<InitializeBasket>,
        weights_bps: [u16; NUM_ASSETS],
        feed_ids: [[u8; 32]; NUM_ASSETS],
        rebalance_threshold_bps: u16,
        rebalance_interval_secs: i64,
    ) -> Result<()> {
        let sum: u32 = weights_bps.iter().map(|w| *w as u32).sum();
        require!(sum == BPS as u32, MsError::BadWeights);

        let mints = [
            ctx.accounts.sol_mint.key(),
            ctx.accounts.jup_mint.key(),
            ctx.accounts.usdc_mint.key(),
        ];
        let decs = [
            ctx.accounts.sol_mint.decimals,
            ctx.accounts.jup_mint.decimals,
            ctx.accounts.usdc_mint.decimals,
        ];
        require!(decs[USDC_INDEX] == 6, MsError::BadUsdcDecimals);

        let b = &mut ctx.accounts.basket;
        for i in 0..NUM_ASSETS {
            b.assets[i] = AssetConfig {
                mint: mints[i],
                target_weight_bps: weights_bps[i],
                feed_id: feed_ids[i],
                decimals: decs[i],
            };
        }
        b.authority = ctx.accounts.authority.key();
        b.basket_mint = ctx.accounts.basket_mint.key();
        b.rebalance_threshold_bps = rebalance_threshold_bps;
        b.rebalance_interval_secs = rebalance_interval_secs;
        b.last_rebalance_ts = 0;
        b.paused = false;
        b.bump = ctx.bumps.basket;
        emit!(BasketInitialized { authority: b.authority, basket_mint: b.basket_mint });
        Ok(())
    }

    /// Deposit USDC, receive basket tokens priced by NAV (before this deposit).
    pub fn deposit(ctx: Context<Deposit>, usdc_amount: u64) -> Result<()> {
        require!(!ctx.accounts.basket.paused, MsError::Paused);
        require!(usdc_amount > 0, MsError::ZeroAmount);
        let clock = Clock::get()?;
        let b = &ctx.accounts.basket;

        // NAV from current vault balances (BEFORE crediting the new USDC).
        let balances = [
            ctx.accounts.vault_sol.amount,
            ctx.accounts.vault_jup.amount,
            ctx.accounts.vault_usdc.amount,
        ];
        let prices = [
            ctx.accounts.price_sol.to_account_info(),
            ctx.accounts.price_jup.to_account_info(),
            ctx.accounts.price_usdc.to_account_info(),
        ];
        let mut nav_before: u128 = 0;
        for i in 0..NUM_ASSETS {
            let (px, expo) = read_price(&prices[i], &b.assets[i].feed_id, &clock)?;
            nav_before += token_value_micro(balances[i], b.assets[i].decimals, px, expo)?;
        }

        let supply = ctx.accounts.basket_mint.supply as u128;
        // Virtual offset blocks the first-depositor inflation attack; on bootstrap
        // (supply=0, nav=0) this reduces to a 1:1 mint. USDC raw (6 dec) == micro-USD.
        let mint_amount: u64 = (usdc_amount as u128)
            .checked_mul(supply + VIRTUAL_OFFSET)
            .and_then(|x| x.checked_div(nav_before + VIRTUAL_OFFSET))
            .ok_or(MsError::MathOverflow)?
            .try_into()
            .map_err(|_| MsError::MathOverflow)?;
        require!(mint_amount > 0, MsError::ZeroMint);

        // Pull USDC user -> vault.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor_usdc.to_account_info(),
                    to: ctx.accounts.vault_usdc.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Mint basket tokens to the depositor (Basket PDA is the mint authority).
        let seeds: &[&[u8]] = &[BASKET_SEED, &[ctx.accounts.basket.bump]];
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

        emit!(Deposited { depositor: ctx.accounts.depositor.key(), usdc_amount, minted: mint_amount, nav_before: nav_before as u64 });
        Ok(())
    }

    /// Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.
    /// Oracle-free, swap-free, atomic — the un-gameable exit.
    pub fn withdraw(ctx: Context<Withdraw>, basket_amount: u64) -> Result<()> {
        require!(basket_amount > 0, MsError::ZeroAmount);
        let supply = ctx.accounts.basket_mint.supply;
        require!(supply > 0 && basket_amount <= supply, MsError::BadAmount);

        let balances = [
            ctx.accounts.vault_sol.amount,
            ctx.accounts.vault_jup.amount,
            ctx.accounts.vault_usdc.amount,
        ];
        let bump = ctx.accounts.basket.bump;
        let seeds: &[&[u8]] = &[BASKET_SEED, &[bump]];

        let vaults = [
            ctx.accounts.vault_sol.to_account_info(),
            ctx.accounts.vault_jup.to_account_info(),
            ctx.accounts.vault_usdc.to_account_info(),
        ];
        let user_atas = [
            ctx.accounts.user_sol.to_account_info(),
            ctx.accounts.user_jup.to_account_info(),
            ctx.accounts.user_usdc.to_account_info(),
        ];
        for i in 0..NUM_ASSETS {
            // floor(balance * basket_amount / supply) — rounds in the vault's favor.
            let out = (balances[i] as u128)
                .checked_mul(basket_amount as u128)
                .and_then(|x| x.checked_div(supply as u128))
                .ok_or(MsError::MathOverflow)? as u64;
            if out == 0 {
                continue;
            }
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer { from: vaults[i].clone(), to: user_atas[i].clone(), authority: ctx.accounts.basket.to_account_info() },
                    &[seeds],
                ),
                out,
            )?;
        }

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn { mint: ctx.accounts.basket_mint.to_account_info(), from: ctx.accounts.user_basket.to_account_info(), authority: ctx.accounts.user.to_account_info() },
            ),
            basket_amount,
        )?;

        emit!(Withdrawn { user: ctx.accounts.user.key(), burned: basket_amount });
        Ok(())
    }

    /// Keeper-driven rebalance. Reads Pyth, checks drift >= threshold + interval,
    /// then mock-swaps each non-USDC asset to target against the keeper's reserve
    /// at the oracle price (0-slippage demo fill). Keeper == reserve owner.
    pub fn rebalance(ctx: Context<Rebalance>) -> Result<()> {
        require!(!ctx.accounts.basket.paused, MsError::Paused);
        let clock = Clock::get()?;
        let b = &ctx.accounts.basket;
        require!(
            clock.unix_timestamp - b.last_rebalance_ts >= b.rebalance_interval_secs,
            MsError::IntervalNotElapsed
        );

        let balances = [
            ctx.accounts.vault_sol.amount,
            ctx.accounts.vault_jup.amount,
            ctx.accounts.vault_usdc.amount,
        ];
        let prices_acc = [
            ctx.accounts.price_sol.to_account_info(),
            ctx.accounts.price_jup.to_account_info(),
            ctx.accounts.price_usdc.to_account_info(),
        ];
        let mut px = [0i64; NUM_ASSETS];
        let mut ex = [0i32; NUM_ASSETS];
        let mut value = [0u128; NUM_ASSETS];
        let mut nav: u128 = 0;
        for i in 0..NUM_ASSETS {
            let (p, e) = read_price(&prices_acc[i], &b.assets[i].feed_id, &clock)?;
            px[i] = p;
            ex[i] = e;
            value[i] = token_value_micro(balances[i], b.assets[i].decimals, p, e)?;
            nav += value[i];
        }
        require!(nav > 0, MsError::EmptyVault);

        // Max drift across assets (bps of NAV).
        let mut max_drift_bps: u128 = 0;
        for i in 0..NUM_ASSETS {
            let cur_bps = value[i] * BPS / nav;
            let tgt_bps = b.assets[i].target_weight_bps as u128;
            let d = if cur_bps > tgt_bps { cur_bps - tgt_bps } else { tgt_bps - cur_bps };
            if d > max_drift_bps {
                max_drift_bps = d;
            }
        }
        require!(max_drift_bps >= b.rebalance_threshold_bps as u128, MsError::DriftBelowThreshold);

        // Rebalance each non-USDC asset to target by swapping vs USDC through the reserve.
        let bump = b.bump;
        let seeds: &[&[u8]] = &[BASKET_SEED, &[bump]];
        let vaults = [
            ctx.accounts.vault_sol.to_account_info(),
            ctx.accounts.vault_jup.to_account_info(),
            ctx.accounts.vault_usdc.to_account_info(),
        ];
        let reserves = [
            ctx.accounts.reserve_sol.to_account_info(),
            ctx.accounts.reserve_jup.to_account_info(),
            ctx.accounts.reserve_usdc.to_account_info(),
        ];

        for i in 0..NUM_ASSETS {
            if i == USDC_INDEX {
                continue;
            }
            let target_value = nav * b.assets[i].target_weight_bps as u128 / BPS;
            if target_value > value[i] {
                // under-weight: buy `delta_amount` of asset i with USDC.
                let delta_value = target_value - value[i];
                let delta_amount = micro_to_token(delta_value, b.assets[i].decimals, px[i], ex[i])?;
                if delta_amount == 0 {
                    continue;
                }
                // USDC paid = value of the asset amount actually received (floored -> favors the vault).
                let usdc_pay: u64 = token_value_micro(delta_amount, b.assets[i].decimals, px[i], ex[i])?
                    .try_into()
                    .map_err(|_| MsError::MathOverflow)?;
                // reserve -> vault (asset i); keeper authorizes its own reserve.
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer { from: reserves[i].clone(), to: vaults[i].clone(), authority: ctx.accounts.keeper.to_account_info() },
                    ),
                    delta_amount,
                )?;
                // vault USDC -> reserve USDC; PDA authorizes.
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer { from: vaults[USDC_INDEX].clone(), to: reserves[USDC_INDEX].clone(), authority: ctx.accounts.basket.to_account_info() },
                        &[seeds],
                    ),
                    usdc_pay,
                )?;
            } else if value[i] > target_value {
                // over-weight: sell `delta_amount` of asset i for USDC.
                let delta_value = value[i] - target_value;
                let delta_amount = micro_to_token(delta_value, b.assets[i].decimals, px[i], ex[i])?;
                if delta_amount == 0 {
                    continue;
                }
                // vault -> reserve (asset i); PDA authorizes.
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer { from: vaults[i].clone(), to: reserves[i].clone(), authority: ctx.accounts.basket.to_account_info() },
                        &[seeds],
                    ),
                    delta_amount,
                )?;
                // reserve USDC -> vault USDC; keeper authorizes.
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer { from: reserves[USDC_INDEX].clone(), to: vaults[USDC_INDEX].clone(), authority: ctx.accounts.keeper.to_account_info() },
                    ),
                    delta_value as u64,
                )?;
            }
        }

        ctx.accounts.basket.last_rebalance_ts = clock.unix_timestamp;
        emit!(Rebalanced { keeper: ctx.accounts.keeper.key(), max_drift_bps: max_drift_bps as u16, nav: nav as u64 });
        Ok(())
    }

    pub fn set_params(ctx: Context<AdminOnly>, threshold_bps: u16, interval_secs: i64) -> Result<()> {
        let b = &mut ctx.accounts.basket;
        b.rebalance_threshold_bps = threshold_bps;
        b.rebalance_interval_secs = interval_secs;
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.basket.paused = paused;
        Ok(())
    }
}

// ----------------------------------------------------------------------------
// Pricing helpers (all USD values in micro-USD = 1e6).
// ----------------------------------------------------------------------------

/// Manually parse a Pyth PriceUpdateV2 account (avoids the pyth crate's borsh
/// conflict with Anchor v1). Verifies owner, feed id, staleness, confidence.
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
    pub assets: [AssetConfig; NUM_ASSETS],
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

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeBasket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Basket::INIT_SPACE,
        seeds = [BASKET_SEED],
        bump
    )]
    pub basket: Box<Account<'info, Basket>>,
    #[account(
        init,
        payer = authority,
        mint::decimals = BASKET_DECIMALS,
        mint::authority = basket,
    )]
    pub basket_mint: Box<Account<'info, Mint>>,

    pub sol_mint: Box<Account<'info, Mint>>,
    pub jup_mint: Box<Account<'info, Mint>>,
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(init, payer = authority, associated_token::mint = sol_mint, associated_token::authority = basket)]
    pub vault_sol: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = authority, associated_token::mint = jup_mint, associated_token::authority = basket)]
    pub vault_jup: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = authority, associated_token::mint = usdc_mint, associated_token::authority = basket)]
    pub vault_usdc: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(seeds = [BASKET_SEED], bump = basket.bump)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut, address = basket.basket_mint)]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, token::mint = basket.assets[USDC_INDEX].mint, token::authority = depositor)]
    pub depositor_usdc: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.basket_mint, token::authority = depositor)]
    pub depositor_basket: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = basket.assets[0].mint, associated_token::authority = basket)]
    pub vault_sol: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[1].mint, associated_token::authority = basket)]
    pub vault_jup: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[USDC_INDEX].mint, associated_token::authority = basket)]
    pub vault_usdc: Box<Account<'info, TokenAccount>>,

    /// CHECK: Pyth price update account, validated in the handler.
    pub price_sol: UncheckedAccount<'info>,
    /// CHECK: Pyth price update account, validated in the handler.
    pub price_jup: UncheckedAccount<'info>,
    /// CHECK: Pyth price update account, validated in the handler.
    pub price_usdc: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [BASKET_SEED], bump = basket.bump)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut, address = basket.basket_mint)]
    pub basket_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, token::mint = basket.basket_mint, token::authority = user)]
    pub user_basket: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = basket.assets[0].mint, associated_token::authority = basket)]
    pub vault_sol: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[1].mint, associated_token::authority = basket)]
    pub vault_jup: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[USDC_INDEX].mint, associated_token::authority = basket)]
    pub vault_usdc: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = basket.assets[0].mint, token::authority = user)]
    pub user_sol: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.assets[1].mint, token::authority = user)]
    pub user_jup: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.assets[USDC_INDEX].mint, token::authority = user)]
    pub user_usdc: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(mut, seeds = [BASKET_SEED], bump = basket.bump)]
    pub basket: Box<Account<'info, Basket>>,
    #[account(mut)]
    pub keeper: Signer<'info>,

    #[account(mut, associated_token::mint = basket.assets[0].mint, associated_token::authority = basket)]
    pub vault_sol: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[1].mint, associated_token::authority = basket)]
    pub vault_jup: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = basket.assets[USDC_INDEX].mint, associated_token::authority = basket)]
    pub vault_usdc: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = basket.assets[0].mint, token::authority = keeper)]
    pub reserve_sol: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.assets[1].mint, token::authority = keeper)]
    pub reserve_jup: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = basket.assets[USDC_INDEX].mint, token::authority = keeper)]
    pub reserve_usdc: Box<Account<'info, TokenAccount>>,

    /// CHECK: Pyth price update account, validated in the handler.
    pub price_sol: UncheckedAccount<'info>,
    /// CHECK: Pyth price update account, validated in the handler.
    pub price_jup: UncheckedAccount<'info>,
    /// CHECK: Pyth price update account, validated in the handler.
    pub price_usdc: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [BASKET_SEED], bump = basket.bump, has_one = authority @ MsError::Unauthorized)]
    pub basket: Box<Account<'info, Basket>>,
    pub authority: Signer<'info>,
}

// ----------------------------------------------------------------------------
// Events + errors
// ----------------------------------------------------------------------------

#[event]
pub struct BasketInitialized {
    pub authority: Pubkey,
    pub basket_mint: Pubkey,
}
#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub usdc_amount: u64,
    pub minted: u64,
    pub nav_before: u64,
}
#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub burned: u64,
}
#[event]
pub struct Rebalanced {
    pub keeper: Pubkey,
    pub max_drift_bps: u16,
    pub nav: u64,
}

#[error_code]
pub enum MsError {
    #[msg("weights must sum to 10000 bps")]
    BadWeights,
    #[msg("basket is paused")]
    Paused,
    #[msg("amount must be > 0")]
    ZeroAmount,
    #[msg("invalid amount")]
    BadAmount,
    #[msg("would mint zero basket tokens")]
    ZeroMint,
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
    #[msg("usdc asset must have 6 decimals")]
    BadUsdcDecimals,
}
