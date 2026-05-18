use anchor_lang::prelude::*;

#[account]
pub struct Loan {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub program_pubkey: Pubkey,  // Set after deployment
    pub principal: u64,
    pub duration: i64,
    pub interest_rate_bps: u16,
    pub admin_fee_bps: u16,
    pub admin_fee_paid: u64,
    pub start_ts: i64,
    pub state: LoanState,
    pub authority_pda: Pubkey,
    pub repaid_ts: Option<i64>,
    pub recovered_ts: Option<i64>,
    pub interest_paid: Option<u64>,
    pub reclaimed_amount: Option<u64>,
    pub reclaimed_ts: Option<i64>,
    pub bump: u8,
}

impl Loan {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 2 + 2 + 8 + 8 + 1 + 32 + 9 + 9 + 9 + 9 + 9 + 8;
}

#[derive(Debug)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LoanState {
    Active,
    Repaid,
    Recovered,
    Pending,
    RepaidPendingTransfer,
    Reclaimed,
}