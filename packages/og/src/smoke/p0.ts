/**
 * P0 smoke — the full phase-0 proof in one run.
 *
 *   1. Connect to 0G testnet (RPC + wallet + chain id + funding).
 *   2. 0G Storage: encrypted round-trip by root hash (bytes match).
 *   3. 0G Compute: TeeML chat completion + processResponse() == true.
 *
 * This is the MASTER_SPEC §7 P0 smoke test: real data through 0G with real
 * tx/hashes and a real TEE verification — not "it compiles". No mocks.
 *
 * Run: pnpm smoke:p0   (FUND=1 to auto-create ledger + fund provider)
 */
import { getChainContext, preflight, ONE_0G } from '../chain.js'
import { redactedConfig } from '../config.js'
import { uploadBytes, downloadBytes, peekVersion } from '../storage.js'
import { createBroker, pickTeeMLProvider, ensureInferenceFunding, chat } from '../compute.js'

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

async function main() {
  const ctx = getChainContext()
  console.log('=== KIPR P0 smoke ===')
  console.log('config:', redactedConfig(ctx.config))

  console.log('\n[1/3] Chain preflight...')
  const pf = await preflight(ctx)
  console.log(`  ${pf.address}  |  chainId ${pf.chainId}  |  ${pf.balance0G} 0G  |  block ${pf.blockNumber}`)
  if (pf.balanceWei === 0n) throw new Error('Wallet has 0 0G — fund it before P0.')

  console.log('\n[2/3] Storage encrypted round-trip...')
  const original = new TextEncoder().encode(`KIPR P0 @ ${new Date().toISOString()}`)
  const up = await uploadBytes(ctx, original, { encryptToSelf: true })
  console.log(`  uploaded → rootHash ${up.rootHash}  tx ${up.txHash}`)
  const version = await peekVersion(ctx, up.rootHash)
  if (version !== 2) throw new Error(`Expected ECIES header (2), got ${version}.`)
  const back = await downloadBytes(ctx, up.rootHash, { decrypt: true })
  if (!bytesEqual(original, back)) throw new Error('Storage round-trip mismatch.')
  console.log(`  downloaded + decrypted → bytes match ✓ (header v${version} = ECIES)`)

  console.log('\n[3/3] Compute TEE-verified inference...')
  if (pf.balanceWei < 3n * ONE_0G) {
    console.warn('  ⚠ balance < 3 0G — compute may fail to fund. See MASTER_SPEC §6.')
  }
  const broker = await createBroker(ctx)
  const service = await pickTeeMLProvider(broker, ctx.config.computeProviderAddr)
  console.log(`  provider ${service.provider}  |  model ${service.model}  |  ${service.verifiability}`)
  if (process.env.FUND === '1') await ensureInferenceFunding(broker, service.provider)
  const result = await chat(broker, service, [
    { role: 'user', content: 'Say "KIPR online" and nothing else.' },
  ])
  console.log(`  response: ${result.content}`)
  console.log(`  chatID ${result.chatID}  |  teeVerified ${result.teeVerified}`)
  if (result.teeVerified !== true) throw new Error(`TEE verification not true (${result.teeVerified}).`)

  console.log('\n✅ P0 PASSED — storage round-trip + TEE-verified inference both real and verified.')
}

main().catch((err) => {
  console.error('\n❌ P0 FAILED:', err.message ?? err)
  process.exit(1)
})
