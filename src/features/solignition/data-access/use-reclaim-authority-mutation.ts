import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useTransactionToast } from '../ui/ui-layout';
import { getReclaimProgramAuthorityInstructionAsync } from '@project/anchor';
import type { Address } from '@solana/kit';
import { appendTransactionMessageInstruction, createSolanaRpc, createSolanaRpcSubscriptions, createTransactionMessage, generateKeyPairSigner, getSignatureFromTransaction, pipe, sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners } from '@solana/kit';

interface ReclaimAuthorityParams {
  protocolConfig: Address;
  loan: Address;
}

export function useReclaimAuthorityMutation() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const transactionToast = useTransactionToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['solignition', 'reclaim-authority'],
    mutationFn: async ({ protocolConfig, loan }: ReclaimAuthorityParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const rpc = createSolanaRpc(connection.rpcEndpoint);
      const rpcSubscriptions = createSolanaRpcSubscriptions(connection.rpcEndpoint.replace('https', 'wss'));

      const admin = await generateKeyPairSigner();
      admin.address = wallet.publicKey.toString() as Address;

      const instruction = await getReclaimProgramAuthorityInstructionAsync({
        admin,
        protocolConfig,
        loan,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        m => setTransactionMessageFeePayerSigner(admin, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstruction(instruction, m)
      );

      const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
      
      const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
        rpc,
        rpcSubscriptions,
      });

      await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' });
      
      const signature = getSignatureFromTransaction(signedTransaction);
      return signature;
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      queryClient.invalidateQueries({ queryKey: ['solignition', 'loans'] });
    },
    onError: (error) => {
      console.error('Reclaim authority error:', error);
    },
  });
}