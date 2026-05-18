use anchor_lang::prelude::*;
use instructions::*;
//use state::*;
//use consts::*;
//use error::*;
//use events::*;
//use utils::*;

pub mod instructions;
pub mod state;
pub mod consts;
pub mod error;
pub mod events;
pub mod utils;

declare_id!("HVzpjSxwECnb6uY9Jnia48oJp4xrQiz5jgc5hZC5df63");

#[program]
pub mod solignition {
    use super::*;
 
    pub fn initialize( ctx: Context<Initialize>, admin_fee_split_bps: u16, default_interest_rate_bps: u16, default_admin_fee_bps: u16,) -> Result<()> {
        process_initialize(ctx, admin_fee_split_bps, default_interest_rate_bps, default_admin_fee_bps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        process_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        process_withdraw(ctx, shares)
    }

    pub fn claim_admin(ctx: Context<ClaimAdmin>) -> Result<()> {
        process_claim_admin(ctx)
    }

    pub fn request_loan(ctx: Context<RequestLoan>, principal: u64, duration: i64, interest_rate_bps: u16, admin_fee_bps: u16) -> Result<()> {
        process_request_loan(ctx, principal, duration, interest_rate_bps, admin_fee_bps)
    }

    pub fn set_deployed_program(ctx: Context<SetDeployedProgram>, loan_id: u64, program_pubkey: Pubkey) -> Result<()> {
        process_set_deployed_program(ctx, loan_id, program_pubkey)
    }

    pub fn repay_loan(ctx: Context<RepayLoan>, loan_id: u64) -> Result<()> {
        process_repay_loan(ctx, loan_id)
    }

    pub fn transfer_authority_to_borrower(ctx: Context<TransferAuthorityToBorrower>, loan_id: u64) -> Result<()> {
        process_transfer_authority_to_borrower(ctx, loan_id)
    }

    pub fn recover_loan(ctx: Context<RecoverLoan>) -> Result<()> {
        process_recover_loan(ctx)
    }

    pub fn set_paused(ctx: Context<AdminAction>, is_paused: bool) -> Result<()> {
        process_set_paused(ctx, is_paused)
    }

    pub fn return_reclaimed_sol(ctx: Context<ReturnReclaimedSol>, amount: u64) -> Result<()> {
        process_return_reclaimed_sol(ctx, amount)
    }

    pub fn update_config(
        ctx: Context<AdminAction>,
        admin_fee_split_bps: Option<u16>,
        default_interest_rate_bps: Option<u16>,
        default_admin_fee_bps: Option<u16>,
        deployer: Option<Pubkey>,
        treasury: Option<Pubkey>,
        admin: Option<Pubkey>,
    ) -> Result<()> {
        process_update_config(
            ctx,
            admin_fee_split_bps,
            default_interest_rate_bps,
            default_admin_fee_bps,
            deployer,
            treasury,
            admin,
        )
    }



}


