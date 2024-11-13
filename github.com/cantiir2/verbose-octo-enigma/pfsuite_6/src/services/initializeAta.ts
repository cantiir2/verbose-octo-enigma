import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"; 
import * as web3 from "@solana/web3.js"
import { initializeLookupTable, sendV0Transaction, waitForNewBlock } from "../utils/functions";
import { readFileSync, writeFileSync } from "fs";
import { Drop, dropList } from '../config/index';


export async function InitiaLizeAlts( baseMint: web3.PublicKey, allAddress: any[], user: web3.Keypair, connection: web3.Connection) {
 
    const wallets:Drop[] = JSON.parse(readFileSync(`./wallets/${baseMint.toBase58()}.wallets.json`, 'utf-8'));

    
    for (let i = 0; i < wallets.length; i++) {  

      const ata = await getAssociatedTokenAddress(baseMint,new web3.PublicKey(wallets[i].address), true);

      allAddress.push(new web3.PublicKey(wallets[i].address));
      allAddress.push(ata); 
    } 

    const lookupTableAddress = await initializeLookupTable(
      user,
      connection,
      allAddress
    );

    
  
    await waitForNewBlock(connection, 1);
  
    const lookupTableAccount = (
      await connection.getAddressLookupTable(lookupTableAddress)
    ).value;
  
    if (!lookupTableAccount) {
      throw new Error("Lookup table not found");
    }

    return lookupTableAddress
   
  }