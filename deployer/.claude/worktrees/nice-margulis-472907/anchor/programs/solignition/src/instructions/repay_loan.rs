use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::{Loan, LoanState, ProtocolConfig};
use crate::utils::{calculate_interest, distribute_yield};
use crate::consts::{LOAN_SEED, PROTOCOL_CONFIG_SEED, VAULT_SEED, ADMIN_SEED};
use crate::events::LoanRepaid;


/// Repay an active loan with interest
    pub fn process_repay_loan(ctx: Context<RepayLoan>, loan_id: u64) -> Result<()> {
    require!(!ctx.accounts.protocol_config.is_paused, ErrorCode::ProtocolPaused);
    
    let loan = &ctx.accounts.loan;
    require!(loan.state == LoanState::Active, ErrorCode::LoanNotActive);
    require!(loan.borrower == ctx.accounts.borrower.key(), ErrorCode::UnauthorizedBorrower);
    require!(loan.loan_id == loan_id, ErrorCode::InvalidLoanId);

    let clock = Clock::get()?;
    let elapsed = clock.unix_timestamp
    .checked_sub(loan.start_ts)
    .ok_or(ErrorCode::ClockError)? as u64;

    require!(elapsed < loan.duration as u64, ErrorCode::LoanExpired);
    
    // Calculate interest
    let interest = calculate_interest(
        loan.principal,
        loan.interest_rate_bps,
        elapsed,
        loan.duration as u64,
    );


    //Calculate split to pool treasury based of config admin fee split bps
    let admin_fee = (interest as u128)
            .checked_mul((ctx.accounts.protocol_config.admin_fee_split_bps) as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;
        
    //let treasury_share = interest - admin_fee;

    // transfers admins fee from borrower to admin pda
    if admin_fee > 0 {
        /* 
            let ix = system_instruction::transfer(
                &ctx.accounts.borrower.key(),
                &ctx.accounts.admin_pda.key(),
                admin_fee,
            );
            invoke(
                &ix,
                &[
                    ctx.accounts.borrower.to_account_info(),
                    ctx.accounts.admin_pda.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        */
            transfer(
         CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.admin_pda.to_account_info(),
            },
         ),
         admin_fee,
        )?;
    }
    
    let vault_fee = interest - admin_fee;
    let vault_total_due = loan.principal + vault_fee;

    // Transfer repayment from borrower to vault
    /* 
    let ix = system_instruction::transfer(
        &ctx.accounts.borrower.key(),
        &ctx.accounts.vault.key(),
        vault_total_due,
    );
    invoke(
        &ix,
        &[
            ctx.accounts.borrower.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    */

    transfer(
         CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
         ),
         vault_total_due,
        )?;

    // track yield to depositors
    distribute_yield(&mut ctx.accounts.protocol_config, interest);

    // Update loan state - marked as paid but authority not yet transferred
    let loan = &mut ctx.accounts.loan;
    loan.state = LoanState::RepaidPendingTransfer;
    loan.repaid_ts = Some(clock.unix_timestamp);
    loan.interest_paid = Some(interest);

    // Update protocol state
    ctx.accounts.protocol_config.total_loans_outstanding = ctx.accounts.protocol_config.total_loans_outstanding.saturating_sub(loan.principal);

    emit_cpi!(LoanRepaid {
        loan_id: loan.loan_id,
        total_repaid: vault_total_due + admin_fee,
        interest_paid: interest,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(loan_id: u64)]
pub struct RepayLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    
    #[account(
        mut,
        has_one = borrower @ ErrorCode::UnauthorizedBorrower,
        seeds = [LOAN_SEED, loan_id.to_le_bytes().as_ref(), &borrower.key().to_bytes()],
        bump = loan.bump
    )]
    pub loan: Account<'info, Loan>,
    
    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: admin PDA
    #[account(
        mut,
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_pda: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}