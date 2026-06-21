/**
 * Cache/index smoke — the backend is a derivable cache, and message text never
 * lives in it. (MASTER_SPEC §4 + non-negotiable #2.)
 *
 * Flow, all against real 0G:
 *   1. Persist a personality blob + a 2-turn conversation to 0G (authoritative).
 *   2. Reindex a fresh MemoryStore from 0G → companion + message-metadata rows.
 *   3. WIPE the cache (purgeAll) — simulate a lost/rotated backend DB.
 *   4. Reindex AGAIN from the 0G head + personality rootHash alone.
 *   5. Assert the companion, ordered message metadata, and provenance came back —
 *      AND that the secret message text ("Biscuit") appears NOWHERE in the cache.
 *
 * Run: pnpm --filter @kipr/server smoke:cache
 */
import { getChainContext, preflight } from '@kipr/og'
import {
  persistPersonality,
  defaultPersonality,
  appendMessages,
  type MemoryMessage,
  type MessageProvenance,
} from '@kipr/core'
import { MemoryStore, reindexCompanion, reindexConversation } from '../index.js'

const now = () => new Date().toISOString()
const SECRET = 'Biscuit' // a fact the user told the companion — must never land in the cache

async function main() {
  const ctx = getChainContext()
  console.log('▶ Cache smoke — preflight...')
  const pf = await preflight(ctx)
  console.log(`  wallet ${pf.address} | ${pf.balance0G} 0G`)
  if (pf.balanceWei === 0n) throw new Error('Wallet has 0 0G — fund it before this smoke.')

  const owner = ctx.address.toLowerCase()

  // 1. Authoritative state on 0G: personality + conversation.
  console.log('\n▶ Persist personality to 0G...')
  const personality = defaultPersonality(ctx.config.computeModelId ?? 'zai-org/GLM-5-FP8')
  const pRef = await persistPersonality(ctx, personality)
  console.log(`  personality root ${pRef.rootHash}  version ${pRef.version}`)

  const prov = (): MessageProvenance => ({
    modelId: ctx.config.computeModelId ?? 'zai-org/GLM-5-FP8',
    providerAddr: '0x0000000000000000000000000000000000000000',
    chatId: null,
    teeVerified: null,
    personalityVersion: pRef.version,
  })
  console.log('\n▶ Persist a 2-turn conversation to 0G...')
  const turn1: MemoryMessage[] = [
    { role: 'user', content: `My dog's name is ${SECRET}.`, createdAt: now() },
    { role: 'assistant', content: `Noted — ${SECRET} it is. 🐕`, createdAt: now(), provenance: prov() },
  ]
  const ref1 = await appendMessages(ctx, { companion: owner, head: null, messages: turn1 })
  const turn2: MemoryMessage[] = [
    { role: 'user', content: "What's my dog's name?", createdAt: now() },
    { role: 'assistant', content: `Your dog is ${SECRET}.`, createdAt: now(), provenance: prov() },
  ]
  const ref2 = await appendMessages(ctx, { companion: owner, head: ref1.head, messages: turn2 })
  const head = ref2.head
  console.log(`  conversation head ${head}`)

  // 2. Build the cache from 0G.
  const store = new MemoryStore()
  await reindexCompanion(ctx, store, owner, pRef.rootHash)
  let conv = await reindexConversation(ctx, store, owner, head)
  console.log(`\n▶ Reindexed: ${conv.snapshots} snapshots, ${conv.messages} message rows.`)

  // 3. WIPE — simulate losing the entire backend DB.
  console.log('▶ Wiping the cache (purgeAll)...')
  await store.purgeAll()
  if ((await store.getCompanion(owner)) !== null) throw new Error('Cache not actually wiped.')

  // 4. Rebuild from 0G + head + personality rootHash alone.
  console.log('▶ Rebuilding cache from 0G alone (head + personality root + key)...')
  await reindexCompanion(ctx, store, owner, pRef.rootHash)
  conv = await reindexConversation(ctx, store, owner, head)

  // 5. Assertions.
  const companion = await store.getCompanion(owner)
  const messages = await store.listMessages(owner)
  const versions = await store.listPersonalityVersions(owner)
  const roots = await store.listRoots(owner)

  console.log(`\n  companion: owner=${companion?.ownerAddr} version=${companion?.currentPersonalityVersion}`)
  console.log(`  ${messages.length} message rows, ${versions.length} version rows, ${roots.length} root rows`)
  for (const m of messages) console.log(`    [${m.role}] model=${m.modelId ?? '—'} v=${m.personalityVersion ?? '—'}`)

  if (!companion) throw new Error('Companion row not reconstructed.')
  if (companion.currentPersonalityVersion !== pRef.version)
    throw new Error('Reconstructed personality version mismatch.')
  if (messages.length !== 4) throw new Error(`Expected 4 message rows, got ${messages.length}.`)
  if (messages[0].role !== 'user' || messages[3].role !== 'assistant')
    throw new Error('Message order not preserved across reindex.')
  if (!messages[1].modelId) throw new Error('Provenance (model id) lost on reindex.')
  if (messages[1].personalityVersion !== pRef.version)
    throw new Error('Per-message personality version not preserved.')
  if (versions.length !== 1 || versions[0].versionHash !== pRef.version)
    throw new Error('Personality version row not reconstructed.')
  if (roots.length < 3) throw new Error(`Expected ≥3 root_index rows, got ${roots.length}.`)

  // THE load-bearing assertion: the secret message text is nowhere in the cache.
  const dump = JSON.stringify({ companion, messages, versions, roots })
  if (dump.includes(SECRET))
    throw new Error(`PRIVACY LEAK: secret "${SECRET}" found in the backend cache. Message content must never be stored server-side.`)

  console.log(`\n✅ CACHE SMOKE PASSED — cache fully rebuilt from 0G; message text ("${SECRET}") never touched the server.`)
}

main().catch((err) => {
  console.error('\n❌ CACHE SMOKE FAILED:', err.message ?? err)
  process.exit(1)
})
