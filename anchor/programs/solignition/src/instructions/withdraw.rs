use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::{DepositorRecord, ProtocolConfig};
use crate::consts::{PROTOCOL_CONFIG_SEED, DEPOSITOR_SEED, VAULT_SEED, SHARE_DECIMALS};
use crate::events::Withdrawn;

pub fn process_withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
    require!(!ctx.accounts.protocol_config.is_paused, ErrorCode::ProtocolPaused);
    require!(shares > 0, ErrorCode::InvalidAmount);

    let protocol_config = &mut ctx.accounts.protocol_config;
    let depositor_record = &mut ctx.accounts.depositor_record;

    require!(
        shares <= depositor_record.share_amount,
        ErrorCode::InsufficientBalance
    );

    // READ VAULT BALANCE
    let vault_balance_total = ctx.accounts.vault.lamports() + protocol_config.total_loans_outstanding;

    // CALCULATE SHARE PRICE
    let share_price = (vault_balance_total as u128)
        .checked_mul(SHARE_DECIMALS)
        .unwrap()
        .checked_div(protocol_config.total_shares as u128)
        .unwrap();

    // CONVERT SHARES → ASSETS
    let amount = (shares as u128)
        .checked_mul(share_price)
        .unwrap()
        .checked_div(SHARE_DECIMALS)
        .unwrap() as u64;

    // CHECK AVAILABLE LIQUIDITY = VAULT BALANCE 
    let available = ctx.accounts.vault.lamports();
    require!(amount <= available, ErrorCode::InsufficientLiquidity);

    // Decrement deposited_amount in proportion to the shares being burned.
    // Without this, deposited_amount is a monotonic lifetime counter and the
    // frontend's "earnings = currentValue - depositedAmount" formula goes
    // negative after every withdrawal. We compute the proportional principal
    // BEFORE burning shares (the denominator is the pre-burn share count).
    //
    // principal_withdrawn = deposited_amount * shares / share_amount
    let principal_withdrawn = (depositor_record.deposited_amount as u128)
        .checked_mul(shares as u128)
        .unwrap()
        .checked_div(depositor_record.share_amount as u128)
        .unwrap() as u64;
    depositor_record.deposited_amount = depositor_record
        .deposited_amount
        .saturating_sub(principal_withdrawn);

    // BURN SHARES
    depositor_record.share_amount = depositor_record
        .share_amount
        .saturating_sub(shares);
    protocol_config.total_shares = protocol_config
        .total_shares
        .saturating_sub(shares);

    // TRANSFER SOL OUT OF VAULT
    let vault_seeds = &[VAULT_SEED, &[ctx.bumps.vault]];
    let signer = &[&vault_seeds[..]];


    /* 
    let ix = system_instruction::transfer(
        &ctx.accounts.vault.key(),
        &ctx.accounts.depositor.key(),
        amount,
    );
    invoke_signed(
        &ix,
        &[
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.depositor.to_account_info(),
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
                    to: ctx.accounts.depositor.to_account_info(),
                },
                signer,
            ),
            amount
        )?;

    depositor_record.last_update_ts = Clock::get()?.unix_timestamp;

    emit_cpi!(Withdrawn {
        depositor: ctx.accounts.depositor.key(),
        amount,
        shares_burned: shares,
        remaining_shares: depositor_record.share_amount,
    });

    Ok(())
    }


#[event_cpi]
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    #[account(
        mut,
        seeds = [DEPOSITOR_SEED, depositor.key().as_ref()],
        bump = depositor_record.bump,
        constraint = depositor_record.owner == depositor.key() @ ErrorCode::UnauthorizedDepositor
    )]
    pub depositor_record: Account<'info, DepositorRecord>,
    
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

    /*/ CHECK: treasury PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury_pda: AccountInfo<'info>,*/
    
    pub system_program: Program<'info, System>,
}