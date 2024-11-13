import { say } from "cfonts";
import chalk from "chalk";
import { logger } from "./logger";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { Project, TokenData } from "../config/types";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { connection, dropList, mainWallet, priorityFees, programID, senderWallet, slippageDefault } from "../config";
import { calculateWalletsOutgo, transformTable } from "../utils/utils";
const prompt2 = require('prompt-sync')({ sigint: true });
import { prompt } from 'enquirer';
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { METADATA_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import PumpFun from "../pumpFun/PumpFun";
import { BN } from "bn.js";
import { bs } from "@raydium-io/raydium-sdk-v2/lib/type-ad22b956";

async function promptForTokenData(): Promise<TokenData> {
    const response = await prompt([
        {
            type: 'input', name: 'tokenName', message: '1️⃣   Token Name:',
            validate: (value) => {
                if (value == '') return false;
                return true;
            }
        },
        {
            type: 'input', name: 'tokenSymbol', message: '2️⃣   Token Symbol (Should be same as Project Token Symbol):',
            validate: (value) => {
                if (value == '') return false;
                return true;
            }
        },
        {
            type: 'input', name: 'imageFileName', message: '3️⃣   Image File Name:(Place a image in root folder and enter its full name e.g demo.png)',
            validate: (value) => {
                if (value == '') return false;
                if (value.endsWith('png') || value.endsWith('jpg') || value.endsWith('jpeg')) {
                    if (!existsSync(value)) {
                        console.clear();
                        console.table(`Image file '${value}' not found in the root folder.`);
                        return false;
                    } else
                        return true;
                }
                else {
                    console.clear();
                    console.table('Not a Valid File Extension')
                    return false;
                }
            }
        },
        {
            type: 'input', name: 'telegramUrl', message: '4️⃣   Telegram URL:>>',
            validate: (value) => {

                return true;
            }
        },
        {
            type: 'input', name: 'twitterUrl', message: '5️⃣   Twitter URL:>>',
            validate: (value) => {
                return true;
            }
        },
        {
            type: 'input', name: 'websiteUrl', message: '6️⃣   Website URL:>>',
            validate: (value) => {
                return true;
            }
        },
        {
            type: 'input', name: 'description', message: '7️⃣   Description:>>',
            validate: (value) => {
                return true;
            }
        },
        {
            type: 'numeral', name: 'numberOfWallets', message: '💊   Wallets Count to Generate: (Max 19) >>',
            validate: (value) => {
                if (Number(value) <= 19) return true;
                return false;
            }
        },
        {
            type: 'numeral', name: 'devWalletBuyAmount', message: '💸   Dev Wallet Trade Amount  (e.g 1 Sol ):>>',
            validate: (value) => {
                if (!isNaN(Number(value)))
                    return true;
                else return false;
            }
        },
        {
            type: 'numeral', name: 'startingBuyAmount', message: '💸   Bundle Wallets Trade Amount to Bundle (e.g 1 Sol ):>>',
            validate: (value) => {
                if (!isNaN(Number(value)))
                    return true;
                else return false;
            }
        },
        {
            type: 'numeral', name: 'buyIncrementPercentage', message: `📈   Trading Amount Increment per each wallet in Bundle (e.g 5 '%' ):>>`,
            validate: (value) => {
                if (!isNaN(Number(value)))
                    return true;
                if(Number(value)<0)return false;

                else return false;
            }
        },
    ]);

    return response as TokenData;
}


async function promptForSymbolData(): Promise<string> {
    const response: Project = await prompt([
        {
            type: 'input', name: 'genNew', message: '1️⃣  Generate New Token (Y/N) ?',
            validate: (value) => {
                if (value == '' || value == 'Y' || value == 'N' || value == 'y' || value == 'n') return true;
                return false;
            }
        },
    ])

    if (response.genNew == 'Y' || response.genNew == 'y') {
        const response1: any = await prompt([
            {
                type: 'input', name: 'tokenTagS', message: '2️⃣ Token Address Starting with (Press n to skip):',
                validate: (value) => {
                    if (value == '' || value.length > 3) {
                        console.log('');
                        logger.error(' Token Tag should be less than 3 characters');
                        return false;
                    } else if (value == 'n' || value == 'N') return true;
                    else return true;
                }
            },
        ])

        if (response1.tokenTagS == 'n' || response1.tokenTagS == 'N') {

            const response2: any = await prompt([
                {
                    type: 'input', name: 'tokenTagE', message: '3️⃣  Token Address Ending with (Press n to skip):',
                    validate: (value) => {
                        if (value == '' || value.length > 3) {
                            console.log('');
                            logger.error(' Token Tag should be less than 3 characters');
                            return false;
                        } else if (value == 'n' || value == 'N') return true;
                        else return true;
                    }
                },
            ])
            if (response2.tokenTagE != 'n' || response1.tokenTagE != 'N') {

                let address = '';
                let token;
                while (!address.endsWith(response2.tokenTagE)) {
                    token = Keypair.generate();
                    address = token.publicKey.toString()

                }
                const tokenKey = {
                    tokenAddress: token.publicKey.toString(),
                    tokenMintKey: bs58.encode(token.secretKey),
                }
                // Save the wallet to a file
                writeFileSync(`./generated/${token.publicKey.toString()}.json`, '['+token.secretKey.toString()+']');

                logger.info('Token Mint Generated ' + tokenKey.tokenAddress)
                return token.publicKey.toString();

            } else {

                let address = '';
                let token;
                while (!address.startsWith(response1.tokenTagS)) {
                    token = Keypair.generate();
                    address = token.publicKey.toString()
                }
                const tokenKey = {
                    tokenAddress: token.publicKey.toString(),
                    tokenMintKey: bs58.encode(token.secretKey),
                }
                // Save the wallet to a file
                writeFileSync(`./generated/${token.publicKey.toString()}.json`, '['+token.secretKey.toString()+']');
                logger.info('Token Mint Generated ' + tokenKey.tokenAddress)

                return token.publicKey.toString();
            }



        } else {

            console.log(' Starting with Letters ' + response1.tokenTagS)
            let address = '';
            let wallet;
            while (!address.startsWith(response1.tokenTagS)) {
                wallet = Keypair.generate();
                address = wallet.publicKey.toString()
            }
            const walletKey = {
                tokenAddress: wallet.publicKey.toString(),
                tokenMintKey: bs58.encode(wallet.secretKey),
            }
            // Save the wallet to a file
            writeFileSync(`./generated/${wallet.publicKey.toString()}.json`, '['+wallet.secretKey.toString()+']');

            return wallet.publicKey.toString();
        }

    }
    else {

        const response: Project = await prompt([
            {
                type: 'input', name: 'projectTokenSymbol', message: '1️⃣ FileName of Token to  Load  From Generated Folder (Place Token Keys json in generated folder first):',
            },
        ])

 

        return response.projectTokenSymbol;
    }

}


export const createTokenMeta = async () => {

    let pre: any = undefined;
    let t: any = undefined;
    let p: string = await promptForSymbolData();
    let wallets = [];


    if (p) {
        try {
            const vanityKeyFile = JSON.parse(readFileSync(`./generated/${p}.json`, 'utf-8'));
             
            const pk = Keypair.fromSecretKey(Uint8Array.from(vanityKeyFile));

            pre = {
                tokenMintKey: bs58.encode(pk.secretKey),
                tokenAddress: pk.publicKey.toBase58()
            }

        } catch (error) {
            console.log(' Token Meta Config file Not Found, Create One to Continue')
            return await createTokenMeta();
        }


        try {
            t = JSON.parse(readFileSync(`./wallets/${p}.config.json`, 'utf-8'));
            wallets = JSON.parse(readFileSync(`./wallets/${p}.wallets.json`, 'utf-8'));

            if(t.tokenInfo)
            return { tokenInfo: t.tokenInfo, wallets: wallets }
            else             
            return { tokenInfo: t , wallets: wallets }


        } catch (error) {
            console.log('No Existing Wallet Found, Creating New Meta with Token Address ' + p)
        }
        if (!t || t == null) {
            t = await promptForTokenData();
        }

        if (Number(t.startingBuyAmount) > 0) {


            const devTradeAmount =  t.devWalletBuyAmount
            const initialBuyAmount = t.startingBuyAmount

           

            const pfCost = 0.02;
            let totalSolRequired = 0;
            const tokensForInitialSol = 100001;
            const initialSolForTokens = 0.003244302;
            const initialTokenPrice = initialSolForTokens / tokensForInitialSol; // Initial price per token

            const numberOfWallets = Number(t.numberOfWallets);
            const buyIncrementPercentage = Number(t.buyIncrementPercentage) // Each subsequent wallet increases the buy amount by 5%

            const tokenAccountCreationFee = 0.003; // Token account creation fee
            const priorityFee = priorityFees; // Solana priority fee
            const tokenCreationFee = 0.02; // Token creation fee


            const { results: walletResults, totalOutgo, totalTokensBought } =await calculateWalletsOutgo(
                devTradeAmount,
                initialBuyAmount,
                numberOfWallets,
                buyIncrementPercentage,
                tokenAccountCreationFee,
                Number(priorityFee),
                tokenCreationFee  
            );
            const data = transformTable(walletResults)
            console.table(data);

            const wallBalanceWei = await connection.getBalance(senderWallet.publicKey);
            const wallBal = wallBalanceWei / 1e9;   
            const totalsolRequired = totalOutgo+priorityFees*(numberOfWallets+1);
            const tokenDecimals = 10 ** 6;
            const tokenTotalSupply = 1000000000 * tokenDecimals;
        
            logger.info(`Your Sender Wallet  is : ${senderWallet.publicKey.toString()}`)
            logger.info(`Your Sender Wallet balance is : ${Number(wallBal).toFixed(2)} SOL`)
            logger.info(`Amount Required to Run the Bundler : ${Number(totalsolRequired).toFixed(2)} SOL`)
            logger.info(`Total Tokens Bought By the Bundler : ${Number(totalTokensBought/tokenDecimals).toFixed(0)}`)
            logger.info(`Total Supply Bought By the Bundler : ${Number(100 * totalTokensBought / tokenTotalSupply).toFixed(3)} %`)

            if (Number(wallBal) < 0 ) {//Number(totalOutgo)
                logger.error('You do not have Enough Solana Balance to Run the Bundler')

                const questions = [{
                    type: 'select',
                    name: 'exitoptions',
                    message: 'Select Operation to Perform?',
                    initial: 1,
                    choices: [
                        { name: 1, message: 'Quit >', value: '1' }
                    ]
                }];

                const answers: any = await prompt(questions);


            } else {
                logger.info(' ')
                let csvWallets: any = '';


                const mintKey = Keypair.fromSecretKey(bs58.decode(pre.tokenMintKey));


                const tokenAddress = mintKey.publicKey.toBase58();
                const tokenKey = base58.encode(mintKey.secretKey)
                const tokenMint = mintKey;
                t.tokenAddress = tokenAddress;
                t.tokenMintKey = tokenKey;
                const global = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');

                let [mintAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("mint-authority")], programID);
                let [bondingCurve] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("bonding-curve"), tokenMint.publicKey.toBuffer()], programID);
                let associatedBondingCurve = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true);
                let [metadata] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.publicKey.toBuffer()], METADATA_PROGRAM_ID)
                let [eventAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("__event_authority")], programID)


                t.mintAuthority = mintAuthority.toBase58();
                t.bondingCurve = bondingCurve.toBase58();
                t.associatedBondingCurce = associatedBondingCurve.toBase58();
                t.metadata = metadata.toBase58()
                t.eventAuthority = eventAuthority.toBase58();



                const config = t;
                config.slippagePctg = slippageDefault;

                logger.info(' Generating Wallets with Associated Token Accounts ')
                for (var i = 0; i < t.numberOfWallets; i++) {
                    const w = Keypair.generate();
                    const ata = await getAssociatedTokenAddress(tokenMint.publicKey, w.publicKey, true);


                    dropList.push({
                        address: w.publicKey.toBase58(),
                        privateKey: base58.encode(w.secretKey),
                        buyAmount: walletResults[i+1].buyAmount,
                        tokensBought: walletResults[i+1].tokensBought,
                        walletAta: ata.toBase58()
                    })

                    csvWallets += '\n' + base58.encode(w.secretKey)
                }
                logger.info('Wallets Generated - ' + dropList.length);

                writeFileSync(`./wallets/${t.tokenAddress}.config.json`, JSON.stringify(config, null, 2), 'utf8');
                writeFileSync(`./wallets/${t.tokenAddress}.wallets.json`, JSON.stringify(dropList, null, 2), 'utf8');


                const questions = [{
                    type: 'select',
                    name: 'exitoptions',
                    message: 'Select Any Key To Continue?',
                    initial: 1,
                    choices: [
                        { name: 1, message: 'Continue >', value: '1' },
                    ]
                }];


                return { tokenInfo: t, wallets: wallets }
            }

        }

    } else {
        logger.info('Enter a  TOKEN Address to Continue or Y/N to Generate')
        return await createTokenMeta();
    }

}
