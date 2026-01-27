import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import {getProvider, getProgram, getClient, SolignitionClient, solToLamports, lamportsToSol } from "../../../lib/solignitionClient";
import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';


export const useClient = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(
    () => getProvider(connection, wallet),
    [connection, wallet]
  );

  const program = useMemo(
    () => getProgram(provider),
    [provider]
  );

  const client = useMemo(
    () => getClient(provider),
    [provider]
  );

  return { provider, program, client };
};