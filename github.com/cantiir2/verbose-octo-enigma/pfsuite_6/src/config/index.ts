import { ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Signer, Transaction, clusterApiUrl } from '@solana/web3.js'
import base58, { decode } from 'bs58'
import { Currency, Token, TxVersion, TOKEN_PROGRAM_ID, LOOKUP_TABLE_CACHE, MAINNET_PROGRAM_ID, DEVNET_PROGRAM_ID } from '@raydium-io/raydium-sdk'

require('dotenv').config()
const RPC_URL='https://lingering-damp-lambo.solana-mainnet.quiknode.pro/41ced52afd17c1798eb1b6524ae12a981521a1d4'
const MAINWALLET: any = process.env.MAIN_WALLET_KEY
const SENDERWALLET: any = process.env.SENDER_WALLET_KEY
const NETWORK: any = process.env.NETWORK
const RSELL = process.env.randomSellWalletsCount
const JITOKEYS=process.env.JITOKEYS
const SL: any = process.env.DEFAULT_SLIPPAGE
const PF: any = process.env.PRIORITYFEE
const JT: any = process.env.JITOTIPS
const TO: any = process.env.TIMEOUT
export interface Drop {
  address: string,
  privateKey: string,
  buyAmount: number,
  tokensBought:number,
  walletAta: string
}

export interface Booster {
  address: string,
  privateKey: string,
  boostMaxAmount: number,
  boostMinAmount: number,
  gen: boolean
}

export const dropList: Drop[] = [];
export const boosterList: Booster[] = [];

export const isDevnet = NETWORK == 'devnet'
export type TransactionWithSigners = {
  transaction: Transaction;
  signers: Array<Signer>;
};

export const perKToken = 2.8e-8;


export const connection = NETWORK == 'mainnet' ? new Connection(RPC_URL, 'finalized') : new Connection(clusterApiUrl('devnet'), 'finalized');
export const mainWallet = Keypair.fromSecretKey(base58.decode(MAINWALLET));
export const senderWallet = Keypair.fromSecretKey(base58.decode(SENDERWALLET));
export const makeTxVersion = TxVersion.V0;
export const addLookupTableInfo = NETWORK == 'mainnet' ? LOOKUP_TABLE_CACHE : undefined;
export const PROGRAM_ID = NETWORK == 'mainnet' ? MAINNET_PROGRAM_ID : DEVNET_PROGRAM_ID;
export const DEFAULT_TOKEN = {
  'WSOL': new Token(TOKEN_PROGRAM_ID, new PublicKey('So11111111111111111111111111111111111111112'), 9, 'WSOL', 'WSOL'),
}
 
export const randomSellWalletsCount = RSELL
export const slippageDefault = SL
export const priorityFees = PF
export const jitoTips = JT
export const CONFIRMATIONTIMEOUT = TO
export const JitoPvtAuthKeys=JITOKEYS

export const programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export const FEERCPT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
export const EVENT_AUTH = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
export const GLOBALSTATE = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
export const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");


export const PRIORITY_FEE_AMT = priorityFees * LAMPORTS_PER_SOL;
export const ACCNT_CREATION_FEES = 0.0025 * LAMPORTS_PER_SOL;
export const PRIORITY_FEE_IX = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_AMT });
