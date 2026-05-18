use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::events::ConfigUpdated;
use super::AdminAction;


/// Admin function to update configuration
    pub fn process_update_config(
        ctx: Context<AdminAction>,
        admin_fee_split_bps: Option<u16>,
        default_interest_rate_bps: Option<u16>,
        default_admin_fee_bps: Option<u16>,
        deployer: Option<Pubkey>,
        treasury: Option<Pubkey>,
        admin: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        
        if let Some(split) = admin_fee_split_bps {
            require!(split <= 10000, ErrorCode::InvalidParameter);
            config.admin_fee_split_bps = split;
        }
        
        if let Some(rate) = default_interest_rate_bps {
            require!(rate <= 10000, ErrorCode::InvalidParameter);
            config.default_interest_rate_bps = rate;
        }
        
        if let Some(fee) = default_admin_fee_bps {
            require!(fee <= 10000, ErrorCode::InvalidParameter);
            config.default_admin_fee_bps = fee;
        }
        
        if let Some(deployer) = deployer {
            config.deployer = deployer;
        }
        
        if let Some(treasury) = treasury {
            config.treasury = treasury;
        }

        if let Some(admin) = admin {
            config.admin = admin;
        }
        
        emit_cpi!(ConfigUpdated {
            admin_fee_split_bps: config.admin_fee_split_bps,
            default_interest_rate_bps: config.default_interest_rate_bps,
            default_admin_fee_bps: config.default_admin_fee_bps,
        });
        
        Ok(())
    }
