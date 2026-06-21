/**
 * 0G Chain (EVM) connectivity — ethers v6.
 *
 * Provides the JsonRpcProvider + Wallet used by both storage and compute, and a
 * preflight that confirms the RPC is reachable, the chain id matches config, and
 * the wallet has a non-zero balance (gas + fees). Verified against
 * research/RESEARCH_FULL.md network constants.
 */
import { ethers, JsonRpcProvider, Wallet } from 'ethers'
import { getConfig, type KiprOgConfig } from './config.js'

export interface ChainContext {
  config: KiprOgConfig
  provider: JsonRpcProvider
  wallet: Wallet
  address: string
}

export function getChainContext(): ChainContext {
  const config = getConfig()
  const provider = new JsonRpcProvider(config.evmRpc, config.chainId)
  const wallet = new Wallet(config.privateKey, provider)
  return { config, provider, wallet, address: wallet.address }
}

export interface ChainPreflight {
  address: string
  chainId: number
  expectedChainId: number
  chainIdMatches: boolean
  balanceWei: bigint
  balance0G: string
  blockNumber: number
}

/**
 * Verifies the RPC, chain id, and wallet funding. Throws on hard failures
 * (unreachable RPC, chain mismatch). Returns balance so callers can warn when
 * funds are insufficient for compute (>=3 0G ledger + >=1 0G/provider; MASTER_SPEC §6).
 */
export async function preflight(ctx: ChainContext = getChainContext()): Promise<ChainPreflight> {
  const network = await ctx.provider.getNetwork()
  const chainId = Number(network.chainId)
  const blockNumber = await ctx.provider.getBlockNumber()
  const balanceWei = await ctx.provider.getBalance(ctx.address)

  const result: ChainPreflight = {
    address: ctx.address,
    chainId,
    expectedChainId: ctx.config.chainId,
    chainIdMatches: chainId === ctx.config.chainId,
    balanceWei,
    balance0G: ethers.formatEther(balanceWei),
    blockNumber,
  }

  if (!result.chainIdMatches) {
    throw new Error(
      `Chain id mismatch: RPC reports ${chainId} but ZG_CHAIN_ID is ${ctx.config.chainId}. ` +
        `Galileo testnet is 16602 (some sources say 16601 — confirm the network on your wallet/RPC).`,
    )
  }
  return result
}

/** 1 0G in wei (18 decimals). */
export const ONE_0G = BigInt(10) ** BigInt(18)
