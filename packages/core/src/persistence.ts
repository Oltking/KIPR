/**
 * Encrypted personality persistence on 0G Storage.
 *
 * Built on the proven @kipr/og storage layer (ECIES encrypt-to-self): the
 * personality blob is encrypted client-side with the wallet key before it leaves
 * the machine, so storage nodes never see plaintext (non-negotiable #3). We store
 * the *canonical* bytes, so a reload re-hashes to the identical version — and we
 * assert that on load, refusing a blob whose content doesn't match its claimed
 * version (tamper/corruption guard; recall that the SDK returns ciphertext, not an
 * error, on a wrong key).
 */
import { uploadBytes, downloadBytes, type ChainContext } from '@kipr/og'
import {
  canonicalBytes,
  personalityVersion,
  type Bytes32,
  type PersonalityConfig,
} from './personality.js'

export interface PersistedPersonality {
  /** 0G Storage Merkle root of the encrypted blob. */
  rootHash: string
  /** On-chain storage tx hash. */
  txHash: string
  /** keccak version hash of the stored config (== ERC-7857 dataHash). */
  version: Bytes32
}

/** Encrypt-to-self and write a personality config to 0G Storage. */
export async function persistPersonality(
  ctx: ChainContext,
  config: PersonalityConfig,
): Promise<PersistedPersonality> {
  const version = personalityVersion(config)
  const bytes = canonicalBytes(config)
  const up = await uploadBytes(ctx, bytes, { encryptToSelf: true })
  if (!up.encrypted) throw new Error('Personality must be stored encrypted.')
  return { rootHash: up.rootHash, txHash: up.txHash, version }
}

/**
 * Load + decrypt a personality by root hash and verify integrity. If
 * `expectedVersion` is given, the recomputed hash must match it; otherwise we
 * return the recomputed version so the caller can pin it.
 */
export async function loadPersonality(
  ctx: ChainContext,
  rootHash: string,
  expectedVersion?: Bytes32,
): Promise<{ config: PersonalityConfig; version: Bytes32 }> {
  const bytes = await downloadBytes(ctx, rootHash, { decrypt: true })
  let config: PersonalityConfig
  try {
    config = JSON.parse(new TextDecoder().decode(bytes)) as PersonalityConfig
  } catch {
    throw new Error(
      `Could not parse personality at ${rootHash} as JSON — wrong key or corrupt blob.`,
    )
  }
  const version = personalityVersion(config)
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(
      `Personality integrity check failed: blob hashes to ${version} but expected ${expectedVersion}.`,
    )
  }
  return { config, version }
}
