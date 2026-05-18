use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::consts::{PROTOCOL_CONFIG_SEED, VAULT_SEED, AUTHORITY_SEED, ADMIN_SEED, TREASURY_SEED};
use crate::events::ProtocolInitialized;

/// Initialize the protocol with admin and configuration
    pub fn process_initialize(
        ctx: Context<Initialize>,
        admin_fee_split_bps: u16,  // % of admin fee to depositors vs protocol
        default_interest_rate_bps: u16,
        default_admin_fee_bps: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.deployer = ctx.accounts.deployer.key();
        config.bump = ctx.bumps.protocol_config;
        config.admin_fee_split_bps = admin_fee_split_bps;
        config.default_interest_rate_bps = default_interest_rate_bps;
        config.default_admin_fee_bps = default_admin_fee_bps;
       // config.total_deposits = 0;
        config.total_loans_outstanding = 0;
        config.total_yield_distributed = 0;
        config.total_shares = 0;
        config.is_paused = false;
        config.loan_counter = 0;
        
        
        emit_cpi!(ProtocolInitialized {
            admin: ctx.accounts.admin.key(),
            treasury: ctx.accounts.treasury.key(),
        });
        
        Ok(())
    }

#[event_cpi]
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::SIZE,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    /// CHECK: Vault PDA for storing deposits
    #[account(
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: AccountInfo<'info>,
    /* */
    /// CHECK: Authority PDA for program upgrade authority
    #[account(
        seeds = [AUTHORITY_SEED],
        bump
    )]
    pub authority_pda: AccountInfo<'info>,
    
    /// CHECK: Admin fee collection PDA
    #[account(
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_pda: AccountInfo<'info>,
    
    /// CHECK: Treasury PDA
    #[account(
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Deployer that receives funds for deployment
    pub deployer: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}