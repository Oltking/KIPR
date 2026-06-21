/**
 * Companion record — the authoritative companion lives on 0G (token + encrypted
 * metadata blob); this is the reconstructable index of where it lives, matching
 * MASTER_SPEC §4. A clean client + the user's key must be able to rebuild this
 * from chain + 0G Storage alone, so every field here is either on-chain or derived.
 */
import type { Bytes32 } from './personality.js'

export interface CompanionRecord {
  /** ERC-7857 tokenId once minted (P1 chain step). Undefined until then. */
  tokenId?: string
  /** Owning wallet address (lowercased). */
  owner: string
  /** keccak version hash of the currently-active personality (no silent swap). */
  personalityVersion: Bytes32
  /** 0G Storage rootHash of the active encrypted personality blob. */
  metadataRootHash: string
  /** ISO timestamp of creation (UI only; not authoritative). */
  createdAt: string
}

/** The ERC-7857 private-metadata descriptor a mint/update commits to on-chain. */
export interface IntelligentDataInput {
  dataDescription: string
  /** bytes32 — the personality version hash. */
  dataHash: Bytes32
}

/** Standard descriptor for a KIPR companion's encrypted personality metadata. */
export function personalityIntelligentData(version: Bytes32): IntelligentDataInput {
  return { dataDescription: 'kipr:personality:v1', dataHash: version }
}
