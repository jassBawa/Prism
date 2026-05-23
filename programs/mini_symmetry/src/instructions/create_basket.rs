use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::associated_token::{self, get_associated_token_address, AssociatedToken, Create};
use anchor_spl::token::{spl_token, Mint, Token};

use crate::constants::*;
use crate::error::MsError;
use crate::events::BasketCreated;
use crate::state::{AssetConfig, Basket, Registry, SupportedAsset};

/// Create a basket from `num_assets` supported assets + target weights.
/// `remaining_accounts`: for each asset i, the triple [mint_i, supported_i, vault_i].
pub fn create_basket_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateBasket<'info>>,
    id: u64,
    num_assets: u8,
    quote_index: u8,
    weights_bps: Vec<u16>,
    rebalance_threshold_bps: u16,
    rebalance_threshold_rel_bps: u16,
    rebalance_spread_bps: u16,
    deposit_fee_bps: u16,
    rebalance_interval_secs: i64,
) -> Result<()> {
    let n = num_assets as usize;
    require!((MIN_ASSETS..=PRICED_MAX_ASSETS).contains(&n), MsError::BadAssetCount);
    require!(weights_bps.len() == n, MsError::BadWeights);
    require!((quote_index as usize) < n, MsError::BadQuoteIndex);
    require!(rebalance_threshold_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(rebalance_threshold_rel_bps >= MIN_THRESHOLD_BPS, MsError::BadParams);
    require!(rebalance_spread_bps <= MAX_SPREAD_BPS, MsError::BadParams);
    require!(deposit_fee_bps <= MAX_FEE_BPS, MsError::BadParams);
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
    b.id = id;
    b.num_assets = num_assets;
    b.quote_index = quote_index;
    b.assets = assets;
    b.rebalance_threshold_bps = rebalance_threshold_bps;
    b.rebalance_threshold_rel_bps = rebalance_threshold_rel_bps;
    b.rebalance_spread_bps = rebalance_spread_bps;
    b.deposit_fee_bps = deposit_fee_bps;
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
