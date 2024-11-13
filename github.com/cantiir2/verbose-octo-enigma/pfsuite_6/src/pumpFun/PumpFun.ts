import { AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import { mainWallet } from '../config';
import { pumpFunProgram } from './PumpFunProgram';
import { CustomWallet } from './wallet';
import { connection } from '../config/index';



class PumpFun {

    programID: PublicKey;
    provider: AnchorProvider;
    pfProgram: any;

    constructor() {
        this.programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
        this.provider = new AnchorProvider(
            connection,
            new CustomWallet(mainWallet),
            AnchorProvider.defaultOptions()
        );
        this.pfProgram = pumpFunProgram({
            provider: this.provider,
            programId: this.programID,
        });

    }


    getGlobal = async()=>{

        const global = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
        const globalVars = await this.pfProgram.account['global'].fetch(global);
        return globalVars;
    }
}

export default PumpFun;