use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::ProtocolConfig;
use crate::consts::PROTOCOL_CONFIG_SEED;

#[event_cpi]
#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        has_one = admin @ ErrorCode::Unauthorized,
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
}
