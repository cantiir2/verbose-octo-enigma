import { ApiV3PoolInfoStandardItem, fetchMultipleInfo, getATAAddress, makeAMMSwapInstruction, Raydium, WSOLMint } from "@raydium-io/raydium-sdk-v2";
import { connection, PRIORITY_FEE_IX } from "../config";
import { Keypair, PublicKey,Transaction,LAMPORTS_PER_SOL,SystemProgram } from '@solana/web3.js'; 
import { prompt } from 'enquirer';
import { readFileSync } from "fs";
import { sendWithConfirm } from "../utils/functions";
import { createAssociatedTokenAccountInstruction, createSyncNativeInstruction, TOKEN_PROGRAM_ID, createCloseAccountInstruction } from "@solana/spl-token";
import BN from "bn.js";
import bs58 from "bs58";
import { SPL_ACCOUNT_LAYOUT } from "@raydium-io/raydium-sdk";
import { slippageDefault } from '../config/index';
 const initLoadRaydium = async (userWallet:Keypair ) => {
    let raydium = await Raydium.load({
      owner:userWallet,
      connection,
      cluster: 'mainnet',
      disableFeatureCheck: true,
      disableLoadToken: true,
    }) 
    return raydium;
}


const RaydiumDump = async(tokenAddress:string)=>{
    const response:{ammid:string} = await prompt([
        {
            type: 'input',
            name: 'ammid',
            message: 'Enter Token Pool Id / Amm Id on Raydium for the Token > ',
            async onSubmit(_name: any, value: any) {
                try {
                    const p = new PublicKey(value);
                    return value;
                } catch (Error) {
                    console.log('\n')
                    console.log('Invalid PublicKey entered')
                    process.exit(0)
                }
            }
        }
    ]);


    if(response.ammid){

        const boosterConfig = JSON.parse(readFileSync(`./wallets/${tokenAddress}.config.json`, 'utf-8'));
        const wallets = JSON.parse(readFileSync(`./wallets/${tokenAddress}.wallets.json`, 'utf-8'));

        async function getSdkV3Transactions(item: any) {
            const userwallet = Keypair.fromSecretKey(bs58.decode(item.mainWallet));

            console.log('Loading Raydium for Wallet ' + userwallet.publicKey.toBase58())
            const raydium = await initLoadRaydium(userwallet);

            const amountA = Number(item.tradeAmount) * LAMPORTS_PER_SOL


            let amount = Number(Number(Math.random() * amountA).toFixed(0));
            while (amount < amountA / 2) {
                amount = Number(Number(Math.random() * amountA).toFixed(0));
            }
            console.log(` Trading with random Amount for ${Number(amount)} MICROLAMPORTS`);
 

            const data1 = (await raydium.api.fetchPoolById({ ids: response.ammid})) as any
            const poolInfo = data1[0] as ApiV3PoolInfoStandardItem
            const poolKeys = await raydium.liquidity.getAmmPoolKeys(poolInfo.id)
            const res = await fetchMultipleInfo({
                connection: raydium.connection,
                poolKeysList: [poolKeys],
                config: undefined,
              })
              const pool = res[0]
            
              await raydium.liquidity.initLayout()
            if (response.ammid && poolKeys) {
 

                const balAcnt = await connection.getTokenAccountsByOwner(userwallet.publicKey, {
                    mint: new PublicKey(tokenAddress)
                })
                const tokenBalance = Number(SPL_ACCOUNT_LAYOUT.decode(balAcnt.value[0].account.data).amount.toString());
                

                const blvh = await connection.getLatestBlockhash('finalized');
                const trnx = new Transaction().add(PRIORITY_FEE_IX);

                const mintA = new PublicKey(tokenAddress);
                const mintB = WSOLMint
                const out = raydium.liquidity.computeAmountOut({
                    poolInfo: {
                      ...poolInfo,
                      baseReserve: pool.baseReserve,
                      quoteReserve: pool.quoteReserve,
                    },
                    amountIn: new BN(tokenBalance),
                    mintIn: mintA,  
                    mintOut: mintB,  
                    slippage: boosterConfig.slippagePctg,  
                  })

                  const { transaction,signers } = await raydium.liquidity.swap({
                    poolInfo,
                    amountIn: new BN(tokenBalance),
                    amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
                    fixedSide: 'in',
                    inputMint: mintA.toBase58(), 
                    associatedOnly: false,
                    txVersion:0,
                    computeBudgetConfig: {
                      units: 600000,
                      microLamports: 100000000,
                    },
                  }) 
                return {transaction:transaction, wallets:signers};
            }


        }

        async function generateSwapAndExecute() {
            const transactions = await Promise.all((wallets.map(async (item: any) => { 
                const trnx :any= await getSdkV3Transactions(item);
                 return await sendWithConfirm(connection,trnx.transaction,trnx.wallet);
             }))); 
            console.log(transactions); 

        }
        await generateSwapAndExecute();

    }


}
  
  
export default RaydiumDump;