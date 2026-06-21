/**
 * Wallet connection via the injected provider (MetaMask et al.). The private key
 * NEVER leaves the wallet — we only ever hold a signer. Ensures the wallet is on
 * 0G Galileo testnet, adding the network if the user doesn't have it yet.
 */
import { BrowserProvider, type JsonRpcSigner } from 'ethers'
import { OG_TESTNET } from './og'

export interface Connection {
  provider: BrowserProvider
  signer: JsonRpcSigner
  address: string
  chainId: number
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum
}

/** Add or switch the injected wallet to 0G Galileo testnet. */
async function ensureOgNetwork(provider: BrowserProvider): Promise<void> {
  const eth = window.ethereum
  if (!eth) throw new Error('No injected wallet found.')
  const net = await provider.getNetwork()
  if (Number(net.chainId) === OG_TESTNET.chainId) return

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: OG_TESTNET.chainIdHex }],
    })
  } catch (err) {
    // 4902 = chain not added yet → add it, then it's selected.
    const code = (err as { code?: number })?.code
    if (code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: OG_TESTNET.chainIdHex,
            chainName: OG_TESTNET.name,
            nativeCurrency: OG_TESTNET.nativeCurrency,
            rpcUrls: [OG_TESTNET.evmRpc],
            blockExplorerUrls: [OG_TESTNET.explorer],
          },
        ],
      })
    } else {
      throw err
    }
  }
}

export async function connectWallet(): Promise<Connection> {
  if (!hasInjectedWallet()) {
    throw new Error('No wallet detected. Install MetaMask (or another EVM wallet) to continue.')
  }
  const provider = new BrowserProvider(window.ethereum!)
  await provider.send('eth_requestAccounts', [])
  await ensureOgNetwork(provider)

  // Re-create the provider after a possible network switch so it sees the new chain.
  const fresh = new BrowserProvider(window.ethereum!)
  const signer = await fresh.getSigner()
  const address = await signer.getAddress()
  const chainId = Number((await fresh.getNetwork()).chainId)
  return { provider: fresh, signer, address, chainId }
}
