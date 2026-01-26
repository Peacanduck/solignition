use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::{DepositorRecord, ProtocolConfig};
use crate::utils::{calculate_shares_for_deposit};
use crate::consts::{PROTOCOL_CONFIG_SEED, DEPOSITOR_SEED, VAULT_SEED};
use crate::events::Deposited;

/// Deposit SOL into the vault
    pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.protocol_config.is_paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let protocol_config = &mut ctx.accounts.protocol_config;
        // Calculate shares to mint based on current share price
        let shares_to_mint = calculate_shares_for_deposit(&protocol_config, amount, ctx.accounts.vault.to_account_info().lamports());

        // Transfer SOL from depositor to vault 
        /* 
        let ix = system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.vault.key(),
            amount,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;*/

        transfer(
         CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
         ),
         amount,
        )?;

        // Update or create depositor record
        let depositor_record = &mut ctx.accounts.depositor_record;
        
        //let deposit_ratio = amount.checked_div(protocol_config.total_deposits).unwrap();
        //let depositors_shares = protocol_config.total_shares.checked_mul(deposit_ratio).unwrap();
        
        depositor_record.owner = ctx.accounts.depositor.key();
        depositor_record.deposited_amount = depositor_record.deposited_amount.checked_add(amount).unwrap();
        depositor_record.share_amount = depositor_record.share_amount.checked_add(shares_to_mint).unwrap(); 
        depositor_record.last_update_ts = Clock::get()?.unix_timestamp;
        depositor_record.bump = ctx.bumps.depositor_record;

        // Update protocol deposits
       // protocol_config.total_deposits = protocol_config.total_deposits.checked_add(amount).unwrap();protocol_config.total_deposits
        protocol_config.total_shares = protocol_config.total_shares.checked_add(shares_to_mint).unwrap();

        emit!(Deposited {
            depositor: ctx.accounts.depositor.key(),
            amount,
            total_shares: protocol_config.total_shares ,
        });

        Ok(())
    }


#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + DepositorRecord::SIZE,
        seeds = [DEPOSITOR_SEED, depositor.key().as_ref()],
        bump
    )]
    pub depositor_record: Account<'info, DepositorRecord>,
    
    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    /// CHECK: Vault PDA for loan requests
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}