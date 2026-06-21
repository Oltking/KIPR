/**
 * P0 smoke — 0G Compute Direct, TEE-verified inference.
 *
 * Proves KIPR's privacy core: a chat completion runs on a TeeML provider and
 * processResponse() returns true — i.e. the response is cryptographically proven
 * to come from the genuine model in the TEE. Prints provider/model/chatID/teeVerified.
 *
 * Run: pnpm smoke:compute   (needs a FUNDED wallet: >=3 0G ledger + >=1 0G/provider — MASTER_SPEC §6)
 *
 * Set FUND=1 to let this script create the ledger and fund the provider sub-account
 * (spends real testnet 0G). Without FUND=1 it assumes funding already exists.
 */
import { getChainContext, preflight, ONE_0G } from '../chain.js'
import { createBroker, pickTeeMLProvider, ensureInferenceFunding, chat } from '../compute.js'

async function main() {
  const ctx = getChainContext()
  console.log('▶ 0G Compute smoke — network/wallet preflight...')
  const pf = await preflight(ctx)
  console.log(`  wallet:  ${pf.address}`)
  console.log(`  balance: ${pf.balance0G} 0G   block: ${pf.blockNumber}`)
  if (pf.balanceWei < 3n * ONE_0G) {
    console.warn(
      `  ⚠ balance < 3 0G — Compute Direct needs >=3 0G to open a ledger + >=1 0G/provider. ` +
        `Faucet caps at 0.1 0G/day; request testnet tokens from the 0G team (MASTER_SPEC §6).`,
    )
  }

  console.log('\n▶ Creating compute broker...')
  const broker = await createBroker(ctx)

  console.log('▶ Discovering TeeML (verifiable) providers...')
  const service = await pickTeeMLProvider(broker, ctx.config.computeProviderAddr)
  console.log(`  provider:      ${service.provider}`)
  console.log(`  model:         ${service.model}`)
  console.log(`  serviceType:   ${service.serviceType}`)
  console.log(`  verifiability: ${service.verifiability}`)
  console.log(`  teeSigner:     ${service.teeSignerAddress} (ack: ${service.teeSignerAcknowledged})`)

  if (process.env.FUND === '1') {
    console.log('\n▶ FUND=1 — ensuring ledger + provider funding (spends real 0G)...')
    await ensureInferenceFunding(broker, service.provider)
  }

  console.log('\n▶ Sending TEE-verified chat completion...')
  const result = await chat(broker, service, [
    { role: 'user', content: 'In one short sentence, what makes a companion truly private?' },
  ])

  console.log(`\n  response:    ${result.content}`)
  console.log(`  provider:    ${result.provider}`)
  console.log(`  model:       ${result.model}`)
  console.log(`  chatID:      ${result.chatID}`)
  console.log(`  teeVerified: ${result.teeVerified}`)

  if (result.teeVerified !== true) {
    throw new Error(
      `TEE verification did not return true (got ${result.teeVerified}). ` +
        `KIPR requires a verified TeeML response on production paths.`,
    )
  }
  console.log('\n✅ COMPUTE SMOKE PASSED — TEE-verified inference confirmed.')
}

main().catch((err) => {
  console.error('\n❌ COMPUTE SMOKE FAILED:', err.message ?? err)
  process.exit(1)
})
