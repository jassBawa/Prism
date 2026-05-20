use anchor_lang::prelude::*;

use crate::constants::{MAX_CONF_BPS, PRICE_MAX_AGE_SECS, PYTH_RECEIVER_PROGRAM};
use crate::error::MsError;

// ----------------------------------------------------------------------------
// Pricing helpers (all USD values in micro-USD = 1e6).
// ----------------------------------------------------------------------------

/// Manually parse a Pyth PriceUpdateV2 account (avoids the pyth crate's borsh
/// conflict with Anchor). Verifies owner, feed id, staleness, confidence.
/// Layout: 8 disc | 32 write_authority | verification_level (1B tag, +1B if Partial)
///         | PriceFeedMessage { feed_id[32], price i64, conf u64, expo i32, publish_time i64, ... }
pub fn read_price(price_ai: &AccountInfo, feed_id: &[u8; 32], clock: &Clock) -> Result<(i64, i32)> {
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
pub fn token_value_micro(balance: u64, decimals: u8, price: i64, expo: i32) -> Result<u128> {
    let price_micro = price_micro_usd(price, expo)?;
    let v = (balance as i128)
        .checked_mul(price_micro)
        .and_then(|x| x.checked_div(10i128.pow(decimals as u32)))
        .ok_or(MsError::MathOverflow)?;
    Ok(u128::try_from(v).map_err(|_| MsError::MathOverflow)?)
}

/// raw token amount worth `value_micro` micro-USD at Pyth (price, expo). Floors.
pub fn micro_to_token(value_micro: u128, decimals: u8, price: i64, expo: i32) -> Result<u64> {
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
