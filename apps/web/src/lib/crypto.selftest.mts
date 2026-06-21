/**
 * Headless proof of the client-side encryption scheme (no browser/wallet needed).
 * Uses an ethers Wallet (deterministic signatures) to stand in for MetaMask.
 *
 * Proves: round-trip; determinism (re-derive on a "new device" → same key, decrypts
 * the same blob — the P4 recovery promise); and that a DIFFERENT wallet's key fails
 * loudly (AES-GCM auth), i.e. storage nodes / other users can't read it.
 *
 * Run: pnpm --filter @kipr/web selftest:crypto
 */
import { Wallet } from 'ethers'
import { deriveOwnerKey, encryptOwned, decryptOwned, keyCheckValue } from './crypto.ts'

const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])
const ok = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`❌ ${msg}`)
  console.log(`  ✓ ${msg}`)
}

async function main() {
  const wallet = Wallet.createRandom()
  const addr = wallet.address
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ secret: 'My dog is Biscuit', vibe: 'warm', n: 42 }),
  )

  console.log('▶ Derive key (device 1) + round-trip...')
  const key1 = await deriveOwnerKey(wallet, addr)
  const blob = await encryptOwned(key1, plaintext)
  const back = await decryptOwned(key1, blob)
  ok(eq(back, plaintext), 'encrypt → decrypt returns identical bytes')
  ok(!eq(blob, plaintext) && blob.length > plaintext.length, 'stored blob is ciphertext, not plaintext')

  console.log('\n▶ Recovery: re-derive on a "fresh device" (same wallet, same message)...')
  const key2 = await deriveOwnerKey(wallet, addr)
  const kcv1 = await keyCheckValue(key1)
  const kcv2 = await keyCheckValue(key2)
  ok(kcv1 === kcv2, `re-derived key matches (kcv ${kcv1}) — deterministic`)
  const recovered = await decryptOwned(key2, blob)
  ok(eq(recovered, plaintext), 'fresh-device key decrypts the original blob (recover with key alone)')

  console.log('\n▶ Isolation: a different wallet cannot read it...')
  const stranger = await deriveOwnerKey(Wallet.createRandom(), Wallet.createRandom().address)
  ok((await keyCheckValue(stranger)) !== kcv1, "stranger's key has a different fingerprint")
  let threw = false
  try {
    await decryptOwned(stranger, blob)
  } catch {
    threw = true
  }
  ok(threw, 'wrong key fails loudly on decrypt (GCM auth) — no silent ciphertext')

  console.log('\n▶ Tamper detection...')
  const tampered = blob.slice()
  tampered[tampered.length - 1] ^= 0xff
  let tamperThrew = false
  try {
    await decryptOwned(key1, tampered)
  } catch {
    tamperThrew = true
  }
  ok(tamperThrew, 'flipping one ciphertext byte is rejected')

  console.log('\n✅ CRYPTO SELFTEST PASSED — wallet-signature-derived AES-256-GCM is sound.')
}

main().catch((e) => {
  console.error('\n❌ CRYPTO SELFTEST FAILED:', e.message ?? e)
  process.exit(1)
})
