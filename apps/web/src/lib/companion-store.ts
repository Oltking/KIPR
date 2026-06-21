/**
 * Browser-side owned persistence — the production path that makes a companion real.
 * Mirrors @kipr/core/persistence semantics, but with client-side AES-GCM (wallet-
 * signature key) instead of server ECIES:
 *
 *   persist : canonicalBytes(config) → encrypt → upload → { rootHash, version }
 *   load    : download → decrypt → parse → RE-HASH must equal the stored version
 *
 * The re-hash is the integrity check: the bytes we stored are exactly the canonical
 * bytes that produce `version`, so a reloaded config that doesn't re-hash to the
 * same version means tampering or the wrong key — we throw rather than trust it.
 */
import type { JsonRpcSigner } from 'ethers'
import {
  canonicalBytes,
  personalityVersion,
  type Bytes32,
  type PersonalityConfig,
} from '@kipr/core/personality'
import { encryptOwned, decryptOwned } from './crypto'
import { uploadBytes, downloadBytes } from './storage'

export interface PersistedPersonality {
  rootHash: string
  txHash: string
  version: Bytes32
}

/** Encrypt + write a personality to 0G. Returns its rootHash + version (ERC-7857 dataHash). */
export async function persistPersonality(
  signer: JsonRpcSigner,
  key: CryptoKey,
  config: PersonalityConfig,
): Promise<PersistedPersonality> {
  const bytes = canonicalBytes(config) // exact bytes that hash to `version`
  const encrypted = await encryptOwned(key, bytes)
  const { rootHash, txHash } = await uploadBytes(signer, encrypted)
  return { rootHash, txHash, version: personalityVersion(config) }
}

/** Download + decrypt a personality by rootHash, verifying integrity by re-hash. */
export async function loadPersonality(
  key: CryptoKey,
  rootHash: string,
  expectedVersion?: Bytes32,
): Promise<{ config: PersonalityConfig; version: Bytes32 }> {
  const encrypted = await downloadBytes(rootHash)
  const bytes = await decryptOwned(key, encrypted)
  let config: PersonalityConfig
  try {
    config = JSON.parse(new TextDecoder().decode(bytes)) as PersonalityConfig
  } catch {
    throw new Error(`Personality at ${rootHash} did not decrypt to JSON — wrong key or corrupt.`)
  }
  const version = personalityVersion(config)
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(`Integrity check failed: blob hashes to ${version}, expected ${expectedVersion}.`)
  }
  return { config, version }
}
