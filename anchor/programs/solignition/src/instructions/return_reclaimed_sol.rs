use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::{Loan, LoanState, ProtocolConfig};
use crate::consts::{PROTOCOL_CONFIG_SEED, LOAN_SEED, VAULT_SEED};
use crate::events::SolReclaimed;

/// Return reclaimed SOL from expired/recovered loans back to vault
    pub fn process_return_reclaimed_sol(ctx: Context<ReturnReclaimedSol>, amount: u64) -> Result<()> {
        let loan = &ctx.accounts.loan;
        
        // Ensure loan has been recovered
        require!(loan.state == LoanState::Recovered ||
                 loan.state == LoanState::Pending , ErrorCode::LoanNotRecovered);
        
        // Ensure caller is authorized (admin or deployer)
        require!(
            ctx.accounts.caller.key() == ctx.accounts.protocol_config.admin || 
            ctx.accounts.caller.key() == ctx.accounts.protocol_config.deployer,
            ErrorCode::Unauthorized
        );
        
        // Transfer SOL from deployer back to vault
        /* 
        let ix = system_instruction::transfer(
            &ctx.accounts.deployer.key(),
            &ctx.accounts.vault.key(),
            amount,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.deployer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        */

        transfer(
         CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.deployer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
         ),
         amount,
        )?;
        
        // Update loan record to track reclaimed amount
        let loan = &mut ctx.accounts.loan;
        loan.reclaimed_amount = Some(amount);
        loan.state = LoanState::Reclaimed;
        loan.reclaimed_ts = Some(Clock::get()?.unix_timestamp);

        // Update protocol state 
        ctx.accounts.protocol_config.total_loans_outstanding = ctx.accounts.protocol_config.total_loans_outstanding.saturating_sub(amount);
        
        emit_cpi!(SolReclaimed {
            loan_id: loan.loan_id,
            amount,
            total_reclaimed: loan.reclaimed_amount.unwrap_or(0),
        });
        
        Ok(())
    }

    #[event_cpi]
#[derive(Accounts)]
pub struct ReturnReclaimedSol<'info> {
    pub caller: Signer<'info>,
    
    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump,
        constraint = caller.key() == protocol_config.admin || caller.key() == protocol_config.deployer @ ErrorCode::Unauthorized
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    #[account(
        mut,
        seeds = [LOAN_SEED, loan.loan_id.to_le_bytes().as_ref(), &loan.borrower.to_bytes()],
        bump = loan.bump
    )]
    pub loan: Account<'info, Loan>,
    
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: AccountInfo<'info>,
    
    /// CHECK: Deployer that holds reclaimed SOL may not need this
    #[account(mut)]
    pub deployer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}