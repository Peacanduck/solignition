use anchor_lang::prelude::*;

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub deployer: Pubkey,
    pub admin_fee_split_bps: u16,      // % to depositors vs treasury
    pub default_interest_rate_bps: u16,
    pub default_admin_fee_bps: u16,
 //   pub total_deposits: u64,
    pub total_loans_outstanding: u64,
    pub total_shares: u64,
    pub total_yield_distributed: u64,
    pub loan_counter: u64,
    pub is_paused: bool,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const SIZE: usize = 32 + 32 + 32 + 2 + 2 + 2 + 8 + 8 + 8 + 8 + 1 + 8 + 8 ;
}