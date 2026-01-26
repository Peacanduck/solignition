use crate::state::ProtocolConfig;

/// Helper function to distribute yield to depositors
pub fn distribute_yield(config: &mut ProtocolConfig, amount: u64) {
    if config.total_shares > 0 && amount > 0 {
        // Add yield to total_yield_distributed
        // This automatically increases share value for all holders
        config.total_yield_distributed += amount;
    }
}