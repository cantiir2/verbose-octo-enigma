import * as web3 from "@solana/web3.js"
import { logger } from "../services/logger"
import { CONFIRMATIONTIMEOUT, PRIORITY_FEE_IX } from "../config"
import { ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Signer, Transaction, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prompt } from "enquirer";

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateAndWriteBuys() {
 
	const tokenDecimals = 10 ** 6;
	const tokenTotalSupply = 1000000000 * tokenDecimals;
	let initialRealSolReserves = 0;
	let initialVirtualTokenReserves = 1073000000 * tokenDecimals;
	let initialRealTokenReserves = 793100000 * tokenDecimals;
	let totalTokensBought = 0;
	const buys: { pubkey: PublicKey; solAmount: Number; tokenAmount: BN; percentSupply: number }[] = [];

	for (let it = 0; it <= 24; it++) {
		let keypair;

		let solInput;
		if (it === 0) {
			solInput = 0.1;
			solInput = Number(solInput) * 1.21;
			keypair = Keypair.generate();
		} else {
			solInput = 0.1;
			keypair = Keypair.generate();
		}

		const solAmount = solInput * LAMPORTS_PER_SOL;

		if (isNaN(solAmount) || solAmount <= 0) {
			console.log(`Invalid input for wallet ${it}, skipping.`);
			continue;
		}

		const e = new BN(solAmount);
		const initialVirtualSolReserves = 30 * LAMPORTS_PER_SOL + initialRealSolReserves;
		const a = new BN(initialVirtualSolReserves).mul(new BN(initialVirtualTokenReserves));
		const i = new BN(initialVirtualSolReserves).add(e);
		const l = a.div(i).add(new BN(1));
		let tokensToBuy = new BN(initialVirtualTokenReserves).sub(l);
		tokensToBuy = BN.min(tokensToBuy, new BN(initialRealTokenReserves));

		const tokensBought = tokensToBuy.toNumber();
		const percentSupply = (tokensBought / tokenTotalSupply) * 100;

		console.log(`Wallet ${it}: Bought ${tokensBought / tokenDecimals} tokens for ${e.toNumber() / LAMPORTS_PER_SOL} SOL`);
		console.log(`Wallet ${it}: Owns ${percentSupply.toFixed(4)}% of total supply\n`);

		buys.push({ pubkey: keypair.publicKey, solAmount: Number(solInput), tokenAmount: tokensToBuy, percentSupply });

		initialRealSolReserves += e.toNumber();
		initialRealTokenReserves -= tokensBought;
		initialVirtualTokenReserves -= tokensBought;
		totalTokensBought += tokensBought;
	}

	console.log("Final real sol reserves: ", initialRealSolReserves / LAMPORTS_PER_SOL);
	console.log("Final real token reserves: ", initialRealTokenReserves / tokenDecimals);
	console.log("Final virtual token reserves: ", initialVirtualTokenReserves / tokenDecimals);
	console.log("Total tokens bought: ", Number((totalTokensBought / (tokenTotalSupply)).toFixed(0)));
	console.log("Total % of tokens bought: ", Number((totalTokensBought / (tokenTotalSupply)).toFixed(2)) * 100);
	console.log(); // \n

	 
		writeBuysToFile(buys);
	 
}


function writeBuysToFile(buys: any[]) {
	let existingData: any = {};

	if (existsSync('./info.json')) {
		existingData = JSON.parse(readFileSync('./info.json', "utf-8"));
	}

	// Convert buys array to an object keyed by public key
	const buysObj = buys.reduce((acc, buy) => {
		acc[buy.pubkey.toString()] = {
			solAmount: buy.solAmount.toString(),
			tokenAmount: buy.tokenAmount.toString(),
			percentSupply: buy.percentSupply,
		};
		return acc;
	}, existingData); // Initialize with existing data

	// Write updated data to file
	 writeFileSync('./info.json', JSON.stringify(buysObj, null, 2), "utf8");
	console.log("Buys have been successfully saved to keyinfo.json");
}

export async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[]
  ): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot()
  
    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
      web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentSlot: slot - 10, // The recent slot to derive lookup table's address
      })
    logger.debug("lookup table address:", lookupTableAddress.toBase58())
  
    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
      payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
      authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
      lookupTable: lookupTableAddress, // The address of the lookup table to extend
      addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    })
  
    await sendV0Transaction(connection, user, [
      lookupTableInst,
      extendInstruction,
    ])
  
    var remaining = addresses.slice(30)
  
    while (remaining.length > 0) {
      const toAdd = remaining.slice(0, 30)
      remaining = remaining.slice(30)
      const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: toAdd, // The addresses to add to the lookup table
      })
  
      await sendV0Transaction(connection, user, [extendInstruction])
    }
  
    return lookupTableAddress
  }
  
export async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[]
  ) {
    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
      await connection.getLatestBlockhash()

   
    // Create a new transaction message with the provided instructions
    const messageV0 = new web3.TransactionMessage({
      payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
      recentBlockhash: blockhash, // The blockhash of the most recent block
      instructions, // The instructions to include in the transaction
    }).compileToV0Message(lookupTableAccounts)
  
    logger.debug('Create a new transaction object with the message');
    const transaction = new web3.VersionedTransaction(messageV0)
  
    // Sign the transaction with the user's keypair
    transaction.sign([user])
  
    // Send the transaction to the cluster
    const txid = await connection.sendTransaction(transaction)
    logger.debug('Sent transaction object with the id '+txid);

    // Confirm the transaction
    await connection.confirmTransaction(
      {
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
      },
      "finalized"
    )
  
    // Log the transaction URL on the Solana Explorer
    logger.debug(`https://explorer.solana.com/tx/${txid}?cluster=devnet`)
  
    return txid;
  }
  
  export function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    logger.debug(`Waiting for ${targetHeight} new blocks`)
    return new Promise(async (resolve: any) => {
      // Get the last valid block height of the blockchain
      const { lastValidBlockHeight } = await connection.getLatestBlockhash()
  
      // Set an interval to check for new blocks every 1000ms
      const intervalId = setInterval(async () => {
        // Get the new valid block height
        const { lastValidBlockHeight: newValidBlockHeight } =
          await connection.getLatestBlockhash()
        // logger.debug(newValidBlockHeight)
  
        // Check if the new valid block height is greater than the target block height
        if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
          // If the target block height is reached, clear the interval and resolve the promise
          clearInterval(intervalId)
          resolve()
        }
      }, 1000)
    })
  }


  export const getUnixTs = () => {
    return new Date().getTime() / 1000;
  };

export function getRandomUniqueNumber(min: number, max: number, precision: number): number {
    const precisionFactor = Math.pow(10, precision);
    const uniqueNumbers = new Set<number>();
  
    while (true) {
        const randomNumber = Math.floor(Math.random() * (max * precisionFactor - min * precisionFactor + 1) + min * precisionFactor) / precisionFactor;
        if (!uniqueNumbers.has(randomNumber)) {
            uniqueNumbers.add(randomNumber);
            return randomNumber;
        }
    }
  }
  
  export async function sendSignedTransaction({
    signedTransaction,
    connection,
    successCallback,
    sendingCallback,
    confirmStatus,
    timeout = CONFIRMATIONTIMEOUT,
    skipPreflight = true,
  }: {
    signedTransaction: VersionedTransaction ;
    connection: Connection;
    successCallback: (txSig: string) => Promise<void>;
    sendingCallback: (txSig: string) => Promise<void>;
    confirmStatus: (txSig: string,confirmationStatus:string)=> Promise<void>;
    timeout?: number;
    skipPreflight?: boolean;
  }): Promise<string> {
    const rawTransaction = signedTransaction.serialize();
    const startTime = getUnixTs();
  
  
    const txid: TransactionSignature = await connection.sendRawTransaction(
      rawTransaction,
      {
        skipPreflight,
      }
    );
    sendingCallback && sendingCallback(txid);
  
    console.log("Started awaiting confirmation for", txid);
  
    let done = false;
    (async () => {
      while (!done && getUnixTs() - startTime < timeout) {
        connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
        });
        await sleep(1000);
      }
    })();
    try {
      await awaitTransactionSignatureConfirmation(txid, timeout, connection,confirmStatus);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.timeout) {
        throw new Error("Timed out awaiting confirmation on transaction");
      }
      const simulateResult = await connection.simulateTransaction(
        signedTransaction
      );
      if (simulateResult && simulateResult.value.err) {
        if (simulateResult.value.logs) {
          for (let i = simulateResult.value.logs.length - 1; i >= 0; --i) {
            const line = simulateResult.value.logs[i];
            if (line.startsWith("Program log: ")) {
              throw new Error(
                "Transaction failed: " + line.slice("Program log: ".length)
              );
            }
          }
        }
        confirmStatus(txid,'AlreadyProcessed')
       }
      throw new Error("Transaction failed");
    } finally {
      done = true;
    }
  
  
    console.log("Latency", txid, Number(getUnixTs() - startTime).toFixed(0)+'Seconds');
    successCallback && successCallback(txid);
  
    return txid;
  }
  
  async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature, timeout: number, connection: Connection,  
  confirmStatus: (txSig: string,confirmationStatus:any)=> Promise<void>) {
    let done = false;
    const result = await new Promise((resolve, reject) => {
      (async () => {  
        while (!done) {
          // eslint-disable-next-line no-loop-func
          (async () => {
            try {
              const signatureStatuses = await connection.getSignatureStatuses([
                txid,
              ]);
              const result = signatureStatuses && signatureStatuses.value[0];
              if (!done) {
                if (!result) {
                  // console.log('REST null result for', txid, result);
                } else if (result.err) {
                  console.log("REST error for", txid, result.confirmationStatus);
                  done = true;
                  confirmStatus(txid,result.confirmationStatus)
                  reject(result.err);
                } else if (
                  !(
                    result.confirmations ||
                    result.confirmationStatus === "confirmed" ||
                    result.confirmationStatus === "finalized"
                  )
                ) {
                  console.log("REST not confirmed", txid, result.confirmationStatus);
                  confirmStatus(txid,result.confirmationStatus)
                } else {
                  console.log("REST confirmed", txid, result.confirmationStatus);
                  confirmStatus(txid,result.confirmationStatus)
                  done = true;
                  resolve(result);
                }
              }
            } catch (e) {
              if (!done) {
                console.log("REST connection error: txid", txid, e);
              }
            }
          })();
          await sleep(1000);
        }
      })();
    });
    done = true;
    return result;
  }



export async function sendWithConfirm(connection: Connection, transaction: Transaction, payers:  Keypair[]) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  let blockheight = await connection.getBlockHeight();

   let signature = '';
  while (blockheight < lastValidBlockHeight) {

    if (signature != '') {
      const a = await connection.getSignatureStatus(signature);
      if (!a.value?.err) break;
    }
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    transaction.recentBlockhash = blockhash;
    transaction.sign(...payers);
    const rawTransaction = transaction.serialize();

    signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
    });
    console.log(`Signature: ${signature}`);
    await sleep(500);
     blockheight = await connection.getBlockHeight();
  }

  return signature;
}




export async function getSolprice() {
  const data = await fetch(
    "https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/So11111111111111111111111111111111111111112"
  );
  const json = await data.json();
  const solPrice =
    json?.data?.attributes?.token_prices
      .So11111111111111111111111111111111111111112;

  return solPrice;
}




export async function sendSignedTransaction2({
  signedTransaction,
  connection,
  successCallback,
  sendingCallback,
  confirmStatus,
  timeout = 30000,
  skipPreflight = true,
}: {
  signedTransaction:   Transaction ;
  connection: Connection;
  successCallback: (txSig: string) => Promise<void>;
  sendingCallback: (txSig: string) => Promise<void>;
  confirmStatus: (txSig: string,confirmationStatus:string)=> Promise<void>;
  timeout?: number;
  skipPreflight?: boolean;
}): Promise<string> {
  const rawTransaction = signedTransaction.serialize();
  const startTime = getUnixTs();


  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight,
    }
  );
  sendingCallback && sendingCallback(txid);

  console.log("Started awaiting confirmation for", txid);

  let done = false;
  (async () => {
    while (!done && getUnixTs() - startTime < timeout) {
      connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      await sleep(2000);
    }
  })();
  try {
    await awaitTransactionSignatureConfirmation(txid, timeout, connection,confirmStatus);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.timeout) {
      throw new Error("Timed out awaiting confirmation on transaction");
    }
    
    throw new Error("Transaction failed");
  } finally {
    done = true;
  }


  console.log("Latency", txid, Number(getUnixTs() - startTime).toFixed(0)+'Seconds');
  successCallback && successCallback(txid);

  return txid;
}

async function awaitTransactionSignatureConfirmation2(
txid: TransactionSignature, timeout: number, connection: Connection,  
confirmStatus: (txSig: string,confirmationStatus:any)=> Promise<void>) {
  let done = false;
  const result = await new Promise((resolve, reject) => {
    (async () => {  
      while (!done) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            const result = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!result) {
                // console.log('REST null result for', txid, result);
              } else if (result.err) {
                console.log("REST error for", txid, result.confirmationStatus);
                done = true;
                confirmStatus(txid,result.confirmationStatus)
                reject(result.err);
              } else if (
                !(
                  result.confirmations ||
                  result.confirmationStatus === "confirmed" ||
                  result.confirmationStatus === "finalized"
                )
              ) {
                console.log("REST not confirmed", txid, result.confirmationStatus);
                confirmStatus(txid,result.confirmationStatus)
              } else {
                console.log("REST confirmed", txid, result.confirmationStatus);
                confirmStatus(txid,result.confirmationStatus)
                done = true;
                resolve(result);
              }
            }
          } catch (e) {
            if (!done) {
              console.log("REST connection error: txid", txid, e);
            }
          }
        })();
        await sleep(1000);
      }
    })();
  });
  done = true;
  return result;
}