#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("Count3AcZucFDPSFBAeHkQ6AvttieKUkyJ8HiQGhQwe");

#[program]
pub mod solignition {
    use super::*;

    pub fn close(_ctx: Context<CloseSolignition>) -> Result<()> {
        Ok(())
    }

    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        ctx.accounts.solignition.count = ctx.accounts.solignition.count.checked_sub(1).unwrap();
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        ctx.accounts.solignition.count = ctx.accounts.solignition.count.checked_add(1).unwrap();
        Ok(())
    }

    pub fn initialize(_ctx: Context<InitializeSolignition>) -> Result<()> {
        Ok(())
    }

    pub fn set(ctx: Context<Update>, value: u8) -> Result<()> {
        ctx.accounts.solignition.count = value.clone();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeSolignition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
  init,
  space = 8 + Solignition::INIT_SPACE,
  payer = payer
    )]
    pub solignition: Account<'info, Solignition>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CloseSolignition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
  mut,
  close = payer, // close account and return lamports to payer
    )]
    pub solignition: Account<'info, Solignition>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub solignition: Account<'info, Solignition>,
}

#[account]
#[derive(InitSpace)]
pub struct Solignition {
    count: u8,
}
