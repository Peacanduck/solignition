use anchor_lang::prelude::*;

#[account]
pub struct DepositorRecord {
    pub owner: Pubkey,
    pub deposited_amount: u64,
    pub share_amount: u64,      // Can differ from deposited due to yield
    pub last_update_ts: i64,
    pub bump: u8,
}

impl DepositorRecord {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8;
}