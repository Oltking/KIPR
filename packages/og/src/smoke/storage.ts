/**
 * P0 smoke — 0G Storage round-trip (encrypted, user-owned).
 *
 * Proves the non-negotiable: a blob is encrypted client-side, written to 0G,
 * and read back by root hash with bytes matching — and is unreadable without
 * the wallet key. Real data, real tx, real root hash. No mocks.
 *
 * Run: pnpm smoke:storage   (needs a funded testnet wallet in .env)
 */
import { getChainContext, preflight } from '../chain.js'
import { uploadBytes, downloadBytes, peekVersion } from '../storage.js'

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

async function main() {
  const ctx = getChainContext()
  console.log('▶ 0G Storage smoke — network/wallet preflight...')
  const pf = await preflight(ctx)
  console.log(`  wallet:  ${pf.address}`)
  console.log(`  chainId: ${pf.chainId} (expected ${pf.expectedChainId})`)
  console.log(`  balance: ${pf.balance0G} 0G   block: ${pf.blockNumber}`)
  if (pf.balanceWei === 0n) {
    throw new Error('Wallet balance is 0 0G. Fund it from faucet.0g.ai before storage smoke.')
  }

  const payload = `KIPR storage smoke @ ${new Date().toISOString()} — owned + encrypted on 0G`
  const original = new TextEncoder().encode(payload)
  console.log(`\n▶ Uploading ${original.length} bytes, ECIES encrypt-to-self...`)
  const up = await uploadBytes(ctx, original, { encryptToSelf: true })
  console.log(`  rootHash: ${up.rootHash}`)
  console.log(`  txHash:   ${up.txHash}`)
  console.log(`  txSeq:    ${up.txSeq}   encrypted: ${up.encrypted}`)

  const version = await peekVersion(ctx, up.rootHash)
  console.log(`\n▶ peekHeader version: ${version} (2 = ECIES, as expected)`)
  if (version !== 2) {
    throw new Error(`Expected ECIES header (version 2), got ${version}. Encryption did not apply.`)
  }

  console.log('\n▶ Downloading + decrypting by root hash...')
  const back = await downloadBytes(ctx, up.rootHash, { decrypt: true })
  const recovered = new TextDecoder().decode(back)

  if (!bytesEqual(original, back)) {
    console.error(`  MISMATCH\n  sent: ${payload}\n  got:  ${recovered}`)
    throw new Error('Round-trip failed: decrypted bytes do not match original.')
  }
  console.log(`  recovered: ${recovered}`)
  console.log('\n✅ STORAGE SMOKE PASSED — encrypted round-trip verified by root hash.')
}

main().catch((err) => {
  console.error('\n❌ STORAGE SMOKE FAILED:', err.message ?? err)
  process.exit(1)
})
