import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { pumpFunProgram } from "../pumpFun/PumpFunProgram";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
 import { CustomWallet } from "../pumpFun/wallet";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createUpdateAuthorityInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection } from "../config";



class PumpeCutor {

    programID: PublicKey;
    provider: AnchorProvider;
    pfProgram: any;

    constructor(
        private readonly mint: PublicKey,
        private readonly globalPublicKey: PublicKey,
        private readonly feeRecipient: PublicKey,
        private readonly bondingCurve: PublicKey,
        private readonly associatedBondingCurve: PublicKey,
        private readonly wallet: Keypair
    ) {
        this.programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
        this.provider = new AnchorProvider(
            connection,
            new CustomWallet(wallet),
            AnchorProvider.defaultOptions()
        );
        this.pfProgram = pumpFunProgram({
            provider: this.provider,
            programId: this.programID,
        });

    }


    createBuyTransaction = async (tokenAmountOut: BN, solAmountIn: BN, priorityFees:number) => {

        console.log(' Creating Token Buy Transaction for '+this.wallet.publicKey.toBase58());
        const associatedAddress = await getAssociatedTokenAddress(this.mint, this.wallet.publicKey, true);
        const keys = [
            { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: associatedAddress, isSigner: false, isWritable: true },
            { pubkey: this.wallet.publicKey, isSigner: false, isWritable: false },
            { pubkey: this.mint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, "isSigner": false, "isWritable": false },
            { pubkey: TOKEN_PROGRAM_ID, "isSigner": false, "isWritable": false },
        ];
        const tnxs = new TransactionInstruction({
            keys,
            programId: ASSOCIATED_TOKEN_PROGRAM_ID,
            data: Buffer.from([0x1]),
        });
        const buyTnx: TransactionInstruction[] = [];

        const ataInst = createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            associatedAddress,
            this.wallet.publicKey,
            this.mint,
        )
         const buytnx = await this.pfProgram.methods.buy(tokenAmountOut, solAmountIn).accounts({
            global: this.globalPublicKey,
            feeRecipient: this.feeRecipient,
            mint: this.mint,
            bondingCurve: this.bondingCurve,
            associatedBondingCurve: this.associatedBondingCurve,
            associatedUser: associatedAddress
        }).instruction()
        
        buyTnx.push(ataInst);
        buyTnx.push(buytnx);
        return buyTnx;

    }





}


export default PumpeCutor;