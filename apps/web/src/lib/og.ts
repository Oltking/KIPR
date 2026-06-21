/**
 * Public 0G network constants for the browser client (Galileo testnet).
 * No secrets here — the user's key stays in their wallet (MetaMask), never in app code.
 * Verified against research/RESEARCH_FULL.md (chainId 16602).
 */
export const OG_TESTNET = {
  chainId: 16602,
  chainIdHex: '0x40da', // 16602
  name: '0G Galileo Testnet',
  evmRpc: 'https://evmrpc-testnet.0g.ai',
  indexerRpc: 'https://indexer-storage-testnet-turbo.0g.ai',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  explorer: 'https://chainscan-galileo.0g.ai',
} as const
