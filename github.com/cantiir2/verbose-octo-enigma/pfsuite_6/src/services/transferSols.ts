import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as web3 from "@solana/web3.js"
import { initializeLookupTable, sendSignedTransaction, sendV0Transaction, waitForNewBlock } from "../utils/functions";
import { TokenData } from "../config/types";
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { logger } from "./logger";
import { readFileSync } from "fs";
import { ACCNT_CREATION_FEES, PRIORITY_FEE_AMT, PRIORITY_FEE_IX, priorityFees } from "../config";


export async function TransferSols(baseMint: PublicKey, user: web3.Keypair, connection: web3.Connection, t: TokenData) {
  const recipients = [];
  const tokenAccountCreationFee = 0.003; // Token account creation fee

  const wallets = JSON.parse(readFileSync(`./wallets/${baseMint.toBase58()}.wallets.json`, 'utf-8'));
  for (let i = 0; i < wallets.length; i++) {

   const amntToTfr= Number(Number(wallets[i].buyAmount*1.21).toFixed(4))+2*tokenAccountCreationFee+0.00005+2* priorityFees

    const amntToSend = amntToTfr* LAMPORTS_PER_SOL
    logger.info(`Adding Wallet ${i} for Transfer ${wallets[i].address} ${amntToSend}`);
    recipients.push({
      wallet: new PublicKey(wallets[i].address),

      amount: amntToSend
    }
    );
  }

  const lookupTableAccount = (
    await connection.getAddressLookupTable(new PublicKey(t.lookupTableAddress))
  ).value;

  if (!lookupTableAccount) {
    throw new Error("Lookup table not found");
  }

  let transferInstructions = recipients.map((recipient) => {
    return web3.SystemProgram.transfer({
      fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
      toPubkey: recipient.wallet, // The destination account for the transfer
      lamports: Number(Number(recipient.amount).toFixed(0)),
    })
  })


  try {
    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
      await connection.getLatestBlockhash()

    transferInstructions.push(PRIORITY_FEE_IX)
    transferInstructions = transferInstructions.reverse();

    // Create a new transaction message with the provided instructions
    const messageV0 = new web3.TransactionMessage({
      payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
      recentBlockhash: blockhash, // The blockhash of the most recent block
      instructions: transferInstructions, // The instructions to include in the transaction
    }).compileToV0Message([lookupTableAccount])

    logger.debug('Create a new transaction object with the message');
    const transaction = new web3.VersionedTransaction(messageV0)

    // Sign the transaction with the user's keypair
    transaction.sign([user])

    // looping creates weird indexing issue with transactionMessages
    return await sendSignedTransaction({
      signedTransaction: transaction,
      connection,
      skipPreflight: false,
      successCallback: async (txSig: string) => {
        console.log('Sent Trasaction Success : Signature :' + txSig);
      },
      sendingCallback: async (txSig: string) => {
        console.log('Sent Trasaction awaiting Confirmation ' + txSig);
      },
      confirmStatus: async (txSig: string, confirmStatus: string) => {
        console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
      },
    });
  } catch (error) {
    console.log(new String(error))
    return null;
  }


}