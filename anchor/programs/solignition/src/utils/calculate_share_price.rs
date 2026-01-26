use crate::state::ProtocolConfig;

/// Calculate share price (total assets / total shares)
/// Returns price in lamports with 9 decimal precision
pub fn calculate_share_price(config: &ProtocolConfig, vault_lamports: u64) -> u128 {
    if config.total_shares == 0 {
        return 1_000_000_000; // 1:1 ratio when no shares exist (9 decimals)
    }
    //use vault balance
    let total_assets = vault_lamports + config.total_loans_outstanding;//config.total_deposits + config.total_yield_distributed;
    
    // Price = (total_assets * 10^9) / total_shares
    (total_assets as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(config.total_shares as u128)
        .unwrap()
}