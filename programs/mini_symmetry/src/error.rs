use anchor_lang::prelude::*;

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
    #[msg("name must be 1..=32 chars and description <= 200")]
    BadMetadata,
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
    #[msg("rebalance swap must target the configured Raydium CPMM program")]
    BadCpmmProgram,
    #[msg("swap accounts don't match the required rebalance direction")]
    SwapDirectionMismatch,
    #[msg("asset already within target ratio — nothing to rebalance")]
    AlreadyBalanced,
}
