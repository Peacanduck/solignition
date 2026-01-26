use super::calculate_share_price;
use crate::state::ProtocolConfig;

/// Calculate shares to mint for a deposit amount
pub fn calculate_shares_for_deposit(config: &ProtocolConfig, amount: u64, vault_lamports: u64) -> u64 {
    if config.total_shares == 0 {
        // First deposit: 1:1 ratio
        return amount;
    }
    
    let share_price = calculate_share_price(config, vault_lamports);
    
    // shares = (amount * 10^9) / share_price
    ((amount as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(share_price)
        .unwrap()) as u64
}