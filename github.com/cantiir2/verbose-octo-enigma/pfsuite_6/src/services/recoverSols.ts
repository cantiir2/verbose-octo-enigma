import { ASSOCIATED_TOKEN_PROGRAM_ID, closeAccount, createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createTransferInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as web3 from "@solana/web3.js"
import { initializeLookupTable, sendV0Transaction, waitForNewBlock } from "../utils/functions";
import { TokenData } from "../config/types";
import { PublicKey, Transaction } from '@solana/web3.js';
import { logger } from "./logger";
import { readFileSync } from "fs";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { PRIORITY_FEE_IX } from "../config";


export async function RecoverSols(baseMint: PublicKey, user: web3.Keypair, connection: web3.Connection, t: TokenData) {
  const recipients = [];
  const wallets = JSON.parse(readFileSync(`./wallets/${baseMint.toBase58()}.wallets.json`, 'utf-8'));
  for (let i = 0; i < wallets.length; i++) {
    const wallet = web3.Keypair.fromSecretKey(bs58.decode(wallets[i].privateKey));
    const balance = await connection.getBalance(wallet.publicKey);
    if (Number(balance) > 0) {
      logger.info(`Adding Wallet ${i} for Recovery ${wallets[i].address}`);

      recipients.push({
        wallet: wallet,
        amount: balance
      });
    }
  }


  const transferData = recipients.map((recipient) => {
    return {
      transferInstruction:
        web3.SystemProgram.transfer({
          fromPubkey: recipient.wallet.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
          toPubkey: user.publicKey, // The destination account for the transfer
          lamports: recipient.amount,
        }),
      wallet: recipient.wallet
    }

  })
  const tnsList: Transaction[] = [];
  const transactionsList = await Promise.all(
    transferData.map(async tnxData => {
      try {

        const tnx: Transaction = new Transaction().add(PRIORITY_FEE_IX);
        const { blockhash } = await connection.getLatestBlockhash();
        tnx.feePayer = user.publicKey;
        tnx.recentBlockhash = blockhash;
        tnx.add(tnxData.transferInstruction)
        tnx.sign(...[tnxData.wallet, user]);

        tnsList.push(tnx);
      } catch (error) {
        console.log(error)
        return null;
      }

    })
  );

  const responses = await Promise.all(
    tnsList.map(async tnx => {
      try {
        return await connection.sendRawTransaction(tnx.serialize(), { skipPreflight: false });
      } catch (error) {
        console.log(error)
        return null;
      }

    })
  );
  console.log(responses);


  return;

}