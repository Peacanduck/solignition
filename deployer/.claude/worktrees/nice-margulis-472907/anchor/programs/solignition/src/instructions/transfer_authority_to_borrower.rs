use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    bpf_loader_upgradeable,
    program::{invoke},
};
use crate::error::ErrorCode;
use crate::state::{Loan, LoanState, ProtocolConfig};
use crate::consts::{LOAN_SEED, PROTOCOL_CONFIG_SEED};
use crate::events::AuthorityTransferred;

//only called by deployer
pub fn process_transfer_authority_to_borrower(
    ctx: Context<TransferAuthorityToBorrower>,
    loan_id: u64,
) -> Result<()> {
    let loan = &ctx.accounts.loan;
    
    require!(
        loan.state == LoanState::RepaidPendingTransfer,
        ErrorCode::LoanNotRepaid
    );
    require!(loan.loan_id == loan_id, ErrorCode::InvalidLoanId);
    require!(loan.program_pubkey != Pubkey::default(), ErrorCode::InvalidProgram);

    // Transfer upgrade authority from deployer to borrower
    let ix = bpf_loader_upgradeable::set_upgrade_authority(
        &loan.program_pubkey,
        &ctx.accounts.deployer.key(),
        Some(&loan.borrower),
    );
    
    invoke(
        &ix,
        &[
            ctx.accounts.program_data.to_account_info(),
            ctx.accounts.deployer.to_account_info(),
            ctx.accounts.borrower.to_account_info(),
            ctx.accounts.bpf_upgradeable_loader.to_account_info(),
        ],
    )?;

    // Update loan state to fully repaid
    let loan = &mut ctx.accounts.loan;
    loan.state = LoanState::Repaid;

    emit_cpi!(AuthorityTransferred {
        program_pubkey: loan.program_pubkey,
        new_authority: loan.borrower,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(loan_id: u64)]
pub struct TransferAuthorityToBorrower<'info> {
    /// CHECK: Deployer wallet that currently controls the program upgrade authority
    #[account(
        constraint = deployer.key() == protocol_config.deployer @ ErrorCode::Unauthorized
    )]
    pub deployer: Signer<'info>,
    
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    #[account(
        mut,
        seeds = [LOAN_SEED, loan_id.to_le_bytes().as_ref(), &loan.borrower.to_bytes()],
        bump = loan.bump
    )]
    pub loan: Account<'info, Loan>,
    
    /// CHECK: Borrower who will receive authority
    #[account(mut)]
    pub borrower: AccountInfo<'info>,
    
    /// CHECK: Program data account for the deployed program
    #[account(mut)] 
    pub program_data: AccountInfo<'info>,

    /// CHECK: BPF Upgradeable Loader program
    #[account(address = bpf_loader_upgradeable::ID)]
    pub bpf_upgradeable_loader: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}