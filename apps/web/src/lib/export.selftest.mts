/**
 * Headless proof of export integrity (no network/wallet). Verifies parseExport
 * accepts a sound bundle and REJECTS a tampered one — the guarantee that a restored
 * companion is really the one you exported.
 *
 * Run: pnpm --filter @kipr/web selftest:export
 */
import { makePersonality, personalityVersion } from '@kipr/core/personality'
import { parseExport, type KiprExport } from './export.ts'

const ok = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`❌ ${msg}`)
  console.log(`  ✓ ${msg}`)
}

function main() {
  const personality = makePersonality({
    name: 'Biscuit',
    vibe: 'warm',
    values: ['truth'],
    boundaries: ['flatter'],
    modelId: 'zai-org/GLM-5-FP8',
  })
  const version = personalityVersion(personality)
  const bundle: KiprExport = {
    format: 'kipr.export',
    version: 1,
    exportedAt: new Date().toISOString(),
    owner: '0xabc',
    companion: { name: 'Biscuit', personalityVersion: version, personalityRootHash: '0xroot', conversationHead: null },
    personality,
    conversation: [{ role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
  }

  console.log('▶ Sound bundle round-trips...')
  const parsed = parseExport(JSON.stringify(bundle))
  ok(parsed.companion.personalityVersion === version, 'valid export parses + integrity holds')

  console.log('\n▶ Tampered personality is rejected...')
  const tampered = JSON.parse(JSON.stringify(bundle)) as KiprExport
  tampered.personality.name = 'NotBiscuit' // change content but keep the claimed version
  let threw = false
  try {
    parseExport(JSON.stringify(tampered))
  } catch {
    threw = true
  }
  ok(threw, 'edited personality fails the re-hash integrity check')

  console.log('\n▶ Garbage is rejected...')
  let threw2 = false
  try {
    parseExport('{"format":"nope"}')
  } catch {
    threw2 = true
  }
  ok(threw2, 'non-KIPR file is rejected')

  console.log('\n✅ EXPORT SELFTEST PASSED — restore trusts only an intact bundle.')
}

try {
  main()
} catch (e) {
  console.error('\n❌ EXPORT SELFTEST FAILED:', (e as Error).message)
  process.exit(1)
}
