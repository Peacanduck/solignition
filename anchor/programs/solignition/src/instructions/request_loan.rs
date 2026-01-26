use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::{Loan, LoanState, ProtocolConfig};
use crate::utils::distribute_yield;
use crate::consts::{VAULT_SEED, ADMIN_SEED, LOAN_SEED, PROTOCOL_CONFIG_SEED};
use crate::events::LoanRequested;



/// Request a loan and pay upfront admin fee
    pub fn process_request_loan(
        ctx: Context<RequestLoan>,
        principal: u64,
        duration: i64,
        interest_rate_bps: u16,
        admin_fee_bps: u16,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.is_paused, ErrorCode::ProtocolPaused);
        require!(principal > 0, ErrorCode::InvalidAmount);
        let config = &mut ctx.accounts.protocol_config;

        require!(duration > 0, ErrorCode::InvalidDuration);
        require!(interest_rate_bps <= 10000 && interest_rate_bps >= config.default_interest_rate_bps, ErrorCode::InvalidInterestRate);
        require!(admin_fee_bps <= 10000 && admin_fee_bps >= config.default_admin_fee_bps , ErrorCode::InvalidAdminFee);

        //require!(ctx.accounts.protocol_config.loan_counter == , ErrorCode::InvalidLoanCounter);

        // Calculate upfront admin fee
        let fee_total = (principal as u128)
            .checked_mul(admin_fee_bps as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        //Calculate split to pool treasury based of config admin fee split bps
        let admin_fee = (fee_total as u128)
            .checked_mul((config.admin_fee_split_bps) as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        let treasury_share = fee_total - admin_fee;

        // Check vault has sufficient liquidity
        let available = ctx.accounts.vault.lamports();//ctx.accounts.protocol_config.total_deposits.saturating_sub(ctx.accounts.protocol_config.total_loans_outstanding);
        require!(principal <= available, ErrorCode::InsufficientLiquidity);
        
        // pay 0.02 offset incase of defualt 
        /* 
        let ix = system_instruction::transfer(
                &ctx.accounts.borrower.key(),
                &ctx.accounts.deployer.key(),
                20000000,
            );
            invoke(
                &ix,
                &[
                    ctx.accounts.borrower.to_account_info(),
                    ctx.accounts.deployer.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        */
        transfer(
         CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.deployer.to_account_info(),
            },
         ),
         20000000,
        )?;

        // Pay admin fee directly to admin PDA
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
        // Pay treasury share directly to vault
        if treasury_share > 0 {
            /* 
            let ix = system_instruction::transfer(
                &ctx.accounts.borrower.key(),
                &ctx.accounts.vault.key(),
                treasury_share,
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
         treasury_share,
        )?;
        }

        //update share price
        distribute_yield(&mut ctx.accounts.protocol_config, treasury_share);

        // Transfer principal from vault to deployer
        // The deployer will handle program deployment off-chain
        // Any unused or reclaimed SOL can be returned via return_reclaimed_sol
        let vault_seeds = &[VAULT_SEED, &[ctx.bumps.vault]];
        let signer = &[&vault_seeds[..]];
        /* 
        let ix = system_instruction::transfer(
        &ctx.accounts.vault.key(),
        &ctx.accounts.deployer.key(),
        principal,
         );
        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.deployer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        */
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.deployer.to_account_info(),
                },
                signer,
            ),
            principal
        )?;
        
        // Create loan record
        let loan = &mut ctx.accounts.loan;
        loan.loan_id = ctx.accounts.protocol_config.loan_counter;
        loan.borrower = ctx.accounts.borrower.key();
        loan.program_pubkey = Pubkey::default(); // Will be set after deployment
        loan.principal = principal;
        loan.duration = duration;
        loan.interest_rate_bps = interest_rate_bps;
        loan.admin_fee_bps = admin_fee_bps;
        loan.admin_fee_paid = fee_total;
        loan.start_ts = Clock::get()?.unix_timestamp;
        loan.state = LoanState::Pending;
        loan.repaid_ts = Some(0);
        loan.recovered_ts = Some(0);
        loan.interest_paid = Some(0);
        loan.reclaimed_amount = Some(0);
        loan.reclaimed_ts = Some(0);
        loan.bump = ctx.bumps.loan;

        // Update protocol state
        ctx.accounts.protocol_config.total_loans_outstanding += principal;
        ctx.accounts.protocol_config.loan_counter += 1;

        emit_cpi!(LoanRequested {
            borrower: ctx.accounts.borrower.key(),
            loan_id: loan.loan_id,
            principal,
            duration,
            interest_rate_bps,
            admin_fee: fee_total,
        });

        Ok(())
    }

#[event_cpi]
#[derive(Accounts)]
//#[instruction(loan_id: u64)]
pub struct RequestLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    
    #[account(
        init,
        payer = borrower,
        space = 8 + Loan::SIZE,
        seeds = [LOAN_SEED, protocol_config.loan_counter.to_le_bytes().as_ref(), &borrower.key().to_bytes()],
        bump
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
    
    /// CHECK: Admin fee collection PDA
    #[account(
        mut,
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_pda: AccountInfo<'info>,

    /*/ CHECK: treasury fee collection PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury_pda: AccountInfo<'info>,*/
    
    
    /// CHECK: Deployer wallet - receives funds for deployment
    #[account(
        mut,
        constraint = deployer.key() == protocol_config.deployer @ ErrorCode::Unauthorized
    )]
    pub deployer: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}