use anchor_lang::prelude::*;
use crate::state::{ProtocolConfig, Loan, LoanState};
use crate::error::ErrorCode;
use crate::consts::{PROTOCOL_CONFIG_SEED, LOAN_SEED, ADMIN_SEED};
use crate::events::LoanRecovered;


/// mark expired loan for recovery
    pub fn process_recover_loan(ctx: Context<RecoverLoan>) -> Result<()> {
        require!(!ctx.accounts.protocol_config.is_paused, ErrorCode::ProtocolPaused);
        
        let loan = &ctx.accounts.loan;
        require!(loan.state == LoanState::Active || loan.state == LoanState::Pending, ErrorCode::LoanNotActive);
        
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= loan.start_ts + loan.duration,
            ErrorCode::LoanNotExpired
        );

        // Update loan state
        let loan = &mut ctx.accounts.loan;
        loan.state = LoanState::Recovered;
        loan.recovered_ts = Some(clock.unix_timestamp);

        emit_cpi!(LoanRecovered {
            loan_id: loan.loan_id,
            admin_fee_distributed: loan.admin_fee_paid,
            //depositor_share,
            //treasury_share,
        });

        Ok(())
    }

#[event_cpi]
#[derive(Accounts)]
pub struct RecoverLoan<'info> {
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        has_one = admin @ ErrorCode::Unauthorized,
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    #[account(
        mut,
        seeds = [LOAN_SEED, loan.loan_id.to_le_bytes().as_ref(), &loan.borrower.to_bytes()],
        bump = loan.bump
    )]
    pub loan: Account<'info, Loan>,

    /// CHECK: Deployer wallet that currently controls the program
    #[account(
        constraint = deployer.key() == protocol_config.deployer @ ErrorCode::Unauthorized
    )]
    pub deployer: Signer<'info>,  // Must sign to transfer authority
    
    /// CHECK: Admin fee PDA
    #[account(
        mut,
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_pda: AccountInfo<'info>,
    
    /// CHECK: Treasury PDA
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}