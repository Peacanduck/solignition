import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import type { Solignition } from "../../anchor/target/types/solignition";
import idl from "../../anchor/target/idl/solignition.json";
import { AnchorWallet } from "@solana/wallet-adapter-react";

/**
 * SolignitionClient - A TypeScript client for interacting with the Solignition program
 */
export class SolignitionClient {
  program: Program<Solignition>;
  provider: AnchorProvider;
  programId: PublicKey;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.programId = new PublicKey(idl.address);
    this.program = new Program(idl as Solignition, provider);
  }

  /**
   * Create a client instance from a connection and wallet
   */
  static fromConnection(connection: Connection, wallet: any): SolignitionClient {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new SolignitionClient(provider);
  }

  // ============================================================================
  // PDA Derivation Methods
  // ============================================================================

  getProtocolConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );
  }

  getVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      this.programId
    );
  }

  getAuthorityPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      this.programId
    );
  }

  getAdminPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("admin")],
      this.programId
    );
  }

  getTreasuryPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      this.programId
    );
  }

  getEventAuthorityPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      this.programId
    );
  }

  getDepositorRecordPda(depositor: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor.toBuffer()],
      this.programId
    );
  }

  getLoanPda(loanId: BN, borrower: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("loan"),
        loanId.toArrayLike(Buffer, "le", 8),
        borrower.toBuffer(),
      ],
      this.programId
    );
  }

  // ============================================================================
  // Instruction Methods
  // ============================================================================

  /**
   * Initialize the protocol
   */
  async initialize(
    admin: Keypair,
    deployer: PublicKey,
    adminFeeSplitBps: number,
    defaultInterestRateBps: number,
    defaultAdminFeeBps: number
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [vault] = this.getVaultPda();
    const [authorityPda] = this.getAuthorityPda();
    const [adminPda] = this.getAdminPda();
    const [treasury] = this.getTreasuryPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .initialize(adminFeeSplitBps, defaultInterestRateBps, defaultAdminFeeBps)
      .accounts({
        admin: admin.publicKey,
        protocolConfig,
        vault,
        authorityPda,
        adminPda,
        treasury,
        deployer,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([admin])
      .rpc();
  }

  /**
   * Deposit SOL into the protocol
   */
  async deposit(depositor: Keypair, amount: BN) {
    const [depositorRecord] = this.getDepositorRecordPda(depositor.publicKey);
    const [protocolConfig] = this.getProtocolConfigPda();
    const [vault] = this.getVaultPda();

    return await this.program.methods
      .deposit(amount)
      .accounts({
        depositor: depositor.publicKey,
        depositorRecord,
        protocolConfig,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();
  }

  /**
   * Withdraw SOL from the protocol
   */
  async withdraw(depositor: Keypair, shares: BN) {
    const [depositorRecord] = this.getDepositorRecordPda(depositor.publicKey);
    const [protocolConfig] = this.getProtocolConfigPda();
    const [vault] = this.getVaultPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .withdraw(shares)
      .accounts({
        depositor: depositor.publicKey,
        depositorRecord,
        protocolConfig,
        vault,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([depositor])
      .rpc();
  }

  /**
   * Request a loan
   */
  async requestLoan(
    borrower: Keypair,
    //deployer: PublicKey,
    principal: BN,
    duration: BN,
    interestRateBps: number,
    adminFeeBps: number
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const config = await this.program.account.protocolConfig.fetch(protocolConfig);
    
    const [loan] = this.getLoanPda(config.loanCounter, borrower.publicKey);
    const [vault] = this.getVaultPda();
    const [adminPda] = this.getAdminPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .requestLoan(principal, duration, interestRateBps, adminFeeBps)
      .accounts({
        borrower: borrower.publicKey,
        loan,
        protocolConfig,
        vault,
        adminPda,
        deployer: config.deployer,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([borrower])
      .rpc();
  }

  /**
   * Repay a loan
   */
  async repayLoan(borrower: Keypair, loanId: BN) {
    const [loan] = this.getLoanPda(loanId, borrower.publicKey);
    const [protocolConfig] = this.getProtocolConfigPda();
    const [vault] = this.getVaultPda();
    const [adminPda] = this.getAdminPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .repayLoan(loanId)
      .accounts({
        borrower: borrower.publicKey,
        loan,
        protocolConfig,
        vault,
        adminPda,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([borrower])
      .rpc();
  }

  /**
   * Set the deployed program for a loan
   */
  async setDeployedProgram(
    admin: Keypair,
    loanId: BN,
    borrower: PublicKey,
    programPubkey: PublicKey
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [loan] = this.getLoanPda(loanId, borrower);
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .setDeployedProgram(loanId, programPubkey)
      .accounts({
        admin,
        protocolConfig,
        loan,
        eventAuthority,
        program: this.programId,
      })
      .signers([admin])
      .rpc();
  }

  /**
   * Transfer authority to borrower
   */
  async transferAuthorityToBorrower(
    deployer: Keypair,
    loanId: BN,
    borrower: PublicKey,
    programData: PublicKey
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [loan] = this.getLoanPda(loanId, borrower);
    const [eventAuthority] = this.getEventAuthorityPda();

    const BPF_UPGRADEABLE_LOADER = new PublicKey(
      "BPFLoaderUpgradeab1e11111111111111111111111"
    );

    return await this.program.methods
      .transferAuthorityToBorrower(loanId)
      .accounts({
        deployer: deployer.publicKey,
        protocolConfig,
        loan,
        borrower,
        programData,
        bpfUpgradeableLoader: BPF_UPGRADEABLE_LOADER,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([deployer])
      .rpc();
  }

  /**
   * Recover a loan (admin only, after expiration)
   */
  async recoverLoan(
    admin: PublicKey,
    deployer: PublicKey,
    loanId: BN,
    borrower: PublicKey,
    treasury: PublicKey
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [loan] = this.getLoanPda(loanId, borrower);
    const [adminPda] = this.getAdminPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .recoverLoan()
      .accounts({
        admin,
        protocolConfig,
        loan,
        deployer,
        adminPda,
        treasury,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .rpc();
  }

  /**
   * Return reclaimed SOL to the vault
   */
  async returnReclaimedSol(
    caller: PublicKey,
    deployer: PublicKey,
    loanId: BN,
    borrower: PublicKey,
    amount: BN
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [loan] = this.getLoanPda(loanId, borrower);
    const [vault] = this.getVaultPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .returnReclaimedSol(amount)
      .accounts({
        caller,
        protocolConfig,
        loan,
        vault,
        deployer,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .rpc();
  }

  /**
   * Update protocol configuration (admin only)
   */
  async updateConfig(
    admin: Keypair,
    params: {
      adminFeeSplitBps?: number;
      defaultInterestRateBps?: number;
      defaultAdminFeeBps?: number;
      deployer?: PublicKey;
      treasury?: PublicKey;
      admin?: PublicKey;
    }
  ) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .updateConfig(
        params.adminFeeSplitBps ?? null,
        params.defaultInterestRateBps ?? null,
        params.defaultAdminFeeBps ?? null,
        params.deployer ?? null,
        params.treasury ?? null,
        params.admin ?? null
      )
      .accounts({
        admin: admin.publicKey,
        protocolConfig,
        eventAuthority,
        program: this.programId,
      })
      .signers([admin])
      .rpc();
  }

  /**
   * Set paused state (admin only)
   */
  async setPaused(admin: Keypair, isPaused: boolean) {
    const [protocolConfig] = this.getProtocolConfigPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .setPaused(isPaused)
      .accounts({
        admin: admin.publicKey,
        protocolConfig,
        eventAuthority,
        program: this.programId,
      })
      .signers([admin])
      .rpc();
  }

  /**
   * Claim admin privileges
   */
  async claimAdmin(admin: Keypair, treasury: PublicKey) {
    const [adminPda] = this.getAdminPda();
    const [protocolConfig] = this.getProtocolConfigPda();
    const [eventAuthority] = this.getEventAuthorityPda();

    return await this.program.methods
      .claimAdmin()
      .accounts({
        admin: admin.publicKey,
        adminPda,
        protocolConfig,
        treasury,
        systemProgram: SystemProgram.programId,
        eventAuthority,
        program: this.programId,
      })
      .signers([admin])
      .rpc();
  }

  // ============================================================================
  // Account Fetch Methods
  // ============================================================================

  /**
   * Fetch protocol configuration
   */
  async getProtocolConfig() {
    const [protocolConfig] = this.getProtocolConfigPda();
    return await this.program.account.protocolConfig.fetch(protocolConfig);
  }

  /**
   * Fetch a loan by ID and borrower
   */
  async getLoan(loanId: BN, borrower: PublicKey) {
    const [loan] = this.getLoanPda(loanId, borrower);
    return await this.program.account.loan.fetch(loan);
  }

  /**
   * Fetch depositor record
   */
  async getDepositorRecord(depositor: PublicKey) {
    const [depositorRecord] = this.getDepositorRecordPda(depositor);
    try {
      return await this.program.account.depositorRecord.fetch(depositorRecord);
    } catch (e) {
      return null; // Account doesn't exist yet
    }
  }

  /**
   * Fetch all loans for a borrower
   */
  async getLoansByBorrower(borrower: PublicKey) {
    return await this.program.account.loan.all([
      {
        memcmp: {
          offset: 8 + 8, // After discriminator and loan_id
          bytes: borrower.toBase58(),
        },
      },
    ]);
  }

  /**
   * Fetch all active loans
   */
  async getActiveLoans() {
    const loans = await this.program.account.loan.all();
    return loans.filter((loan) => loan.account.state.active !== undefined);
  }

  /**
   * Fetch all depositor records
   */
  async getAllDepositors() {
    return await this.program.account.depositorRecord.all();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate total repayment amount for a loan
   */
  calculateTotalRepayment(principal: BN, interestRateBps: number): BN {
    const interest = principal.mul(new BN(interestRateBps)).div(new BN(10000));
    return principal.add(interest);
  }

  /**
   * Check if a loan is expired
   */
  isLoanExpired(loan: any): boolean {
    const now = Math.floor(Date.now() / 1000);
    const expiryTime = loan.startTs.toNumber() + loan.duration.toNumber();
    return now > expiryTime;
  }

  /**
   * Get vault balance
   */
  async getVaultBalance(): Promise<number> {
    const [vault] = this.getVaultPda();
    const balance = await this.provider.connection.getBalance(vault);
    return balance;
  }

  /**
   * Subscribe to program events
   */
  subscribeToEvents(callback: (event: any) => void) {
    const listener = this.program.addEventListener("loanRequested", (event) => {
      callback({ type: "loanRequested", data: event });
    });

    // Add more event listeners as needed
    this.program.addEventListener("loanRepaid", (event) => {
      callback({ type: "loanRepaid", data: event });
    });

    this.program.addEventListener("deposited", (event) => {
      callback({ type: "deposited", data: event });
    });

    this.program.addEventListener("withdrawn", (event) => {
      callback({ type: "withdrawn", data: event });
    });

    return listener;
  }

  /**
   * Remove event listener
   */
  async removeEventListener(listener: number) {
    await this.program.removeEventListener(listener);
  }
}

// Export helper functions
export const lamportsToSol = (lamports: number | BN): number => {
  const bn = typeof lamports === "number" ? new BN(lamports) : lamports;
  return bn.toNumber() / web3.LAMPORTS_PER_SOL;
};

export const solToLamports = (sol: number): BN => {
  return new BN(sol * web3.LAMPORTS_PER_SOL);
};

export const bpsToPercent = (bps: number): number => {
  return bps / 100;
};

// Helper functions to create client and provider
export const getProvider = (
  connection: Connection,
  wallet: AnchorWallet | undefined
): anchor.AnchorProvider | null => {
  if (!wallet) return null;
  
  const opts: anchor.web3.ConfirmOptions = {
    preflightCommitment: 'processed' as anchor.web3.Commitment,
    commitment: 'confirmed' as anchor.web3.Commitment,
  };
  
  return new anchor.AnchorProvider(connection, wallet, opts);
};

export const getProgram = (provider: anchor.AnchorProvider | null): Program<Solignition> | null => {
  if (!provider) return null;
  return new Program(idl as Solignition, provider);
};

export const getClient = (provider: anchor.AnchorProvider | null): SolignitionClient | null => {
  if (!provider) return null;
  const program = getProgram(provider);
  if (!program) return null;
  return new SolignitionClient(provider);
};