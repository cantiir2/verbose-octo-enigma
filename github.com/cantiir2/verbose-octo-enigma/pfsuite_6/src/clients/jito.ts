
import { SearcherClient, searcherClient as jitoSearcherClient, } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

const BLOCK_ENGINE_URLS =
  [
    "amsterdam.mainnet.block-engine.jito.wtf",
    "frankfurt.mainnet.block-engine.jito.wtf",
    "tokyo.mainnet.block-engine.jito.wtf",
  ];


//const decodedKey = new Uint8Array([170, 102, 199, 216, 226, 201, 23, 43, 26, 120, 207, 73, 110, 164, 116, 178, 255, 140, 255, 218, 189, 56, 60, 156, 217, 54, 187, 126, 163, 9, 162, 105, 7, 82, 19, 78, 31, 45, 211, 21, 169, 244, 1, 88, 110, 145, 211, 13, 133, 99, 16, 32, 105, 253, 55, 213, 94, 124, 237, 195, 235, 255, 7, 72]);
const keyPair = Keypair.fromSecretKey(bs58.decode('jZA1PGf37fo5QYHUDo23Men3hygC78vpPZJyhC4FCZ8ZctJWvPYS73S2QYUo7Kbfgwef73q3HBbc2VvxDpkyi4c'));
const searcherClients: SearcherClient[] = [];

for (const url of BLOCK_ENGINE_URLS) {
  const client = jitoSearcherClient(url, keyPair, {
    'grpc.keepalive_timeout_ms': 30000,
  });
  searcherClients.push(client);
}


// all bundles sent get automatically forwarded to the other regions.
// assuming the first block engine in the array is the closest one
const searcherClient = searcherClients[0];

export { searcherClient, searcherClients };