import { getChainContext, preflight } from '../chain.js'
import { redactedConfig } from '../config.js'
const ctx = getChainContext()
console.log('config:', redactedConfig(ctx.config))
const pf = await preflight(ctx)
console.log(`address ${pf.address} | chainId ${pf.chainId} (match: ${pf.chainIdMatches}) | balance ${pf.balance0G} 0G | block ${pf.blockNumber}`)
