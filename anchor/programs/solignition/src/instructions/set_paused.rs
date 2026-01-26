 use anchor_lang::prelude::*;
 use crate::events::ProtocolPausedChanged;
 use super::AdminAction;
 
// Admin function to pause/unpause protocol
pub fn process_set_paused(ctx: Context<AdminAction>, is_paused: bool) -> Result<()> {
        ctx.accounts.protocol_config.is_paused = is_paused;
        
        emit!(ProtocolPausedChanged {
            is_paused,
        });
        
        Ok(())
}
