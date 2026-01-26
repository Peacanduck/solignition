use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::{Loan, LoanState, ProtocolConfig};
use crate::consts::{LOAN_SEED, PROTOCOL_CONFIG_SEED};
use crate::events::LoanDeployed;

/// Set the deployed program pubkey after off-chain deployment
pub fn process_set_deployed_program(
        ctx: Context<SetDeployedProgram>,
        loan_id: u64,
        program_pubkey: Pubkey,
    ) -> Result<()> {
        require!(ctx.accounts.admin.key() == ctx.accounts.protocol_config.admin, ErrorCode::Unauthorized);
        require!(ctx.accounts.loan.loan_id == loan_id, ErrorCode::InvalidLoanId);
        require!(ctx.accounts.loan.program_pubkey == Pubkey::default(), ErrorCode::ProgramAlreadySet);
        
        ctx.accounts.loan.program_pubkey = program_pubkey;
        ctx.accounts.loan.state = LoanState::Active;

        emit_cpi!(LoanDeployed {
            loan_id,
            program_pubkey,
        });
        
        Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(loan_id: u64)]
pub struct SetDeployedProgram<'info> {
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
        seeds = [LOAN_SEED, loan_id.to_le_bytes().as_ref(), &loan.borrower.to_bytes()],
        bump = loan.bump
    )]
    pub loan: Account<'info, Loan>,
}