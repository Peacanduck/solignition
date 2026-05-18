use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::error::ErrorCode;
use crate::state::ProtocolConfig;
use crate::consts::{PROTOCOL_CONFIG_SEED, ADMIN_SEED};

pub fn process_claim_admin(ctx: Context<ClaimAdmin>) -> Result<()> {
        require!(ctx.accounts.admin.key() == ctx.accounts.protocol_config.admin, ErrorCode::Unauthorized);
        let amount = ctx.accounts.admin_pda.to_account_info().lamports();
        require!(amount > 0, ErrorCode::InsufficientLiquidity);
        let admin_seeds = &[ADMIN_SEED, &[ctx.bumps.admin_pda]];
        let signer = &[&admin_seeds[..]];
        /* 
        let ix = system_instruction::transfer(
            &ctx.accounts.admin_pda.key(),
            &ctx.accounts.protocol_config.treasury.key(),
            amount,
        );
        invoke_signed(
            &ix,
            &[
                ctx.accounts.admin_pda.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;*/

         transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_pda.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        Ok(())
    }

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimAdmin<'info> {
    pub admin: Signer<'info>,

    /// CHECK: admin pda
    #[account(
        mut,
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_pda: AccountInfo<'info>,
    
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        has_one = admin @ ErrorCode::Unauthorized,
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        address = protocol_config.treasury
    )]
    /// CHECK: treasury wallet
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}