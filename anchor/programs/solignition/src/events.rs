use anchor_lang::prelude::*;

#[event]
pub struct ProtocolInitialized {
    pub admin: Pubkey,
    pub treasury: Pubkey,
}

#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub amount: u64,
    pub total_shares: u64,
}

#[event]
pub struct Withdrawn {
    pub depositor: Pubkey,
    pub amount: u64,
    pub shares_burned: u64,
    pub remaining_shares: u64,
}

#[event]
pub struct LoanRequested {
    pub borrower: Pubkey,
    pub loan_id: u64,
    pub principal: u64,
    pub duration: i64,
    pub interest_rate_bps: u16,
    pub admin_fee: u64,
}

#[event]
pub struct LoanDeployed {
    pub loan_id: u64,
    pub program_pubkey: Pubkey,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub total_repaid: u64,
    pub interest_paid: u64,
}

#[event]
pub struct LoanRecovered {
    pub loan_id: u64,
    pub admin_fee_distributed: u64,
    //pub depositor_share: u64,
    //pub treasury_share: u64,
}

#[event]
pub struct AuthorityTransferred {
    pub program_pubkey: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct SolReclaimed {
    pub loan_id: u64,
    pub amount: u64,
    pub total_reclaimed: u64,
}

#[event]
pub struct ProtocolPausedChanged {
    pub is_paused: bool,
}

#[event]
pub struct ConfigUpdated {
    pub admin_fee_split_bps: u16,
    pub default_interest_rate_bps: u16,
    pub default_admin_fee_bps: u16,
}

#[event]
pub struct YieldClaimed {
    pub depositor: Pubkey,
    pub amount: u64,
    pub shares_burned: u64,
    pub remaining_shares: u64,
}