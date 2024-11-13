import { TokenAccount, SPL_ACCOUNT_LAYOUT } from "@raydium-io/raydium-sdk";
import { WalletCalculationResult } from "../config/types";
import { logger } from "../services/logger";
import { ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Signer, Transaction, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import PumpFun from "../pumpFun/PumpFun";
import { mainWallet, PRIORITY_FEE_AMT } from "../config";
import { BN } from "@coral-xyz/anchor";



export function checkValues(r, n, i, e) {
  let t = n.mul(i)
  let o = n.add(e) 
  let l = t.div(o).add(new BN(1));
  let s = i.sub(l);
  s = BN.min(s, r).div(new BN(1e6));
  return s;
}

export const calculateWalletsOutgo = async (
  devTradeAmount,
  initialBuyAmount,
  numberOfWallets,
  buyIncrementPercentage,
  tokenAccountCreationFee,
  priorityFee,
  tokenCreationFee
) => {
  const results: WalletCalculationResult[] = [];
  

  console.log({
    devTradeAmount,
  initialBuyAmount,
  numberOfWallets,
  buyIncrementPercentage,
  tokenAccountCreationFee,
  priorityFee,
  tokenCreationFee
  })
  const tokenDecimals = 10 ** 6;
	const tokenTotalSupply = 1000000000 * tokenDecimals;
	let initialRealSolReserves = 0;
	let initialVirtualTokenReserves = 1073000000 * tokenDecimals;
	let initialRealTokenReserves = 793100000 * tokenDecimals;
	let totalTokensBought = 0;
 let totalOutgo=0;

  let walletBuy= initialBuyAmount;

  for (let it = 0; it <= numberOfWallets; it++) {
		let keypair;

		let solInput;
		if (it === 0) {
			solInput = devTradeAmount;
			keypair = mainWallet;
      
      console.log(solInput)

      const e = new BN(solInput*LAMPORTS_PER_SOL);
      
      const initialVirtualSolReserves = 30 * LAMPORTS_PER_SOL + initialRealSolReserves;
      const a = new BN(initialVirtualSolReserves).mul(new BN(initialVirtualTokenReserves));
      const i = new BN(initialVirtualSolReserves).add(e);
      const l = a.div(i).add(new BN(1));
      let tokensToBuy = new BN(initialVirtualTokenReserves).sub(l);
      tokensToBuy = BN.min(tokensToBuy, new BN(initialRealTokenReserves));
      solInput = Number(solInput) * 1.21;

      const tokensBought = tokensToBuy.toNumber();

      totalOutgo += solInput;
      results.push({
        tokenType: 'Dev',
        walletNumber: 'Wallet-Dev',
        buyAmount: Number(Number(devTradeAmount).toFixed(5)),
        transferAmount:Number(Number(solInput).toFixed(5))+tokenCreationFee+2*tokenAccountCreationFee+0.00005+2* priorityFee,
        tokensBought: Number(Number(tokensBought/tokenDecimals).toFixed(0)),
      });
      initialRealSolReserves += e.toNumber();
		initialRealTokenReserves -= tokensBought;
		initialVirtualTokenReserves -= tokensBought;
		totalTokensBought += tokensBought;
    
		} else {
			solInput = walletBuy 
			keypair = Keypair.generate();
      walletBuy = walletBuy*(1 + buyIncrementPercentage/100);
      const e = new BN(solInput*LAMPORTS_PER_SOL);
      const initialVirtualSolReserves = 30 * LAMPORTS_PER_SOL + initialRealSolReserves;
      const a = new BN(initialVirtualSolReserves).mul(new BN(initialVirtualTokenReserves));
      const i = new BN(initialVirtualSolReserves).add(e);
      const l = a.div(i).add(new BN(1));
      let tokensToBuy = new BN(initialVirtualTokenReserves).sub(l);
      tokensToBuy = BN.min(tokensToBuy, new BN(initialRealTokenReserves));
 
      solInput = Number(solInput) * 1.21;

      const tokensBought = tokensToBuy.toNumber();

      totalOutgo += solInput;

      results.push({
        tokenType: 'Bundle',
        walletNumber: 'Wallet-Buyer',
        buyAmount: Number(Number(solInput).toFixed(4)),
        transferAmount:Number(Number(solInput*1.21).toFixed(4))+4*tokenAccountCreationFee+0.005+4* priorityFee,
        tokensBought: Number(Number(tokensBought/tokenDecimals).toFixed(0)),
      }); 
      initialRealSolReserves += e.toNumber();
      initialRealTokenReserves -= tokensBought;
      initialVirtualTokenReserves -= tokensBought;
      totalTokensBought += tokensBought;
      

		}

		    
	}

   

  logger.debug(`Total Outgo: ${totalOutgo.toFixed(6)} SOL`);
  logger.debug(`Total Tokens Bought: ${totalTokensBought}`);

  return { results: results, totalOutgo: totalOutgo, totalTokensBought };
}


const customHeaders = {
  walletNumber: 'Wallet ID',
  buyAmount: 'Amount for Buy',
  transferAmount: 'Total Amount Required',
  tokensBought: 'Estimated Tokens Bought'
};

export const transformTable = (data: any[]) => {
  return data.map(item => {
    const transformedItem = {};
    for (const key in item) {
      if (customHeaders[key]) {
        transformedItem[customHeaders[key]] = isNaN(item[key])? item[key]:Number(item[key].toFixed(4));
      }
    }
    return transformedItem;
  });
}

export async function getWalletTokenAccount(connection: Connection, wallet: PublicKey, tokenMint: PublicKey): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    mint: tokenMint
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}
