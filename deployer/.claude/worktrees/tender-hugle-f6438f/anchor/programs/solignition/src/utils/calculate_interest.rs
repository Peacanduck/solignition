
/// Helper function to calculate interest
pub fn calculate_interest(principal: u64, rate_bps: u16, elapsed_seconds: u64, duration_seconds: u64) -> u64 {
    let interest = (principal as u128)
        .checked_mul(rate_bps as u128)
        .unwrap()
        .checked_mul(elapsed_seconds as u128)
        .unwrap()
        .checked_div(10_000u128 * duration_seconds as u128) // was SECONDS_PER_YEAR for apy now duration of loan
        .unwrap();
    
    interest as u64
}