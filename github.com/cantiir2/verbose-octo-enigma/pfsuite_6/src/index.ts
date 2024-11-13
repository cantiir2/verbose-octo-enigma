import chalk, { blue } from "chalk";
import { say } from "cfonts";
import { prompt } from 'enquirer';
import { readFileSync, writeFileSync } from "fs";
import { logger } from "./services/logger";
import { Keypair, PublicKey, Transaction, SystemProgram, PublicKeyInitData, TransactionInstruction } from "@solana/web3.js";
import { createTokenMeta } from "./services/createTokenMeta";
import { CONFIRMATIONTIMEOUT, connection, EVENT_AUTH, FEERCPT, GLOBALSTATE,   PRIORITY_FEE_IX, programID, randomSellWalletsCount, senderWallet, slippageDefault } from "./config";
import { TokenData } from "./config/types";
import { InitiaLizeAlts } from "./services/initializeAta";
import { LaunchBundler } from "./services/launchBundler";
import { TransferSols } from "./services/transferSols";
import { SPL_ACCOUNT_LAYOUT, TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { RecoverSols } from "./services/recoverSols";
import { sendSignedTransaction, sleep } from "./utils/functions";
import bs58 from "bs58";
import axios from 'axios'
import { getWalletTokenAccount } from "./utils/utils";
import BN from "bn.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { CustomWallet } from "./pumpFun/wallet";
import { pumpFunProgram } from "./pumpFun/PumpFunProgram";
import RaydiumDump from "./services/RaydiumDump";
import boostermain from "./booster/booster";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { mainWallet } from './config/index';
import base58 from "bs58";
 

console.clear();

logger.sponsor('RPC Url In Configuration :' + process.env.RPC_URL)
logger.sponsor('Network Configuration :' + process.env.NETWORK)
logger.sponsor('Has Valid Private Key   ')
logger.sponsor('Deployer Address is   ' + mainWallet.publicKey.toBase58())
logger.sponsor('Funding Address is   ' + senderWallet.publicKey.toBase58())

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
console.log(
    chalk.cyanBright(
        "\n🤟🏻 PFSuite is a complete suite of Tools for PumpFun."
    )
);
console.log(
    chalk.cyanBright(
        `👉🏻 For Optimum Bundling and effective transaction submission ${chalk.greenBright(
            "Use higher priority fees of 0.003\n"
        )} `
    )
);

let tokenAddress = undefined;
let baseMint: any;
let wallets = [];
let slippage = slippageDefault;
let provider = new AnchorProvider(connection, new CustomWallet(mainWallet), AnchorProvider.defaultOptions())

let pfProgram = pumpFunProgram({
    provider: provider,
    programId: programID,
});


const startMainMenu = async (t: any | {
    tokenInfo: TokenData; wallets: any[];
} | undefined, status: boolean) => {

    const questions = [{
        type: 'select',
        name: 'option',
        message: `PF Suite Operations -- ${t ? t.tokenInfo.tokenAddress : ''}`,
        initial: 0,
        choices: [
            { name: ' > Create', message: '1. Load Token Meta >', value: 1, disabled: (t && t.tokenInfo) ? true : false },
            { name: ' > Initialize', message: '2. Initialize LookupTables >', value: 2, disabled: (t && t.tokenInfo && !t.tokenInfo.lookupTableAddress) ? false : true },
            { name: ' > TransferSols', message: '3. Transfer Trading Amount (Sol) to All Wallets >', value: 3 },
            { name: ' > Launcher', message: '4. Intiate Launcher >', value: 4 },
            { name: ' > Autom8r', message: '5. Manage Pos8Launch >', value: 5 },
            { name: ' > Boos8r', message: '6. Run PFBooster >', value: 6 },
            { name: ' > Exit', message: '7. Exit >', value: 7 },
        ]
    }];
    const answers: any = await prompt(questions);

    if (answers.option == ' > Create') {
        const tt = await createTokenMeta();

        if (tt && tt.tokenInfo.tokenAddress) {
            startMainMenu(tt, false);

        } else {
            startMainMenu(undefined, true);
        }
    }

    if (answers.option == ' > Initialize') {

        const allAddresses = [];
        allAddresses.push(new PublicKey(t.tokenInfo.tokenAddress));
        allAddresses.push(new PublicKey(t.tokenInfo.mintAuthority));
        allAddresses.push(new PublicKey(t.tokenInfo.bondingCurve));
        allAddresses.push(new PublicKey(t.tokenInfo.associatedBondingCurce));
        allAddresses.push(new PublicKey(t.tokenInfo.eventAuthority));
        allAddresses.push(GLOBALSTATE);
        allAddresses.push(FEERCPT);
        allAddresses.push(programID);

        const lookupTableAddress = await InitiaLizeAlts(new PublicKey(t.tokenInfo.tokenAddress), allAddresses, mainWallet, connection);

        logger.info('Lookup Created ' + lookupTableAddress);
        t.tokenInfo.lookupTableAddress = lookupTableAddress.toBase58();
        writeFileSync(`./wallets/${t.tokenInfo.tokenAddress}.config.json`, JSON.stringify(t, null, 2), 'utf8');
        startMainMenu(t, false);
    }
    if (answers.option == ' > TransferSols') {

        const tnxIds = await TransferSols(new PublicKey(t.tokenInfo.tokenAddress), senderWallet, connection, t.tokenInfo);

        await sleep(CONFIRMATIONTIMEOUT / 3);
        startMainMenu(t, false);

    }
    if (answers.option == ' > Launcher') {
        wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));

        const txIds = await LaunchBundler(senderWallet, mainWallet, wallets, t.tokenInfo);

        await sleep(CONFIRMATIONTIMEOUT / 3);

        startMainMenu(t, false);

    }
    if (answers.option == ' > Autom8r') {

        await showAutom8r(t);
    }

    if (answers.option == ' > Boos8r') {

        await boostermain(t.tokenInfo.tokenAddress);
    }
    if (answers.option == ' > Exit') {

        process.exit(0)
    }

}
 
startMainMenu(undefined, true)


async function showAutom8r(t: { tokenInfo: TokenData; wallets: any[]; }) {


    wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));

    const walletCount = wallets.length;
    const questions = [{
        type: 'select',
        name: 'optionstats',
        message: 'Select Operation to Perform?',
        initial: 1,
        choices: [
            { name: 1, message: 'Show Wallets Stats >', value: 1 },
            { name: 2, message: 'Select Wallet To Sell >', value: 2 },
            { name: 3, message: 'Set Slippage (Default: 5 %) >', value: 3 },
            { name: 4, message: `Quick Sell All Wallets >`, value: 4 },
            { name: 41, message: `Transfer All Wallet Tokens to main >`, value: 41 },
            { name: 42, message: `Sell Main wallet >`, value: 42 },
            { name: 5, message: `Dump on Raydium Launch >`, value: 5 },
            { name: 6, message: 'Recover all Sol balances from Wallets to Main Wallet >', value: 6 },
            { name: 7, message: 'Quit >', value: 7 },
            { name: 8, message: 'Main Menu >', value: 8 }
        ]
    }];

    const answers: any = await prompt(questions);

    if (answers.optionstats == 1) {
        wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));

        const balances = await Promise.all((wallets.map(async (wallet: any) => {

            return {
                walletAddress: wallet.address,
                walletBalanceInSol: Number((await connection.getBalance(new PublicKey(wallet.address)) / 1e9)).toFixed(4)
            };
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

        showAutom8r(t);

    }
    if (answers.optionstats == 2) {
        wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));

        const publicKeys = wallets.map((wallet: any) => new PublicKey(wallet.address));
        const balancesList = await Promise.all(
            publicKeys.map(async (wallet: PublicKey) => {
                try {
                    const balAcnt = await connection.getTokenAccountsByOwner(wallet, {
                        mint: new PublicKey(t.tokenInfo.tokenAddress)
                    })

                    return {
                        Address: wallet.toBase58(),
                        Amount: Number(Number(SPL_ACCOUNT_LAYOUT.decode(balAcnt.value[0].account.data).amount.toString()) / (1e6)).toFixed(2)
                    }
                } catch (error) {

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
                message: 'Select x to Continue or Paste the Address from above List to Sell Tokens From > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                },
                validate(value) {
                    try {
                        if (value == 'x' || value == 'X') return true;
                        else {
                            const val = new PublicKey(value);
                            return true;
                        }
                    } catch (error) {
                        return false
                    }
                }
            }
        ]);

        if (response.x == 'x' || response.x == 'X') {
            showAutom8r(t)
        } else {
            const baseMint = new PublicKey(t.tokenInfo.tokenAddress);
            wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));


            const sellAllSwapAndExecute = async () => {

                const bondingCurve = t.tokenInfo.bondingCurve
                const globalState = GLOBALSTATE;
                const feeRecipient = FEERCPT
                const bondingCurveAta = t.tokenInfo.associatedBondingCurce
                const tradeList: any[] = [];

                console.log('Finding the Matching Wallet')
                const item = wallets.filter((n) => n.address == response.x)[0]


                const wallet = Keypair.fromSecretKey(bs58.decode(item.privateKey));
                const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
                let tokenBal = 0;

                const tx = new Transaction().add(PRIORITY_FEE_IX);

                const userAta = new PublicKey(item.walletAta)


                if (tokenAccnt.length > 0) {
                    const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                    tokenBal = tokenBalance;
                    let trade = ''
                    if (tokenBal > 1) {
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

                        tx.add(snipeIx);
                        const { blockhash } = await connection.getLatestBlockhash();
                        tx.feePayer = wallet.publicKey;
                        tx.recentBlockhash = blockhash;
                        tx.sign(wallet);
                        tradeList.push({ transaction: tx, address: wallet.publicKey.toBase58() });

                    }
                }



                const responses = await Promise.all(
                    tradeList.map(async (tnx) => {

                        console.log('Running for Wallet ' + tnx.address);
                        try {


                            // looping creates weird indexing issue with transactionMessages
                            await sendSignedTransaction({
                                signedTransaction: tnx.transaction,
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
                                    showAutom8r(t)
                                },
                            });
                        } catch (error) {
                            console.log(new String(error))
                            return null;
                        }
                    })
                );

                console.log('Completed Trade ')


                await showAutom8r(t);
            }

            await sellAllSwapAndExecute();

        }

    }
    if (answers.optionstats == 3) {
        const response: any = await prompt([
            {
                type: 'input',
                name: 'slip',
                message: 'Enter Slippage %ge to use for Transactions > ',
                async onSubmit(_name: any, value: any) {
                    return value;
                },
                validate(value) {
                    try {
                        if (Number(value) > 0 && Number(value) < 50) return true;
                        console.log('Slippage Cannot Exceed 50');
                        return false;
                    } catch (error) {
                        return false
                    }
                }
            }
        ]);

        slippage = Number(response.slip);

        showAutom8r(t)
    }
    if (answers.optionstats == 4) {

        const baseMint = new PublicKey(t.tokenInfo.tokenAddress);
        wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));
        const tradeList: any[] = [];

        const sellAllSwapAndExecute = async (item: { privateKey: string; walletAta: PublicKey; }) => {

            const bondingCurve = t.tokenInfo.bondingCurve
            const globalState = GLOBALSTATE;
            const feeRecipient = FEERCPT
            const bondingCurveAta = t.tokenInfo.associatedBondingCurce
            let start: number = Number(randomSellWalletsCount);

            const wallet = Keypair.fromSecretKey(bs58.decode(item.privateKey));
            const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
            let tokenBal = 0;

            const tx = new Transaction().add(PRIORITY_FEE_IX);

            const userAta = new PublicKey(item.walletAta)

            if (tokenAccnt.length > 0) {
                const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                tokenBal = tokenBalance;
                let trade = ''
                if (tokenBal > 1) {
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

                    tx.add(snipeIx);
                    const { blockhash } = await connection.getLatestBlockhash();
                    tx.feePayer = wallet.publicKey;
                    tx.recentBlockhash = blockhash;
                    tx.sign(wallet);
                    tradeList.push({ transaction: tx, address: wallet.publicKey.toBase58() }); 
                }
            }


        }
        for (var i = 0; i < wallets.length; i++) {
            let item = wallets[i]
            await sellAllSwapAndExecute(item);
        }


        if (tradeList.length > 0) {
            tradeList.map(async (tnx) => {

                console.log('Running for Wallet ' + tnx.address);
                try {

                    await sleep(1500);
                    // looping creates weird indexing issue with transactionMessages
                    await sendSignedTransaction({
                        signedTransaction: tnx.transaction,
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
            })

        }


    }
    if (answers.optionstats == 41) {
        const baseMint = new PublicKey(t.tokenInfo.tokenAddress);

        const mainWalletAta = await getAssociatedTokenAddress(baseMint,mainWallet.publicKey)
        wallets = JSON.parse(readFileSync(`./wallets/${t.tokenInfo.tokenAddress}.wallets.json`, 'utf-8'));
        const tradeList: any[] = [];
        const instructions: TransactionInstruction[] = [];
        
        for(var i =0;i< wallets.length;i++){
            const walletAtaPub = new PublicKey(wallets[i].walletAta)
            const wallet = Keypair.fromSecretKey(base58.decode(wallets[i].privateKey))

            const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
            const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));

            console.log('Creating Transfer TO Main Instrunction for Wallet '+ wallet.publicKey.toBase58())
            const inst = createTransferInstruction(
                walletAtaPub,
                mainWalletAta,
                wallet.publicKey,
                tokenBalance 
            );

            const transaction = new Transaction().add(PRIORITY_FEE_IX)
            .add(inst);
            const signature = await connection.sendTransaction(transaction, [wallet]);
            console.log("Transaction signature: ", signature);
    
            // Optionally, wait for confirmation before proceeding with the next chunk
            await connection.confirmTransaction(signature, 'confirmed'); 

        } 

    }
    if (answers.optionstats == 42) {

        const baseMint = new PublicKey(t.tokenInfo.tokenAddress);
        const tradeList: any[] = [];

        const sellAllSwapAndExecute = async (item: { privateKey: string; walletAta: PublicKey; }) => {

            const bondingCurve = t.tokenInfo.bondingCurve
            const globalState = GLOBALSTATE;
            const feeRecipient = FEERCPT
            const bondingCurveAta = t.tokenInfo.associatedBondingCurce
            let start: number = Number(randomSellWalletsCount);

            const wallet = Keypair.fromSecretKey(bs58.decode(item.privateKey));
            const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
            let tokenBal = 0;

            const tx = new Transaction().add(PRIORITY_FEE_IX);

            const userAta = new PublicKey(item.walletAta)

            if (tokenAccnt.length > 0) {
                const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                tokenBal = tokenBalance;
                let trade = ''
                if (tokenBal > 1) {
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

                    tx.add(snipeIx);
                    const { blockhash } = await connection.getLatestBlockhash();
                    tx.feePayer = wallet.publicKey;
                    tx.recentBlockhash = blockhash;
                    tx.sign(wallet);
                    tradeList.push({ transaction: tx, address: wallet.publicKey.toBase58() }); 
                }
            }


        }
         
        const walletAta = await getAssociatedTokenAddress(baseMint,mainWallet.publicKey);

        const item = {
            privateKey: base58.encode(mainWallet.secretKey),
            walletAta: walletAta
        }
          await sellAllSwapAndExecute(item); 

        if (tradeList.length > 0) {
            tradeList.map(async (tnx) => {

                console.log('Running for Wallet ' + tnx.address);
                try {

                    // looping creates weird indexing issue with transactionMessages
                    await sendSignedTransaction({
                        signedTransaction: tnx.transaction,
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
                 }
            })

        }
        showAutom8r(t);

    }
    if (answers.optionstats == 5) {
        await RaydiumDump(t.tokenInfo.tokenAddress);
    }
    if (answers.optionstats == 6) {

        const tnxIds = await RecoverSols(new PublicKey(t.tokenInfo.tokenAddress), senderWallet, connection, t.tokenInfo);

        console.log(tnxIds);

        showAutom8r(t);
    }
    if (answers.optionstats == 7) {
        process.exit(0);
    }
    if (answers.optionstats == 8) {
        startMainMenu(t, false);
    }
}

