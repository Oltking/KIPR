/**
 * Cache/index row shapes (MASTER_SPEC §4 "In Postgres").
 *
 * HARD ARCHITECTURAL RULE (non-negotiable #2): this DB holds only *derived* data —
 * root hashes, message *metadata*, version pins, UI cache. The authoritative
 * companion (identity, personality, memory) lives on 0G. A wiped DB + the user's
 * key must fully reconstruct the companion (see reindex.ts).
 *
 * The rule is enforced by the type system, not by discipline: `MessageIndexRow`
 * has NO `content` field. There is no place to put message text server-side, so a
 * leak is a type error, not a code-review catch. Derive rows from 0G via
 * `messageIndexRow()` / reindex — never hand-assemble one with a content string.
 */
import type { Bytes32 } from '@kipr/core'

/** companions(token_id, owner_addr, current_personality_version, metadata_root_hash, created_at) */
export interface CompanionRow {
  /** ERC-7857 token id, or null until minted (P1 chain step). */
  tokenId: string | null
  ownerAddr: string
  currentPersonalityVersion: Bytes32
  metadataRootHash: string
  createdAt: string
}

/**
 * messages(id, companion_id, role, model_id, provider_addr, chat_id, tee_verified,
 *          personality_version, created_at)
 *
 * NOTE — there is deliberately no `content` field. Message text belongs to the
 * user's encrypted 0G memory stream, never to the backend.
 */
export interface MessageIndexRow {
  /** Deterministic, reconstructable id: `${snapshotRootHash}:${indexInSnapshot}`. */
  id: string
  companionId: string
  role: 'system' | 'user' | 'assistant'
  modelId: string | null
  providerAddr: string | null
  chatId: string | null
  teeVerified: boolean | null
  personalityVersion: Bytes32 | null
  createdAt: string
  /** The 0G snapshot this message was reconstructed from (provenance for the cache itself). */
  sourceRootHash: string
}

/** personality_versions(version_hash, companion_id, root_hash, model_id_pinned, created_at, user_confirmed) */
export interface PersonalityVersionRow {
  versionHash: Bytes32
  companionId: string
  rootHash: string
  modelIdPinned: string
  createdAt: string
  /** Non-negotiable #4: personality changes require explicit user opt-in. */
  userConfirmed: boolean
}

export type RootKind = 'personality' | 'conversation' | 'export'

/** root_index(root_hash, kind, companion_id, created_at) */
export interface RootIndexRow {
  rootHash: string
  kind: RootKind
  companionId: string
  createdAt: string
}
