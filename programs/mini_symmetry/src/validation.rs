use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;

use crate::error::MsError;

// ----------------------------------------------------------------------------
// remaining_accounts validation helpers
// ----------------------------------------------------------------------------

/// A vault must be the canonical ATA of (basket PDA, mint) AND deserialize to a
/// real, initialized token account with that mint/owner. Returns its balance.
pub fn validate_vault_amount(ai: &AccountInfo, basket: &Pubkey, mint: &Pubkey) -> Result<u64> {
    let expected = get_associated_token_address(basket, mint);
    require_keys_eq!(ai.key(), expected, MsError::BadVault);
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadVault))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadVault))?;
    require!(&ta.mint == mint && &ta.owner == basket, MsError::BadVault);
    Ok(ta.amount)
}

/// A user/reserve token account: any account the `owner` controls holding `mint`.
pub fn validate_user_token(ai: &AccountInfo, owner: &Pubkey, mint: &Pubkey) -> Result<()> {
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadUserAccount))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadUserAccount))?;
    require!(&ta.mint == mint && &ta.owner == owner, MsError::BadUserAccount);
    Ok(())
}

/// Read a token account's balance (borrow dropped before return — safe to CPI after).
pub fn token_amount(ai: &AccountInfo) -> Result<u64> {
    let data = ai.try_borrow_data().map_err(|_| error!(MsError::BadUserAccount))?;
    let ta = spl_token::state::Account::unpack(&data[..]).map_err(|_| error!(MsError::BadUserAccount))?;
    Ok(ta.amount)
}
