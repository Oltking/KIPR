/**
 * P2 memory smoke — owned, encrypted conversation recovered from 0G alone.
 *
 * Simulates a real two-turn conversation, persisted to 0G as an encrypted snapshot
 * chain. Then throws away EVERYTHING except the head rootHash + the wallet key
 * (a "fresh client") and reconstructs the whole conversation — proving the message
 * content lives with the user on 0G, not in any server, and that provenance + a
 * remembered fact survive the round-trip.
 *
 * Real data through 0G. No mocks. Run: pnpm --filter @kipr/core smoke:memory
 */
import { getChainContext, preflight } from '@kipr/og'
import {
  appendMessages,
  loadConversation,
  loadHistory,
  type MemoryMessage,
  type MessageProvenance,
} from '../index.js'

const now = () => new Date().toISOString()

async function main() {
  const ctx = getChainContext()
  console.log('▶ Memory smoke — preflight...')
  const pf = await preflight(ctx)
  console.log(`  wallet ${pf.address} | ${pf.balance0G} 0G`)
  if (pf.balanceWei === 0n) throw new Error('Wallet has 0 0G — fund it before this smoke.')

  const companion = ctx.address.toLowerCase()
  const prov = (): MessageProvenance => ({
    modelId: ctx.config.computeModelId ?? 'zai-org/GLM-5-FP8',
    providerAddr: '0x0000000000000000000000000000000000000000', // real provider filled in P2 compute wiring
    chatId: null,
    teeVerified: null,
    personalityVersion: '0x1446e563e7ccc9bc851edb7f5cb4a6ef37bc25cf13c5ce15f0eacb6fb9cdd042',
  })

  // Turn 1 — user tells the companion something to remember.
  console.log('\n▶ Turn 1: append user + assistant (flush 1)...')
  const turn1: MemoryMessage[] = [
    { role: 'user', content: "My dog's name is Biscuit.", createdAt: now() },
    { role: 'assistant', content: 'Noted — Biscuit it is. 🐕', createdAt: now(), provenance: prov() },
  ]
  const ref1 = await appendMessages(ctx, { companion, head: null, messages: turn1 })
  console.log(`  head1 ${ref1.head}  (tx ${ref1.txHash})`)

  // Turn 2 — chained onto head1.
  console.log('\n▶ Turn 2: append user + assistant (flush 2, prev=head1)...')
  const turn2: MemoryMessage[] = [
    { role: 'user', content: "What's my dog's name?", createdAt: now() },
    { role: 'assistant', content: 'Your dog is Biscuit.', createdAt: now(), provenance: prov() },
  ]
  const ref2 = await appendMessages(ctx, { companion, head: ref1.head, messages: turn2 })
  console.log(`  head2 ${ref2.head}  (tx ${ref2.txHash})`)

  // FRESH CLIENT: keep only head2 + the key. Reconstruct from 0G.
  const head = ref2.head
  console.log('\n▶ Fresh client — discard local state, reload from head2 + key alone...')
  const history = await loadHistory(ctx, head)
  const messages = await loadConversation(ctx, head)
  console.log(`  chain length: ${history.length} snapshots (genesis-first)`)
  console.log(`  reconstructed ${messages.length} messages:`)
  for (const m of messages) {
    const tag = m.provenance ? ` [model ${m.provenance.modelId}]` : ''
    console.log(`    ${m.role}: ${m.content}${tag}`)
  }

  // Assertions: order, count, the remembered fact, and provenance survived.
  if (messages.length !== 4) throw new Error(`Expected 4 messages, got ${messages.length}.`)
  if (messages[0].content !== turn1[0].content) throw new Error('Message order/content not preserved.')
  if (!messages.some((m) => m.content.includes('Biscuit') && m.role === 'assistant'))
    throw new Error('Remembered fact (Biscuit) did not survive reconstruction.')
  if (!messages[1].provenance?.modelId) throw new Error('Provenance lost on reconstruction.')

  console.log('\n✅ MEMORY SMOKE PASSED — conversation rebuilt from 0G + key alone; it still remembers.')
}

main().catch((err) => {
  console.error('\n❌ MEMORY SMOKE FAILED:', err.message ?? err)
  process.exit(1)
})
