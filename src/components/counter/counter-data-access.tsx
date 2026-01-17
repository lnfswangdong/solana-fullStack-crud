'use client' // must run browser, and use react hooks, wallet, solana 

// this file define two hooks that are two export functions, 

import { getCounterProgram, getCounterProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'

interface CreateEntryArgs {
  title: string;
  message: string;
  owner: PublicKey;
}

// this hook works with the whole program and do 3 things, 
// 1) get program, 
// 2) obtain all journal entries, 
// 3) and CREATE a new entry

export function useCounterProgram() {
  const { connection } = useConnection() // RPC connection, read the chain
  const { cluster } = useCluster() // cluster of dev, local, and main
  const transactionToast = useTransactionToast() // ????
  const provider = useAnchorProvider() // wallet + sign ability
  const programId = useMemo(() => getCounterProgramId(cluster.network as Cluster), [cluster]) // fetch the programId
  const program = useMemo(() => getCounterProgram(provider, programId), [provider, programId]) // fetch the program then do 

  // under this program, give me all accounts of journalEntryState
  const accounts = useQuery({
    queryKey: ['counter', 'all', { cluster }],
    queryFn: () => program.account.journalEntryState.all(),
  });

  // what is for???? check if the program is deployed
  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  // please understand this clearly entry creator
  // useMutation<ReturnType, ErrorType, InputType>
  const createEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'create', { cluster }],
    mutationFn: async ({ title, message, owner }) => {
      // here is rust -- idl -- ts naming rules (happen during build), create_journal_entry -> createJournalEntry
      // rpc() send to chain, use provider's wallet signature
      return program.methods.createJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch(); // refresh the cache due to the newly added entry
    },
    onError: (error) => {
      toast.error(`Error creating entry: ${error.message}`);
    }
  });

  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    createEntry,
  }

}

// This hook works on a single account, and do 3 things
// obtain (read) one entry
// update one entry
// delete one entry
// { account } destruct + input the function, { account: PublicKey }, type explanation 
export function useCounterProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts } = useCounterProgram()

  const accountQuery = useQuery({ // the logic is not clear
    queryKey: ['counter', 'fetch', { cluster, account }], // wher counter and fetch come from
    queryFn: () => program.account.journalEntryState.fetch(account),
  });

  const updateEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'update', { cluster }],
    mutationFn: async ({ title, message }) => {
      //it returns a promise (Promise<string>) which is container that will surely have a result (pending, fullfilled, rejected)
      return program.methods.updateJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accountQuery.refetch();
      // accounts.refetch();
    },
    onError: (error) => {
      toast.error('Error updating entry: $(error.message)');
    },
  });

  const deleteEntry = useMutation({
    mutationKey: ['journalEntry', 'delete', { cluster }],
    mutationFn: (title: string) => {
      return program.methods.deleteJournalEntry(title).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
  });

  return {
    accountQuery,
    updateEntry,
    deleteEntry,
  };
}
