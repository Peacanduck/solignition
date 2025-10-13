import * as anchor from '@project-serum/anchor';
import { Program, Wallet } from '@project-serum/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  Signer,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { BpfLoader, BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from '@solana/web3.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import winston from 'winston';
import { EventEmitter } from 'events';
import express from 'express';
import { Registry, Gauge, Counter, Histogram } from 'prom-client';
import dotenv from 'dotenv';
import { Level } from 'level';
import bs58 from 'bs58';

dotenv.config();

// ============ Configuration ============
interface DeployerConfig {
  rpcUrl: string;
  wsUrl?: string;
  programId: PublicKey;
  deployerKeypairPath: string;
  adminKeypairPath?: string; // For set_deployed_program if needed
  binaryStoragePath: string;
  dbPath: string;
  port: number;
  maxRetries: number;
  retryDelayMs: number;
  pollIntervalMs: number;
  cluster: 'devnet' | 'testnet' | 'mainnet-beta';
}

const config: DeployerConfig = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8899',
  wsUrl: process.env.WS_URL,
  programId: new PublicKey(process.env.PROGRAM_ID || '4dWBvsjopo5Z145Xmse3Lx41G1GKpMyWMLc6p4a52T4N'),
  deployerKeypairPath: process.env.DEPLOYER_KEYPAIR_PATH || './deployer-keypair.json',
  adminKeypairPath: process.env.ADMIN_KEYPAIR_PATH,
  binaryStoragePath: process.env.BINARY_STORAGE_PATH || './binaries',
  dbPath: process.env.DB_PATH || './deployer-state',
  port: parseInt(process.env.PORT || '3000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000'),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'),
  cluster: (process.env.CLUSTER as any) || 'devnet',
};

// ============ Constants ============
const VAULT_SEED = Buffer.from('vault');
const AUTHORITY_SEED = Buffer.from('authority');
const ADMIN_SEED = Buffer.from('admin');
const TREASURY_SEED = Buffer.from('treasury');
const LOAN_SEED = Buffer.from('loan');
const DEPOSITOR_SEED = Buffer.from('depositor');
const PROTOCOL_CONFIG_SEED = Buffer.from('config');

// ============ Types ============
interface LoanRequestedEvent {
  borrower: PublicKey;
  loanId: anchor.BN;
  principal: anchor.BN;
  duration: anchor.BN;
  interestRateBps: number;
  adminFee: anchor.BN;
}

interface LoanRecoveredEvent {
  loanId: anchor.BN;
  adminFeeDistributed: anchor.BN;
  depositorShare: anchor.BN;
  treasuryShare: anchor.BN;
}

interface DeploymentRecord {
  loanId: string;
  borrower: string;
  programId?: string;
  bufferAccount?: string;
  deployTxSignature?: string;
  setDeployedTxSignature?: string;
  recoveryTxSignature?: string;
  status: 'pending' | 'deploying' | 'deployed' | 'recovering' | 'recovered' | 'failed';
  error?: string;
  createdAt: number;
  updatedAt: number;
  binaryHash?: string;
  principal: string;
}

enum LoanState {
  Active = 0,
  Repaid = 1,
  Recovered = 2,
}

// ============ Logging ============
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'deployer.log' }),
  ],
});

// ============ Metrics ============
const registry = new Registry();
const metrics = {
  deploymentsTotal: new Counter({
    name: 'deployer_deployments_total',
    help: 'Total number of deployments',
    labelNames: ['status'],
    registers: [registry],
  }),
  recoveryTotal: new Counter({
    name: 'deployer_recovery_total',
    help: 'Total number of program recoveries',
    labelNames: ['status'],
    registers: [registry],
  }),
  deploymentDuration: new Histogram({
    name: 'deployer_deployment_duration_seconds',
    help: 'Duration of deployment operations',
    registers: [registry],
  }),
  solanaRpcErrors: new Counter({
    name: 'deployer_solana_rpc_errors_total',
    help: 'Total number of Solana RPC errors',
    registers: [registry],
  }),
  activeLoans: new Gauge({
    name: 'deployer_active_loans',
    help: 'Number of active loans being monitored',
    registers: [registry],
  }),
};

// ============ State Management ============
class StateManager {
  private db: Level<string, any>;

  constructor(dbPath: string) {
    this.db = new Level(dbPath, { valueEncoding: 'json' });
  }

  async getDeployment(loanId: string): Promise<DeploymentRecord | null> {
    try {
      return await this.db.get(`deployment:${loanId}`);
    } catch (error: any) {
      if (error.notFound) return null;
      throw error;
    }
  }

  async saveDeployment(record: DeploymentRecord): Promise<void> {
    await this.db.put(`deployment:${record.loanId}`, record);
  }

  async getAllDeployments(): Promise<DeploymentRecord[]> {
    const deployments: DeploymentRecord[] = [];
    for await (const [key, value] of this.db.iterator()) {
      if (key.startsWith('deployment:')) {
        deployments.push(value);
      }
    }
    return deployments;
  }

  async setLastProcessedSlot(slot: number): Promise<void> {
    await this.db.put('last-processed-slot', slot);
  }

  async getLastProcessedSlot(): Promise<number | null> {
    try {
      return await this.db.get('last-processed-slot');
    } catch (error: any) {
      if (error.notFound) return null;
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

// ============ Binary Management ============
class BinaryManager {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
  }

  async storeBinary(loanId: string, binaryData: Buffer): Promise<string> {
    const hash = createHash('sha256').update(binaryData).digest('hex');
    const filePath = path.join(this.storagePath, `${loanId}_${hash}.so`);
    await fs.writeFile(filePath, binaryData);
    logger.info(`Stored binary for loan ${loanId}, hash: ${hash}`);
    return hash;
  }

  async getBinary(loanId: string, hash: string): Promise<Buffer> {
    const filePath = path.join(this.storagePath, `${loanId}_${hash}.so`);
    return await fs.readFile(filePath);
  }

  async validateBinary(binaryData: Buffer): Promise<{ valid: boolean; reason?: string }> {
    // Basic validation
    if (binaryData.length === 0) {
      return { valid: false, reason: 'Empty binary' };
    }

    // Check for ELF header (7F 45 4C 46)
    const elfMagic = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
    if (!binaryData.subarray(0, 4).equals(elfMagic)) {
      return { valid: false, reason: 'Invalid ELF header' };
    }

    // Size limit (100MB)
    if (binaryData.length > 100 * 1024 * 1024) {
      return { valid: false, reason: 'Binary too large (>100MB)' };
    }

    return { valid: true };
  }
}

// ============ Solana Program Deployer ============
class ProgramDeployer {
  private connection: Connection;
  private deployerWallet: Wallet;
  private adminWallet?: Wallet;
  private program: Program;
  private authorityPda: PublicKey;
  private deployerPda: PublicKey;
  private vaultPda: PublicKey;
  private configPda: PublicKey;

  constructor(connection: Connection, deployerKeypair: Keypair, adminKeypair?: Keypair) {
    this.connection = connection;
    this.deployerWallet = new Wallet(deployerKeypair);
    if (adminKeypair) {
      this.adminWallet = new Wallet(adminKeypair);
    }

    // Initialize PDAs
    [this.authorityPda] = PublicKey.findProgramAddressSync(
      [AUTHORITY_SEED],
      config.programId
    );
    [this.vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED],
      config.programId
    );
    [this.configPda] = PublicKey.findProgramAddressSync(
      [PROTOCOL_CONFIG_SEED],
      config.programId
    );

    // We'll set the program once we load the IDL
  }

  async init(): Promise<void> {
    // Load IDL and create program interface
    const idl = JSON.parse(await fs.readFile('./idl.json', 'utf8'));
    this.program = new Program(idl, config.programId, {
      connection: this.connection,
    });

    // Get deployer PDA from config
    const protocolConfig = await this.program.account.protocolConfig.fetch(this.configPda);
    this.deployerPda = protocolConfig.deployer;

    logger.info('Program deployer initialized', {
      authorityPda: this.authorityPda.toBase58(),
      deployerPda: this.deployerPda.toBase58(),
      vaultPda: this.vaultPda.toBase58(),
    });
  }

  async deployProgram(
    loanId: string,
    binaryData: Buffer
  ): Promise<{ programId: PublicKey; bufferAccount: PublicKey; signature: string }> {
    const timer = metrics.deploymentDuration.startTimer();

    try {
      logger.info(`Starting deployment for loan ${loanId}`);

      // Check deployer PDA balance
      const deployerBalance = await this.connection.getBalance(this.deployerPda);
      logger.info(`Deployer PDA balance: ${deployerBalance / LAMPORTS_PER_SOL} SOL`);

      // Create buffer account and upload program
      const bufferKeypair = Keypair.generate();
      const programId = Keypair.generate();

      // Calculate required lamports for rent exemption
      const programAccountSize = binaryData.length + 1000; // Add buffer for metadata
      const rentExemption = await this.connection.getMinimumBalanceForRentExemption(
        programAccountSize
      );

      // Create buffer account
      const createBufferIx = SystemProgram.createAccount({
        fromPubkey: this.deployerWallet.publicKey,
        newAccountPubkey: bufferKeypair.publicKey,
        lamports: rentExemption,
        space: programAccountSize,
        programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      });

      // Initialize buffer
      const initBufferIx = createInitializeBufferInstruction(
        bufferKeypair.publicKey,
        this.deployerWallet.publicKey
      );

      // Write program data to buffer
      const writeInstructions = createWriteBufferInstructions(
        bufferKeypair.publicKey,
        this.deployerWallet.publicKey,
        binaryData
      );

      // Deploy program with authority set to protocol PDA
      const deployIx = createDeployWithMaxDataLenInstruction(
        this.deployerWallet.publicKey,
        programId.publicKey,
        bufferKeypair.publicKey,
        this.authorityPda, // Set authority to protocol PDA
        rentExemption,
        binaryData.length
      );

      // Build and send transaction
      const tx = new Transaction();
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
        createBufferIx,
        initBufferIx,
        ...writeInstructions,
        deployIx
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.deployerWallet.payer, bufferKeypair, programId],
        { commitment: 'confirmed' }
      );

      logger.info(`Program deployed successfully`, {
        loanId,
        programId: programId.publicKey.toBase58(),
        bufferAccount: bufferKeypair.publicKey.toBase58(),
        signature,
      });

      metrics.deploymentsTotal.inc({ status: 'success' });
      return {
        programId: programId.publicKey,
        bufferAccount: bufferKeypair.publicKey,
        signature,
      };
    } catch (error) {
      logger.error('Failed to deploy program', { loanId, error });
      metrics.deploymentsTotal.inc({ status: 'failure' });
      throw error;
    } finally {
      timer();
    }
  }

  async setDeployedProgram(
    loanId: string,
    programPubkey: PublicKey
  ): Promise<string> {
    if (!this.adminWallet) {
      throw new Error('Admin wallet not configured for set_deployed_program');
    }

    try {
      const loanIdBn = new anchor.BN(loanId);
      const tx = await this.program.methods
        .setDeployedProgram(loanIdBn, programPubkey)
        .accounts({
          admin: this.adminWallet.publicKey,
          protocolConfig: this.configPda,
          loan: this.getLoanPda(loanId),
        })
        .signers([this.adminWallet.payer])
        .rpc();

      logger.info('Set deployed program', { loanId, programPubkey: programPubkey.toBase58(), tx });
      return tx;
    } catch (error) {
      logger.error('Failed to set deployed program', { loanId, error });
      throw error;
    }
  }

  async closeProgram(
    loanId: string,
    programId: PublicKey
  ): Promise<{ reclaimedSol: number; signature: string }> {
    try {
      logger.info(`Closing program for loan ${loanId}`, { programId: programId.toBase58() });

      // Get program data account
      const programAccountInfo = await this.connection.getAccountInfo(programId);
      if (!programAccountInfo) {
        throw new Error('Program account not found');
      }

      // Parse program data to get the data account
      const programDataAddress = new PublicKey(programAccountInfo.data.slice(4, 36));

      // Close the program data account
      const closeIx = createCloseAccountInstruction(
        programDataAddress,
        this.deployerPda, // Recipient of reclaimed SOL
        this.authorityPda, // Authority
        programId
      );

      const tx = new Transaction().add(closeIx);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.deployerWallet.payer],
        { commitment: 'confirmed' }
      );

      // Check reclaimed balance
      const afterBalance = await this.connection.getBalance(this.deployerPda);

      logger.info('Program closed successfully', {
        loanId,
        programId: programId.toBase58(),
        signature,
        reclaimedSol: afterBalance / LAMPORTS_PER_SOL,
      });

      metrics.recoveryTotal.inc({ status: 'success' });
      return { reclaimedSol: afterBalance / LAMPORTS_PER_SOL, signature };
    } catch (error) {
      logger.error('Failed to close program', { loanId, error });
      metrics.recoveryTotal.inc({ status: 'failure' });
      throw error;
    }
  }

  async returnReclaimedSol(loanId: string, amount: number): Promise<string> {
    try {
      const amountLamports = new anchor.BN(amount * LAMPORTS_PER_SOL);

      const tx = await this.program.methods
        .returnReclaimedSol(amountLamports)
        .accounts({
          caller: this.deployerWallet.publicKey,
          protocolConfig: this.configPda,
          loan: this.getLoanPda(loanId),
          vault: this.vaultPda,
          deployerPda: this.deployerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.deployerWallet.payer])
        .rpc();

      logger.info('Returned reclaimed SOL to vault', { loanId, amount, tx });
      return tx;
    } catch (error) {
      logger.error('Failed to return reclaimed SOL', { loanId, error });
      throw error;
    }
  }

  async getLoanAccount(loanId: string): Promise<any> {
    const loanPda = this.getLoanPda(loanId);
    return await this.program.account.loan.fetch(loanPda);
  }

  private getLoanPda(loanId: string): PublicKey {
    const loanIdBn = new anchor.BN(loanId);
    const [loanPda] = PublicKey.findProgramAddressSync(
      [LOAN_SEED, loanIdBn.toArrayLike(Buffer, 'le', 8)],
      config.programId
    );
    return loanPda;
  }
}

// ============ Event Monitor ============
class EventMonitor extends EventEmitter {
  private connection: Connection;
  private program: Program;
  private subscriptionId?: number;
  private stateManager: StateManager;
  private isRunning: boolean = false;

  constructor(connection: Connection, program: Program, stateManager: StateManager) {
    super();
    this.connection = connection;
    this.program = program;
    this.stateManager = stateManager;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('Starting event monitor');

    // Subscribe to program logs
    this.subscriptionId = this.connection.onLogs(
      config.programId,
      async (logs) => {
        try {
          await this.processLogs(logs);
        } catch (error) {
          logger.error('Error processing logs', { error });
        }
      },
      'confirmed'
    );

    // Also poll for missed events periodically
    this.startPolling();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.subscriptionId) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
    }
  }

  private async processLogs(logs: any): Promise<void> {
    const { signature, logs: logMessages } = logs;

    // Parse Anchor events from logs
    for (const log of logMessages) {
      if (log.includes('Program log: LoanRequested')) {
        await this.handleLoanRequested(signature);
      } else if (log.includes('Program log: LoanRecovered')) {
        await this.handleLoanRecovered(signature);
      }
    }
  }

  private async handleLoanRequested(signature: string): Promise<void> {
    try {
      // Get transaction details
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
      });

      if (!tx) return;

      // Parse event data from transaction logs
      const parser = new anchor.EventParser(config.programId, this.program.coder);
      const events = parser.parseLogs(tx.meta?.logMessages || []);

      for (const event of events) {
        if (event.name === 'LoanRequested') {
          const data = event.data as LoanRequestedEvent;
          this.emit('loanRequested', {
            loanId: data.loanId.toString(),
            borrower: data.borrower.toBase58(),
            principal: data.principal.toString(),
            duration: data.duration.toString(),
            interestRateBps: data.interestRateBps,
            adminFee: data.adminFee.toString(),
          });
        }
      }
    } catch (error) {
      logger.error('Error handling loan requested event', { signature, error });
    }
  }

  private async handleLoanRecovered(signature: string): Promise<void> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
      });

      if (!tx) return;

      const parser = new anchor.EventParser(config.programId, this.program.coder);
      const events = parser.parseLogs(tx.meta?.logMessages || []);

      for (const event of events) {
        if (event.name === 'LoanRecovered') {
          const data = event.data as LoanRecoveredEvent;
          this.emit('loanRecovered', {
            loanId: data.loanId.toString(),
          });
        }
      }
    } catch (error) {
      logger.error('Error handling loan recovered event', { signature, error });
    }
  }

  private startPolling(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkExpiredLoans();
      } catch (error) {
        logger.error('Error in polling cycle', { error });
      }
    }, config.pollIntervalMs);
  }

  private async checkExpiredLoans(): Promise<void> {
    // Get all active deployments from state
    const deployments = await this.stateManager.getAllDeployments();
    const activeLoans = deployments.filter(d => d.status === 'deployed');

    for (const deployment of activeLoans) {
      try {
        const loan = await this.program.account.loan.fetch(
          this.getLoanPda(deployment.loanId)
        );

        const now = Date.now() / 1000;
        const expiry = loan.startTs.toNumber() + loan.duration.toNumber();

        if (now >= expiry && loan.state === LoanState.Active) {
          logger.info(`Loan ${deployment.loanId} has expired`);
          this.emit('loanExpired', { loanId: deployment.loanId });
        }
      } catch (error) {
        logger.error(`Error checking loan ${deployment.loanId}`, { error });
      }
    }

    metrics.activeLoans.set(activeLoans.length);
  }

  private getLoanPda(loanId: string): PublicKey {
    const loanIdBn = new anchor.BN(loanId);
    const [loanPda] = PublicKey.findProgramAddressSync(
      [LOAN_SEED, loanIdBn.toArrayLike(Buffer, 'le', 8)],
      config.programId
    );
    return loanPda;
  }
}

// ============ Orchestrator ============
class DeployerOrchestrator {
  private stateManager: StateManager;
  private binaryManager: BinaryManager;
  private programDeployer: ProgramDeployer;
  private eventMonitor: EventMonitor;
  private connection: Connection;

  constructor(
    connection: Connection,
    stateManager: StateManager,
    binaryManager: BinaryManager,
    programDeployer: ProgramDeployer,
    eventMonitor: EventMonitor
  ) {
    this.connection = connection;
    this.stateManager = stateManager;
    this.binaryManager = binaryManager;
    this.programDeployer = programDeployer;
    this.eventMonitor = eventMonitor;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventMonitor.on('loanRequested', async (event) => {
      await this.handleLoanRequested(event);
    });

    this.eventMonitor.on('loanRecovered', async (event) => {
      await this.handleLoanRecovered(event);
    });

    this.eventMonitor.on('loanExpired', async (event) => {
      await this.handleLoanExpired(event);
    });
  }

  private async handleLoanRequested(event: any): Promise<void> {
    const { loanId, borrower, principal } = event;

    logger.info('Processing loan requested event', { loanId, borrower, principal });

    // Check idempotency
    let deployment = await this.stateManager.getDeployment(loanId);
    if (deployment && deployment.status !== 'failed') {
      logger.info(`Loan ${loanId} already being processed`, { status: deployment.status });
      return;
    }

    // Create deployment record
    deployment = {
      loanId,
      borrower,
      principal,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.stateManager.saveDeployment(deployment);

    // Process deployment with retries
    await this.processDeploymentWithRetries(deployment);
  }

  private async processDeploymentWithRetries(deployment: DeploymentRecord): Promise<void> {
    let attempts = 0;

    while (attempts < config.maxRetries) {
      try {
        await this.processDeployment(deployment);
        return;
      } catch (error) {
        attempts++;
        logger.error(`Deployment attempt ${attempts} failed`, {
          loanId: deployment.loanId,
          error,
        });

        if (attempts >= config.maxRetries) {
          deployment.status = 'failed';
          deployment.error = String(error);
          await this.stateManager.saveDeployment(deployment);
          metrics.deploymentsTotal.inc({ status: 'failed' });
          return;
        }

        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, config.retryDelayMs * Math.pow(2, attempts - 1))
        );
      }
    }
  }

  private async processDeployment(deployment: DeploymentRecord): Promise<void> {
    const { loanId, borrower } = deployment;

    // Update status
    deployment.status = 'deploying';
    deployment.updatedAt = Date.now();
    await this.stateManager.saveDeployment(deployment);

    // Fetch binary for deployment
    // NOTE: In production, you need to implement binary retrieval
    // Options:
    // 1. IPFS hash stored in loan metadata
    // 2. Pre-uploaded to binary storage with borrower signature
    // 3. Direct upload endpoint with authentication
    const binaryData = await this.fetchBinaryForLoan(loanId, borrower);

    // Validate binary
    const validation = await this.binaryManager.validateBinary(binaryData);
    if (!validation.valid) {
      throw new Error(`Binary validation failed: ${validation.reason}`);
    }

    // Store binary
    const binaryHash = await this.binaryManager.storeBinary(loanId, binaryData);
    deployment.binaryHash = binaryHash;

    // Deploy program
    const { programId, bufferAccount, signature } = await this.programDeployer.deployProgram(
      loanId,
      binaryData
    );

    deployment.programId = programId.toBase58();
    deployment.bufferAccount = bufferAccount.toBase58();
    deployment.deployTxSignature = signature;

    // Set deployed program on-chain
    const setTx = await this.programDeployer.setDeployedProgram(loanId, programId);
    deployment.setDeployedTxSignature = setTx;

    // Update status
    deployment.status = 'deployed';
    deployment.updatedAt = Date.now();
    await this.stateManager.saveDeployment(deployment);

    logger.info('Deployment completed successfully', {
      loanId,
      programId: programId.toBase58(),
    });
  }

  private async handleLoanRecovered(event: any): Promise<void> {
    const { loanId } = event;
    await this.processRecovery(loanId);
  }

  private async handleLoanExpired(event: any): Promise<void> {
    const { loanId } = event;
    await this.processRecovery(loanId);
  }

  private async processRecovery(loanId: string): Promise<void> {
    logger.info('Processing loan recovery', { loanId });

    const deployment = await this.stateManager.getDeployment(loanId);
    if (!deployment || deployment.status !== 'deployed') {
      logger.info(`Loan ${loanId} not in deployed state`, { status: deployment?.status });
      return;
    }

    try {
      deployment.status = 'recovering';
      deployment.updatedAt = Date.now();
      await this.stateManager.saveDeployment(deployment);

      if (deployment.programId) {
        // Close the program and reclaim SOL
        const { reclaimedSol, signature } = await this.programDeployer.closeProgram(
          loanId,
          new PublicKey(deployment.programId)
        );

        // Return reclaimed SOL to vault
        const returnTx = await this.programDeployer.returnReclaimedSol(
          loanId,
          reclaimedSol
        );

        deployment.recoveryTxSignature = signature;
        deployment.status = 'recovered';
        deployment.updatedAt = Date.now();
        await this.stateManager.saveDeployment(deployment);

        logger.info('Recovery completed successfully', {
          loanId,
          reclaimedSol,
          signature,
        });
      }
    } catch (error) {
      logger.error('Recovery failed', { loanId, error });
      deployment.status = 'failed';
      deployment.error = String(error);
      await this.stateManager.saveDeployment(deployment);
    }
  }

  private async fetchBinaryForLoan(loanId: string, borrower: string): Promise<Buffer> {
    // TODO: Implement binary retrieval logic
    // This is a placeholder - in production, you need to:
    // 1. Fetch from IPFS if hash is provided
    // 2. Check pre-uploaded binaries with borrower signature
    // 3. Implement secure upload mechanism

    // For now, return a dummy binary for testing
    const dummyBinaryPath = path.join(config.binaryStoragePath, 'test-program.so');
    try {
      return await fs.readFile(dummyBinaryPath);
    } catch {
      throw new Error('Binary not found for loan. Implement binary retrieval logic.');
    }
  }

  async start(): Promise<void> {
    await this.eventMonitor.start();
    logger.info('Deployer orchestrator started');
  }

  async stop(): Promise<void> {
    await this.eventMonitor.stop();
    logger.info('Deployer orchestrator stopped');
  }
}

// ============ Health/Metrics Server ============
class HealthServer {
  private app: express.Application;
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.app = express();
    this.stateManager = stateManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const deployments = await this.stateManager.getAllDeployments();
        const activeCount = deployments.filter(d => d.status === 'deployed').length;
        
        res.json({
          status: 'healthy',
          activeLoans: activeCount,
          totalDeployments: deployments.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: String(error) });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    });

    // Deployment status endpoint
    this.app.get('/deployments/:loanId', async (req, res) => {
      try {
        const deployment = await this.stateManager.getDeployment(req.params.loanId);
        if (!deployment) {
          return res.status(404).json({ error: 'Deployment not found' });
        }
        res.json(deployment);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  start(port: number): void {
    this.app.listen(port, () => {
      logger.info(`Health server listening on port ${port}`);
    });
  }
}

// ============ Helper Functions ============

function createInitializeBufferInstruction(
  buffer: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  const keys = [
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
  ];
  
  return new TransactionInstruction({
    keys,
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    data: Buffer.from([0]), // Initialize buffer instruction
  });
}

function createWriteBufferInstructions(
  buffer: PublicKey,
  authority: PublicKey,
  data: Buffer
): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  const chunkSize = 900; // Safe chunk size for transaction

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
    
    const keys = [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ];

    const instructionData = Buffer.concat([
      Buffer.from([1]), // Write instruction
      Buffer.from(new Uint32Array([offset]).buffer),
      chunk,
    ]);

    instructions.push(
      new TransactionInstruction({
        keys,
        programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
        data: instructionData,
      })
    );
  }

  return instructions;
}

function createDeployWithMaxDataLenInstruction(
  payer: PublicKey,
  programId: PublicKey,
  buffer: PublicKey,
  upgradeAuthority: PublicKey,
  lamports: number,
  dataLen: number
): TransactionInstruction {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: programId, isSigner: true, isWritable: true },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: upgradeAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const data = Buffer.concat([
    Buffer.from([2]), // Deploy with max data len instruction
    Buffer.from(new Uint32Array([dataLen]).buffer),
  ]);

  return new TransactionInstruction({
    keys,
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    data,
  });
}

function createCloseAccountInstruction(
  account: PublicKey,
  recipient: PublicKey,
  authority: PublicKey,
  program?: PublicKey
): TransactionInstruction {
  const keys = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: recipient, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];

  if (program) {
    keys.push({ pubkey: program, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    keys,
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    data: Buffer.from([4]), // Close instruction
  });
}

// ============ Main Application ============
async function main() {
  logger.info('Starting Solana Lending Protocol Deployer Service', { config });

  try {
    // Initialize connection
    const connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: config.wsUrl,
    });

    // Load keypairs
    const deployerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(await fs.readFile(config.deployerKeypairPath, 'utf8')))
    );
    
    let adminKeypair: Keypair | undefined;
    if (config.adminKeypairPath) {
      adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(await fs.readFile(config.adminKeypairPath, 'utf8')))
      );
    }

    // Initialize components
    const stateManager = new StateManager(config.dbPath);
    const binaryManager = new BinaryManager(config.binaryStoragePath);
    await binaryManager.init();

    const programDeployer = new ProgramDeployer(
      connection,
      deployerKeypair,
      adminKeypair
    );
    await programDeployer.init();

    // Load IDL and create program
    const idl = JSON.parse(await fs.readFile('./idl.json', 'utf8'));
    const program = new Program(idl, config.programId, { connection });

    const eventMonitor = new EventMonitor(connection, program, stateManager);

    // Create orchestrator
    const orchestrator = new DeployerOrchestrator(
      connection,
      stateManager,
      binaryManager,
      programDeployer,
      eventMonitor
    );

    // Start health server
    const healthServer = new HealthServer(stateManager);
    healthServer.start(config.port);

    // Start orchestrator
    await orchestrator.start();

    logger.info('Deployer service started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      await orchestrator.stop();
      await stateManager.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down gracefully...');
      await orchestrator.stop();
      await stateManager.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start deployer service', { error });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error', { error });
    process.exit(1);
  });
}

export {
  DeployerOrchestrator,
  ProgramDeployer,
  EventMonitor,
  StateManager,
  BinaryManager,
};