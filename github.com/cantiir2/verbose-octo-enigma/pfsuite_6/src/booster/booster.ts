import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import base58 from "bs58";
import { say } from "cfonts";
import { prompt } from 'enquirer';
import { readFileSync, writeFileSync } from "fs";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { SPL_ACCOUNT_LAYOUT } from '@raydium-io/raydium-sdk';
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import axios from "axios";
import { boosterList, connection, dropList, EVENT_AUTH, FEERCPT, GLOBALSTATE, mainWallet, PRIORITY_FEE_IX, programID, randomSellWalletsCount } from "../config";
import { pumpFunProgram } from "../pumpFun/PumpFunProgram";
import { sendSignedTransaction, getRandomUniqueNumber, sendSignedTransaction2, getSolprice } from "../utils/functions";
import { getWalletTokenAccount } from "../utils/utils";
import { CustomWallet } from '../pumpFun/wallet';

interface Response1 {
    tokenAddress: string;
    tokenType: string;
    walletCount: number;
    boostMinAmount: number;
    boostMaxAmount: number;
    boostInterval: number;
    boostDuration: number;
    tradesPerInterval: number;
}

let baseMint = PublicKey.default;
let wallets: any = [];
const NUM_DROPS_PER_TX = 10;
let randomTradingTimerEnabled = false
let boosterInterval = 2;
let tokenAddress='';
 
const provider = new AnchorProvider(connection, new CustomWallet(mainWallet), AnchorProvider.defaultOptions())

const pfProgram = pumpFunProgram({
    provider: provider,
    programId: programID,
});

const boostermain = async (tokenMintAddress:string) => {
    tokenAddress=tokenMintAddress
    console.clear();
    say('PFSuite', {
        font: 'tiny',
        align: 'left',
        colors: ['system'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: '200',
        independentGradient: true,
        transitionGradient: true,
        env: 'node'
    });
 
     baseMint = new PublicKey(tokenAddress);

    try {
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));
    } catch (error) {

    }
    if (wallets.length > 0) {
        console.log('Wallets Loaded from Existing File')

        main0();

    } else {

        const wals: Response1 = await prompt([
            {
                type: 'input',
                name: 'walletCount',
                message: 'Enter the Booster Wallets Count to Generate>',
                async result(value: string) {
                    return value;
                }
            },
            {
                type: 'input',
                name: 'tradesPerInterval',
                message: 'Enter the Trades Per Interval >',
                async result(value: string) {
                    return value;
                }
            },
            {
                type: 'input',
                name: 'boostMinAmount',
                message: 'Enter the Min Trade Amount to use Per trade per wallet (in Sol)>',
                async result(value: string) {
                    return value;
                }
            },
            {
                type: 'input',
                name: 'boostMaxAmount',
                message: 'Enter the Max Trade Amount to use Per trade per wallet (in Sol)>',
                async result(value: string) {
                    return value;
                }
            },
            {
                type: 'input',
                name: 'boostInterval',
                message: 'Enter the Time Interval to Run Booster (in Minutes)>',
                async result(value: string) {
                    return value;
                }
            },

            {
                type: 'input',
                name: 'boostTimer',
                message: 'Enter the time to Stop the Bot (in Minutes)>',
                async result(value: string) {
                    return value;
                }
            }
        ])
        if (wals.walletCount > 0 && wals.boostMinAmount && wals.boostMaxAmount && wals.tradesPerInterval && wals.boostInterval) {

            const solPrice = await getSolprice();
            const totalTrades = wals.walletCount * (3600 / wals.boostInterval);
            const boostMaxAmount = Number(wals.boostMaxAmount);
            const boostMinAmount = Number(wals.boostMinAmount);
            const marketCap = solPrice * boostMaxAmount * totalTrades * 2;
            boosterInterval = wals.boostInterval;
            const feePerTrade = (0.25 / 100) * boostMaxAmount * totalTrades;
            const totalDecay = Number(feePerTrade)
            const minRequiredSolana = 2 * boostMaxAmount + totalDecay;
            const wallBalanceWei = await connection.getBalance(mainWallet.publicKey);
            const wallBal = wallBalanceWei / 1e9;

            const showcase = [{
                "Trades/Hr": (60 / wals.boostInterval),
                "Wallets": wals.walletCount,
                "Sol/Wallet": boostMaxAmount,
                "Trades": totalTrades,
                "Raydium Fees": '0.25%',
                "Reqd Solana": Number(minRequiredSolana).toFixed(2),
                "Target MCap": Number(marketCap).toFixed(0)
            }]

            console.table(showcase);

            if (Number(wallBal) < 0) {
                console.log(`Your Current Wallet  is : ${mainWallet.publicKey.toString()}`)
                console.log(`Your Current Wallet balance is : ${Number(wallBal).toFixed(2)} SOL`)
                console.log(`Amount Required to Run the Boost : ${Number(minRequiredSolana).toFixed(2)} SOL`)
                console.log('You do not have Enough Solana Balance to Run the Boost')

                const questions = [{
                    type: 'select',
                    name: 'exitoptions',
                    message: 'Select Operation to Perform?',
                    initial: 1,
                    choices: [
                        { name: 1, message: 'Restart >', value: '1' },
                        { name: 3, message: 'Quit >', value: '3' }
                    ]
                }];

                const answers: any = await prompt(questions);

                if (answers.exitoptions == '1')
                    boostermain(tokenAddress)
                else {
                    process.exit(0)
                }
            }
            else {

                let csvWallets: any = '';
                for (var i = 0; i < wals.walletCount; i++) {
                    const w = Keypair.generate();
                    boosterList.push({
                        address: w.publicKey.toBase58(),
                        privateKey: base58.encode(w.secretKey),
                        boostMaxAmount: boostMaxAmount,
                        boostMinAmount: boostMinAmount,
                        gen: true
                    })

                    csvWallets += '\n' + base58.encode(w.secretKey)
                }

                console.log('Wallets Generated - ' + wals.walletCount);
                writeFileSync(`./boosterwallets/${tokenAddress}.json`, JSON.stringify(boosterList, null, 2), 'utf8');

                const config = {
                    "tokenAddress": tokenAddress,
                    "slippagePctg": 5,
                    ...wals
                }
                writeFileSync(`./boosterwallets/${tokenAddress}.config.json`, JSON.stringify(config, null, 2), 'utf8');


                const response: any = await prompt([
                    {
                        type: 'input',
                        name: 'x',
                        message: 'Press any Key to continue > ',
                        async onSubmit(_name: any, value: any) {
                            return value;
                        }
                    }
                ]);

                main0();

            }
        }
    }
}


const main0 = async () => {

    wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));

    const walletCount = wallets.length;
    // console.clear();
    say('Pumpfun HB', {
        font: 'slick',
        align: 'center',
        gradient: ['red', 'green'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: '0',
        independentGradient: false,
        transitionGradient: false,
        env: 'node'
    });

    const questions = [{
        type: 'select',
        name: 'optiontokens',
        message: 'Select Operation to Perform?',
        initial: 1,
        choices: [

            { name: 1, message: 'List Wallets Sol Balances >', value: 1 },
            { name: 2, message: 'List Wallets Token Balances >', value: 2 },
            { name: 3, message: 'Set Slippage (Default: 5 %) >', value: 3 },
            { name: 4, message: 'Transfer Trading Amount (Sol) to All Wallets >', value: 4 },
            { name: 31, message: 'Enable Random Trading Timer >', value: 31 },
            { name: 5, message: `Sell all Tokens from all Wallets (only ${randomSellWalletsCount}) >`, value: 5 },
            { name: 6, message: 'Recover all Sol balances from Wallets to Main Wallet >', value: 6 },
            { name: 7, message: 'Start PumpFun Booster Bot >', value: 7 },
            { name: 8, message: 'Quit >', value: 8 }
        ]
    }];

    const answers: any = await prompt(questions);

    if (answers.optiontokens == 31) {
        randomTradingTimerEnabled = true;
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();
    }
    if (answers.optiontokens == 4) {

        const solamnts: any = await prompt([
            {
                type: 'input',
                name: 'solAmounts',
                message: 'Enter Amount of SOL to transfer to each Wallet > ',
                async onSubmit(_name: any, value: any) {
                    try {
                        const p = Number(Number(value).toFixed(4));
                        if (isNaN(p)) throw Error('Not a Number');
                        return value;
                    } catch (Error) {
                        console.log('\n')
                        console.log('Invalid amount entered')
                        process.exit(0)
                    }
                }
            }
        ]);

        const solAmounts = solamnts.solAmounts;

        const tnsList: Transaction[] = [];
        const recvrWallet = mainWallet;
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        const tnx: Transaction = new Transaction();

        for (var i = 0; i < wallets.length; i++) {
            const walletAddress = wallets[i].address;
 
            console.log(` Transferring ${solAmounts} Sols From Main wallet to Trader Wallet ` + walletAddress);
            const ix = SystemProgram.transfer({
                fromPubkey: mainWallet.publicKey,
                toPubkey: new PublicKey(walletAddress),
                lamports: solAmounts * LAMPORTS_PER_SOL
            })
            
            tnx.add(ix)
          
         }
            tnx.feePayer = mainWallet.publicKey;
            tnx.recentBlockhash = blockhash;
            tnx.sign(mainWallet);

                try {
                    // looping creates weird indexing issue with transactionMessages
                    await sendSignedTransaction2({
                        signedTransaction: tnx,
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
          
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();

    }
    else if (answers.optiontokens == 3) {
        const slppageP: any = await prompt([
            {
                type: 'input',
                name: 'slippagePctg',
                message: 'Enter Slippage percentage (min 5%) > ',
                async onSubmit(_name: any, value: any) {
                    try {
                        const p = Number(Number(value).toFixed(4));
                        if (isNaN(p)) throw Error('Not a Number');
                        return value;
                    } catch (Error) {
                        console.log('\n')
                        console.log('Invalid value entered')
                        process.exit(0)
                    }
                }
            }
        ]);

        const slippagePctg = slppageP.slippagePctg;
        const boosterConfig = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.config.json`, 'utf-8'));
        boosterConfig.slippagePctg = slippagePctg;

        writeFileSync(`./boosterwallets/${tokenAddress}.config.json`, JSON.stringify(boosterConfig, null, 2), 'utf8');
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();

    }
    else if (answers.optiontokens == 8) {
        process.exit(0)
    }
    else if (answers.optiontokens == 1) {
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));

        const balances = await Promise.all((wallets.map(async (wallet: any) => {

            return {
                walletAddress: wallet.address,
                walletBalanceInSol: Number((await connection.getBalance(new PublicKey(wallet.address)) / 1e9)).toFixed(4)
            }
        })));

        console.table(balances);
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();
    }
    else if (answers.optiontokens == 2) {
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));
        const publicKeys = wallets.map((wallet: any) => new PublicKey(wallet.address));
        const balancesList = await Promise.all(
            publicKeys.map(async (wallet: PublicKey) => {
                try {
                    const balAcnt = await connection.getTokenAccountsByOwner(wallet, {
                        mint: baseMint
                    })

                    return {
                        Address: wallet.toBase58(),
                        Amount: Number(Number(SPL_ACCOUNT_LAYOUT.decode(balAcnt.value[0].account.data).amount.toString()) / (1e6)).toFixed(2)
                    }
                } catch (error) {

                    console.log(error);
                    return {
                        Address: wallet.toBase58(),
                        Amount: 0
                    }
                }

            })
        );
        console.table(balancesList);

        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();
    }
    else if (answers.optiontokens == 6) {
        const newWallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf8'));
        let cnt = 10;
        const prewal = mainWallet
        const tnsList: Transaction[] = [];
        const wallBalance = await connection.getBalance(mainWallet.publicKey)
        const tnx: Transaction = new Transaction().add(PRIORITY_FEE_IX);
        const walletsList=[];
        

        for (var i = 0; i < newWallets.length; i++) {
            const walletAddress = newWallets[i].address;
            const wallet =Keypair.fromSecretKey(bs58.decode(newWallets[i].privateKey));
            const walletBalance :number = await connection.getBalance(wallet.publicKey);

            if(walletBalance > 0 && cnt >0){
                cnt--;
                console.log(' Transferring Sols From Zombie Wallet  ' );
                const ix = SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: prewal.publicKey,
                    lamports: walletBalance
                })
                const tnx: Transaction = new Transaction().add(PRIORITY_FEE_IX);
                const { blockhash } = await connection.getLatestBlockhash();
                tnx.feePayer = prewal.publicKey;
                tnx.recentBlockhash = blockhash;
                tnx.add(ix)
                tnx.sign(...[wallet,prewal]);

                tnsList.push(tnx);
            }  
        }
        const responses = await Promise.all(
            tnsList.map(async tnx => {
                try{
                    return await connection.sendRawTransaction(tnx.serialize(),{skipPreflight:false});
                }catch(error){
                    return null;
                }
                
            })
        );
        console.log(responses);

        
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(name, value) {
                    return value;
                }
            }
        ]);
        main0();

    }
    else if (answers.optiontokens == 5) {
        const boosterConfig = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.config.json`, 'utf-8'));
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));

        const sellAllSwapAndExecute = async () => {
            const response = await axios.get(`https://frontend-api.pump.fun/coins/${boosterConfig.tokenAddress}`).then(result => result.data).catch(error => null);

            const bondingCurve = response.bonding_curve
            const globalState = GLOBALSTATE;
            const feeRecipient = FEERCPT
            const bondingCurveAta = response.associated_bonding_curve
            const tradeList: any[] = [];
            let start :number= Number(randomSellWalletsCount);

            for (var twall in wallets) {
                const item = wallets[twall];
                
                const wallet = Keypair.fromSecretKey(bs58.decode(item.privateKey));
                const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
                let tokenBal = 0;

                const tx = new Transaction();

                const userAta = getAssociatedTokenAddressSync(baseMint, wallet.publicKey, true, TOKEN_PROGRAM_ID);

                if (tokenAccnt.length > 0 ) {
                    const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                    tokenBal = tokenBalance;
                    let trade = ''
                    if (tokenBal > 1) {
                        start = start - 1;
                        trade += ' Sell for wallet ' + wallet.publicKey.toBase58()
                        const snipeIx = await pfProgram.methods.sell(
                            new BN(tokenBalance - 1),
                            new BN(1),
                        ).accounts({
                            global: globalState,
                            feeRecipient: feeRecipient,
                            mint: baseMint,
                            bondingCurve: bondingCurve,
                            associatedBondingCurve: bondingCurveAta,
                            associatedUser: userAta,
                            user: wallet.publicKey,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            eventAuthority: EVENT_AUTH,
                            program: programID,
                        }).instruction();
                        tx.add(PRIORITY_FEE_IX);
                        tx.add(snipeIx);
                        const { blockhash } = await connection.getLatestBlockhash('confirmed');
                        tx.feePayer = wallet.publicKey;
                        tx.recentBlockhash = blockhash;
                        tx.sign(wallet);
                        tradeList.push(tx);
                        console.log(trade);
                    }
                }

            }

            const responses = await Promise.all(
                tradeList.map(async (tnx) => {

                    try {


                        // looping creates weird indexing issue with transactionMessages
                        await sendSignedTransaction({
                            signedTransaction: tnx,
                            connection,
                            skipPreflight: true,
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
                })
            );
        }


        await sellAllSwapAndExecute();
        const response: any = await prompt([
            {
                type: 'input',
                name: 'x',
                message: 'Press any Key to continue > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                }
            }
        ]);

        main0();

    }
    else if (answers.optiontokens == 7) {
        const boosterConfig = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.config.json`, 'utf-8'));
        wallets = JSON.parse(readFileSync(`./boosterwallets/${tokenAddress}.json`, 'utf-8'));


        setTimeout(() => {
            process.exit(0)
        }, Number(boosterConfig.boostTimer) * 60 * 1000)

        const generateSwapAndExecute = async () => {
            console.log(' Prepare Random Trades (in Minutes) - ' + boosterConfig.tradesPerInterval)
            const walletsRandom = getRandomWallets(wallets, boosterConfig.tradesPerInterval);
            const response = await axios.get(`https://frontend-api.pump.fun/coins/${boosterConfig.tokenAddress}`).then(result => result.data).catch(error => null);

            console.log(boosterConfig)
            console.log(response)
            
            const bondingCurve = response.bonding_curve
            const globalState = GLOBALSTATE;
            const feeRecipient = FEERCPT
            const bondingCurveAta = response.associated_bonding_curve
            const tradeList: any[] = [];

            const [bondingCurveData, mintData] = await Promise.all([
                pfProgram.account["bondingCurve"].fetch(bondingCurve),
                connection.getParsedAccountInfo(baseMint)
            ]);

            for (var twall in walletsRandom) {
                const item = walletsRandom[twall];
                const wallet = Keypair.fromSecretKey(bs58.decode(item.privateKey));
                const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
                let tokenBal = 0;
                let trade = ' Preparing '
                const tx = new Transaction();

                const decimals = 6;
                const virtualTokenReserves = (bondingCurveData.virtualTokenReserves as any).toNumber();
                const virtualSolReserves = (bondingCurveData.virtualSolReserves as any).toNumber();

                const adjustedVirtualTokenReserves = virtualTokenReserves / (10 ** decimals);
                const adjustedVirtualSolReserves = virtualSolReserves / LAMPORTS_PER_SOL;

                const tradeAmount = getRandomUniqueNumber(item.boostMinAmount, item.boostMaxAmount, 4);

                const virtualTokenPrice = Number(adjustedVirtualSolReserves / adjustedVirtualTokenReserves);
                const finalAmount = Number(tradeAmount) / Number(virtualTokenPrice);
                const minMaxAmount = Number(tradeAmount) + Number(tradeAmount) * 0.15;
                const maxSolCost = Number(minMaxAmount) + Number(minMaxAmount) * Number(boosterConfig.slippagePctg / 100);
                const userAta = getAssociatedTokenAddressSync(baseMint, wallet.publicKey, true, TOKEN_PROGRAM_ID);
                const wallBal = await connection.getBalance(wallet.publicKey);
                const walbal = Number(Number(wallBal / 1e9).toFixed(5))

                if (tokenAccnt.length > 0) {
                    const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                    tokenBal = tokenBalance;
                    if (tokenBal > 1) {
                        trade += ' Sell for wallet ' + wallet.publicKey.toBase58()
                        const snipeIx = await pfProgram.methods.sell(
                            new BN(tokenBalance),
                            new BN(walbal),
                        ).accounts({
                            global: globalState,
                            feeRecipient: feeRecipient,
                            mint: baseMint,
                            bondingCurve: bondingCurve,
                            associatedBondingCurve: bondingCurveAta,
                            associatedUser: userAta,
                            user: wallet.publicKey,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            eventAuthority: EVENT_AUTH,
                            program: programID,
                        }).instruction();
                        tx.add(PRIORITY_FEE_IX);

                        tx.add(snipeIx);
                        tx.feePayer = wallet.publicKey;
                        tradeList.push({
                            wallet: wallet,
                            transaction: tx
                        });
                    } else {
                        trade += ' Buy for wallet ' + wallet.publicKey.toBase58() + "-" + Number(finalAmount).toFixed(2) + ":" + tradeAmount;
                        const snipeIx = await pfProgram.methods.buy(
                            new BN((Number(Number(finalAmount).toFixed(2)) * (10 ** decimals))),
                            new BN(wallBal.toString()),
                        ).accounts({
                            global: globalState,
                            feeRecipient: feeRecipient,
                            mint: baseMint,
                            bondingCurve: bondingCurve,
                            associatedBondingCurve: bondingCurveAta,
                            associatedUser: userAta,
                            user: wallet.publicKey,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            eventAuthority: EVENT_AUTH,
                            program: programID,
                        }).instruction();
                        tx.add(PRIORITY_FEE_IX);

                        tx.add(snipeIx);
                        tx.feePayer = wallet.publicKey;
                        tradeList.push({
                            wallet: wallet,
                            transaction: tx
                        });
                    }
                } else {
                    trade += ' Buy for wallet ' + wallet.publicKey.toBase58() + "-" + Number(finalAmount).toFixed(2) + ":" + tradeAmount;

                    tx.add(
                        createAssociatedTokenAccountInstruction(
                            wallet.publicKey,
                            userAta,
                            wallet.publicKey,
                            baseMint,
                        )
                    )
                    const snipeIx = await pfProgram.methods.buy(
                        new BN((Number(Number(finalAmount).toFixed(2)) * (10 ** decimals))),
                        new BN(wallBal),
                    ).accounts({
                        global: globalState,
                        feeRecipient: feeRecipient,
                        mint: baseMint,
                        bondingCurve: bondingCurve,
                        associatedBondingCurve: bondingCurveAta,
                        associatedUser: userAta,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        rent: SYSVAR_RENT_PUBKEY,
                        eventAuthority: EVENT_AUTH,
                        program: programID,
                    }).instruction();
                    tx.add(PRIORITY_FEE_IX);

                    tx.add(snipeIx);
                    tx.feePayer = wallet.publicKey;

                    tradeList.push({
                        wallet: wallet,
                        transaction: tx
                    });
                }
                console.log(trade);
            }
            const blockhash = await connection.getLatestBlockhash('confirmed');

            const tnsList = await Promise.all(
                tradeList.map(async (tnx: { wallet: Keypair, transaction: Transaction }) => {
                    try {

                        const trade: Transaction = tnx.transaction;
                        trade.recentBlockhash = blockhash.blockhash
                        trade.sign(tnx.wallet);
                        return trade;
                    } catch (error) {
                        console.log(error);
                        return null;
                    }

                })
            );
            const responses = await Promise.all(
                tnsList.map(async (tnx) => {

                    try {
                        // looping creates weird indexing issue with transactionMessages
                        await sendSignedTransaction2({
                            signedTransaction: tnx,
                            connection,
                            skipPreflight: true,
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
                })
            );

        }

        if (randomTradingTimerEnabled) {
            async function runAtRandomIntervals() {
                const minSeconds = 60; // Minimum interval in seconds
                const maxSeconds = 300; // Maximum interval in seconds

                while (true) {
                    await generateSwapAndExecute();
                    const randomInterval = generateRandomInterval(minSeconds, maxSeconds);
                    await new Promise(resolve => setTimeout(resolve, randomInterval));
                }
            }


            await runAtRandomIntervals();
        } else {
            setInterval(async () => {
                await generateSwapAndExecute();

            }, boosterConfig.boostInterval * 60 * 1000)

            await generateSwapAndExecute();
        }


    }
    
}



function generateRandomInterval(minSeconds, maxSeconds) {
    const minMilliseconds = minSeconds * 1000;
    const maxMilliseconds = maxSeconds * 1000;
    return Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
}


function getRandomWallets(walletAddresses: any[], count: number) {
    const randomWallets = [];
    const shuffledAddresses = walletAddresses.sort(() => 0.5 - Math.random());
    for (let i = 0; i < count; i++) {
        randomWallets.push(shuffledAddresses[i]);
    }
    return randomWallets;
}


export default boostermain;