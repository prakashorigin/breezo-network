use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("Drjkw9tB67BavRW1KVVADTqVKVFMkSjtj9Mgwnsz8mZx");

#[program]
pub mod breezo_rewards {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        emit!(ProgramInitialized { authority: config.authority });
        Ok(())
    }

    pub fn register_sensor(ctx: Context<RegisterSensor>, sensor_id: String) -> Result<()> {
        require!(!sensor_id.is_empty() && sensor_id.len() <= MAX_SENSOR_ID_BYTES, BreezoError::InvalidSensorId);
        let sensor = &mut ctx.accounts.sensor;
        sensor.owner = ctx.accounts.owner.key();
        sensor.sensor_id = sensor_id.clone();
        sensor.is_verified = false;
        sensor.is_active = true;
        sensor.pending_rewards = 0;
        sensor.claimed_rewards = 0;
        sensor.bump = ctx.bumps.sensor;
        emit!(SensorRegistered { owner: sensor.owner, sensor_id, sensor: sensor.key() });
        Ok(())
    }

    pub fn verify_sensor(ctx: Context<VerifySensor>) -> Result<()> {
        require!(!ctx.accounts.sensor.is_verified, BreezoError::AlreadyVerified);
        ctx.accounts.sensor.is_verified = true;
        emit!(SensorVerified { sensor: ctx.accounts.sensor.key(), authority: ctx.accounts.authority.key() });
        Ok(())
    }

    pub fn update_sensor(ctx: Context<UpdateSensor>, is_active: bool) -> Result<()> {
        ctx.accounts.sensor.is_active = is_active;
        emit!(SensorUpdated { sensor: ctx.accounts.sensor.key(), owner: ctx.accounts.owner.key(), is_active });
        Ok(())
    }

    pub fn grant_sensor_access(ctx: Context<GrantSensorAccess>) -> Result<()> {
        let grant = &mut ctx.accounts.access;
        grant.sensor = ctx.accounts.sensor.key();
        grant.operator = ctx.accounts.operator.key();
        grant.bump = ctx.bumps.access;
        emit!(SensorAccessGranted { sensor: grant.sensor, operator: grant.operator });
        Ok(())
    }

    pub fn revoke_sensor_access(ctx: Context<RevokeSensorAccess>) -> Result<()> {
        emit!(SensorAccessRevoked { sensor: ctx.accounts.sensor.key(), operator: ctx.accounts.access.operator });
        Ok(())
    }

    pub fn update_sensor_status(ctx: Context<UpdateSensorStatus>, is_active: bool) -> Result<()> {
        ctx.accounts.sensor.is_active = is_active;
        emit!(SensorUpdated { sensor: ctx.accounts.sensor.key(), owner: ctx.accounts.sensor.owner, is_active });
        Ok(())
    }

    pub fn record_reward(ctx: Context<RecordReward>, amount: u64) -> Result<()> {
        require!(amount > 0, BreezoError::InvalidRewardAmount);
        require!(ctx.accounts.sensor.is_verified, BreezoError::SensorNotVerified);
        require!(ctx.accounts.sensor.is_active, BreezoError::SensorInactive);
        ctx.accounts.sensor.pending_rewards = ctx.accounts.sensor.pending_rewards.checked_add(amount).ok_or(BreezoError::ArithmeticOverflow)?;
        emit!(RewardRecorded { sensor: ctx.accounts.sensor.key(), owner: ctx.accounts.sensor.owner, amount, pending_total: ctx.accounts.sensor.pending_rewards });
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let amount = ctx.accounts.sensor.pending_rewards;
        require!(amount > 0, BreezoError::NoPendingRewards);
        let mint_key = ctx.accounts.reward_mint.key();
        let bump = [ctx.bumps.treasury];
        let signer_seeds: &[&[u8]] = &[b"treasury", mint_key.as_ref(), &bump];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.treasury_tokens.to_account_info(),
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.treasury.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
            ctx.accounts.reward_mint.decimals,
        )?;
        ctx.accounts.sensor.pending_rewards = 0;
        ctx.accounts.sensor.claimed_rewards = ctx.accounts.sensor.claimed_rewards.checked_add(amount).ok_or(BreezoError::ArithmeticOverflow)?;
        emit!(RewardClaimed { sensor: ctx.accounts.sensor.key(), owner: ctx.accounts.owner.key(), amount });
        Ok(())
    }
}

pub const MAX_SENSOR_ID_BYTES: usize = 32;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = Config::SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sensor_id: String)]
pub struct RegisterSensor<'info> {
    #[account(init, payer = owner, space = SensorAccount::SPACE, seeds = [b"sensor", owner.key().as_ref(), sensor_id.as_bytes()], bump)]
    pub sensor: Account<'info, SensorAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifySensor<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    /// CHECK: Owner is included in the sensor PDA seeds and verified against the stored owner.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, constraint = sensor.owner == owner.key())]
    pub sensor: Account<'info, SensorAccount>,
}

#[derive(Accounts)]
pub struct UpdateSensor<'info> {
    #[account(mut, seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, has_one = owner)]
    pub sensor: Account<'info, SensorAccount>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GrantSensorAccess<'info> {
    #[account(mut, seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, has_one = owner)]
    pub sensor: Account<'info, SensorAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: The owner grants access to this public key; it does not need to sign this instruction.
    pub operator: UncheckedAccount<'info>,
    #[account(init, payer = owner, space = SensorAccess::SPACE, seeds = [b"access", sensor.key().as_ref(), operator.key().as_ref()], bump)]
    pub access: Account<'info, SensorAccess>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeSensorAccess<'info> {
    #[account(seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, has_one = owner)]
    pub sensor: Account<'info, SensorAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Its key is checked against the access PDA seeds and stored grant.
    pub operator: UncheckedAccount<'info>,
    #[account(mut, close = owner, seeds = [b"access", sensor.key().as_ref(), operator.key().as_ref()], bump = access.bump, constraint = access.sensor == sensor.key(), constraint = access.operator == operator.key())]
    pub access: Account<'info, SensorAccess>,
}

#[derive(Accounts)]
pub struct UpdateSensorStatus<'info> {
    #[account(mut, seeds = [b"sensor", sensor.owner.as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump)]
    pub sensor: Account<'info, SensorAccount>,
    pub operator: Signer<'info>,
    #[account(seeds = [b"access", sensor.key().as_ref(), operator.key().as_ref()], bump = access.bump, constraint = access.sensor == sensor.key(), constraint = access.operator == operator.key())]
    pub access: Account<'info, SensorAccess>,
}

#[derive(Accounts)]
pub struct RecordReward<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    /// CHECK: Sensor owner is authenticated by the sensor PDA seed and stored owner constraint.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, constraint = sensor.owner == owner.key())]
    pub sensor: Account<'info, SensorAccount>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut, seeds = [b"sensor", owner.key().as_ref(), sensor.sensor_id.as_bytes()], bump = sensor.bump, has_one = owner)]
    pub sensor: Account<'info, SensorAccount>,
    pub owner: Signer<'info>,
    pub reward_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: This PDA signs transfers from its associated treasury token account.
    #[account(seeds = [b"treasury", reward_mint.key().as_ref()], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, constraint = treasury_tokens.owner == treasury.key(), constraint = treasury_tokens.mint == reward_mint.key())]
    pub treasury_tokens: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = destination.owner == owner.key(), constraint = destination.mint == reward_mint.key())]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
pub struct Config { pub authority: Pubkey, pub bump: u8 }
impl Config { pub const SPACE: usize = 8 + 32 + 1; }

#[account]
pub struct SensorAccount {
    pub owner: Pubkey,
    pub sensor_id: String,
    pub is_verified: bool,
    pub is_active: bool,
    pub pending_rewards: u64,
    pub claimed_rewards: u64,
    pub bump: u8,
}
impl SensorAccount { pub const SPACE: usize = 8 + 32 + 4 + MAX_SENSOR_ID_BYTES + 1 + 1 + 8 + 8 + 1; }

#[account]
pub struct SensorAccess { pub sensor: Pubkey, pub operator: Pubkey, pub bump: u8 }
impl SensorAccess { pub const SPACE: usize = 8 + 32 + 32 + 1; }

#[event]
pub struct ProgramInitialized { pub authority: Pubkey }
#[event]
pub struct SensorRegistered { pub owner: Pubkey, pub sensor_id: String, pub sensor: Pubkey }
#[event]
pub struct SensorVerified { pub sensor: Pubkey, pub authority: Pubkey }
#[event]
pub struct SensorUpdated { pub sensor: Pubkey, pub owner: Pubkey, pub is_active: bool }
#[event]
pub struct SensorAccessGranted { pub sensor: Pubkey, pub operator: Pubkey }
#[event]
pub struct SensorAccessRevoked { pub sensor: Pubkey, pub operator: Pubkey }
#[event]
pub struct RewardRecorded { pub sensor: Pubkey, pub owner: Pubkey, pub amount: u64, pub pending_total: u64 }
#[event]
pub struct RewardClaimed { pub sensor: Pubkey, pub owner: Pubkey, pub amount: u64 }

#[error_code]
pub enum BreezoError {
    #[msg("Sensor identifier must contain between 1 and 32 UTF-8 bytes.")]
    InvalidSensorId,
    #[msg("Sensor has already been verified.")]
    AlreadyVerified,
    #[msg("Reward amount must be greater than zero.")]
    InvalidRewardAmount,
    #[msg("Only verified sensors can accrue rewards.")]
    SensorNotVerified,
    #[msg("Inactive sensors cannot accrue rewards.")]
    SensorInactive,
    #[msg("Reward arithmetic overflow.")]
    ArithmeticOverflow,
    #[msg("There are no pending rewards to claim.")]
    NoPendingRewards,
}
