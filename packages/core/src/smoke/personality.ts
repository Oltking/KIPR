/**
 * P1 data-layer smoke — encrypted personality round-trip + no-silent-swap proof.
 *
 *   1. Build a personality; compute its deterministic version hash (= ERC-7857 dataHash).
 *   2. Encrypt-to-self and persist it to 0G Storage (real tx).
 *   3. Reload by root hash, decrypt, and verify it re-hashes to the SAME version.
 *   4. Prove "no silent swap": changing ONLY the pinned model id yields a different
 *      version hash — so a model change can never be invisible.
 *
 * Real data through 0G, real version hash. No mocks.
 * Run: pnpm --filter @kipr/core smoke:personality   (needs a funded testnet wallet)
 */
import { getChainContext, preflight } from '@kipr/og'
import {
  defaultPersonality,
  makePersonality,
  personalityVersion,
  personalityIntelligentData,
  persistPersonality,
  loadPersonality,
} from '../index.js'

async function main() {
  const ctx = getChainContext()
  console.log('▶ Personality smoke — preflight...')
  const pf = await preflight(ctx)
  console.log(`  wallet ${pf.address} | chainId ${pf.chainId} | ${pf.balance0G} 0G`)
  if (pf.balanceWei === 0n) throw new Error('Wallet has 0 0G — fund it before this smoke.')

  // 1. Build + hash.
  const modelId = ctx.config.computeModelId ?? 'zai-org/GLM-5-FP8'
  const personality = defaultPersonality(modelId)
  const version = personalityVersion(personality)
  const idata = personalityIntelligentData(version)
  console.log(`\n▶ Personality "${personality.name}" (model ${modelId})`)
  console.log(`  version (= ERC-7857 dataHash): ${version}`)
  console.log(`  IntelligentData: ${idata.dataDescription} / ${idata.dataHash}`)

  // 2. Encrypt-to-self + persist.
  console.log('\n▶ Encrypt-to-self + persist to 0G Storage...')
  const saved = await persistPersonality(ctx, personality)
  console.log(`  rootHash ${saved.rootHash}`)
  console.log(`  txHash   ${saved.txHash}`)
  if (saved.version !== version) throw new Error('Stored version drifted from computed version.')

  // 3. Reload + integrity-verify.
  console.log('\n▶ Reload by root hash + decrypt + verify integrity...')
  const { config, version: reloadedVersion } = await loadPersonality(
    ctx,
    saved.rootHash,
    version, // assert it matches
  )
  if (reloadedVersion !== version) throw new Error('Reloaded version mismatch.')
  if (config.name !== personality.name || config.modelId !== modelId) {
    throw new Error('Reloaded personality content mismatch.')
  }
  console.log(`  reloaded "${config.name}" → re-hashes to ${reloadedVersion} ✓`)

  // 4. No-silent-swap proof: change ONLY the model → version must change.
  console.log('\n▶ No-silent-swap check: swap model id only...')
  const swapped = makePersonality({
    name: personality.name,
    vibe: personality.vibe,
    values: personality.values,
    boundaries: personality.boundaries,
    modelId: 'some-other-model/v2',
  })
  const swappedVersion = personalityVersion(swapped)
  console.log(`  original model → ${version}`)
  console.log(`  swapped  model → ${swappedVersion}`)
  if (swappedVersion === version) {
    throw new Error('Model swap produced the SAME version — no-silent-swap guarantee broken!')
  }
  console.log('  different version ✓ — a model change cannot be silent.')

  console.log('\n✅ PERSONALITY SMOKE PASSED — encrypted round-trip + versioning proven on 0G.')
}

main().catch((err) => {
  console.error('\n❌ PERSONALITY SMOKE FAILED:', err.message ?? err)
  process.exit(1)
})
