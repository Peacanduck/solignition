use anchor_lang::error_code;

#[error_code]
pub enum ErrorCode {
    #[msg("Protocol is currently paused")]  //0
    ProtocolPaused,
    #[msg("Invalid amount provided")] //1
    InvalidAmount,
    #[msg("Insufficient balance")] //2
    InsufficientBalance,
    #[msg("Insufficient liquidity in vault")] //3
    InsufficientLiquidity,
    #[msg("Invalid duration")] //4
    InvalidDuration,
    #[msg("Invalid interest rate")] //5
    InvalidInterestRate,
    #[msg("Invalid admin fee")] //6
    InvalidAdminFee,
    #[msg("Loan is not active")]    //7 
    LoanNotActive,
    #[msg("Unauthorized borrower")]   //8
    UnauthorizedBorrower,
    #[msg("Loan has not expired yet")]  //9
    LoanNotExpired,
    #[msg("Loan has not been recovered")] //10
    LoanNotRecovered,
    #[msg("Loan has not been repaid")] //11
    LoanNotRepaid,
    #[msg("Unauthorized action")]  //12
    Unauthorized,
    #[msg("Invalid parameter")]
    InvalidParameter,
    #[msg("Unauthorized depositor")]
    UnauthorizedDepositor,
    #[msg("Invalid loan ID")]
    InvalidLoanId,
    #[msg("Program already set for this loan")]
    ProgramAlreadySet,
    #[msg("Invalid program pubkey")]
    InvalidProgram,
    #[msg("Error in calculations")]
    MathOverflow,
    #[msg("No yield to claim")]
    NoYieldToClaim,
    #[msg("Loan has expired and can no longer be repaid")]
    LoanExpired,
    #[msg("Error calculating elapsed time")]
    ClockError,
}