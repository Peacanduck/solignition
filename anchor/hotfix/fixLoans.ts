import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Solignition } from "../target/types/solignition";

async function fixLoansOutstanding() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.YourProgramName as Program<Solignition>; // Replace with your program type
  
  // Seeds
  const PROTOCOL_CONFIG_SEED = Buffer.from("config"); // Replace with your actual seed
  
  // Derive protocol config PDA
  const [protocolConfigPda] = PublicKey.findProgramAddressSync(
    [PROTOCOL_CONFIG_SEED],
    program.programId
  );
  
  console.log("Protocol Config PDA:", protocolConfigPda.toString());
  
  try {
    // Fetch current state
    const protocolConfig = await program.account.protocolConfig.fetch(protocolConfigPda);
    console.log("Current total_loans_outstanding:", protocolConfig.totalLoansOutstanding.toString());
    
    // Call the fix instruction with correct amount (0 in your case)
    const correctAmount = new anchor.BN(0);
    
    const tx = await program.methods
      .fixLoansOutstanding(correctAmount)
      .accounts({
        caller: provider.wallet.publicKey,
        protocolConfig: protocolConfigPda,
      })
      .rpc();
    
    console.log("Fix transaction signature:", tx);
    
    // Verify the fix
    const updatedConfig = await program.account.protocolConfig.fetch(protocolConfigPda);
    console.log("Updated total_loans_outstanding:", updatedConfig.totalLoansOutstanding.toString());
    
  } catch (error) {
    console.error("Error fixing loans outstanding:", error);
    throw error;
  }
}

// Run the fix
fixLoansOutstanding()
  .then(() => {
    console.log("Successfully fixed loans outstanding!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to fix loans outstanding:", error);
    process.exit(1);
  });