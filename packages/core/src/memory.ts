/**
 * Owned, encrypted conversation memory on 0G Storage (MASTER_SPEC §4, P2).
 *
 * The authoritative conversation lives on 0G, encrypted-to-self — message CONTENT
 * never touches the backend DB (non-negotiable #2: our DB is a cache/index only).
 *
 * Shape: a conversation is an append-only chain of *delta snapshots*. Each flush
 * writes one encrypted snapshot holding only the new messages, with `prev` pointing
 * to the previous snapshot's rootHash. The latest snapshot's rootHash is the
 * conversation "head". Walking `prev` from the head back to genesis reconstructs the
 * whole conversation — from 0G + the user's key + the head alone (the P2 + P4 promise:
 * "clear local cache, reload, it still remembers").
 *
 * Per-message provenance (model, provider, chatId, teeVerified, personalityVersion)
 * travels inside the snapshot, so "no silent swap" survives a full reconstruction.
 */
import { toUtf8Bytes } from 'ethers'
import { uploadBytes, downloadBytes, type ChainContext } from '@kipr/og'
import { canonicalize, type Bytes32 } from './personality.js'

export interface MessageProvenance {
  /** Model id that produced the reply. */
  modelId: string
  /** 0G Compute provider address. */
  providerAddr: string
  /** chatID used for processResponse (null if none was returned). */
  chatId: string | null
  /** processResponse result: true=TEE-verified, false=failed, null=skipped. */
  teeVerified: boolean | null
  /** keccak personality version active when this reply was produced. */
  personalityVersion: Bytes32
}

export interface MemoryMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** ISO timestamp. */
  createdAt: string
  /** Present on assistant messages — the provenance recorded at production time. */
  provenance?: MessageProvenance
}

/** One encrypted delta in the conversation chain. */
export interface ConversationSnapshot {
  schemaVersion: 1
  /** Owner address or token id this conversation belongs to. */
  companion: string
  /** rootHash of the previous snapshot, or null for genesis. */
  prev: string | null
  /** Messages added in THIS flush (the delta). */
  messages: MemoryMessage[]
  updatedAt: string
}

export interface SnapshotRef {
  /** 0G Storage rootHash — the new conversation head. */
  head: string
  txHash: string
  /** Number of messages in this delta. */
  added: number
}

function decodeSnapshot(bytes: Uint8Array, rootHash: string): ConversationSnapshot {
  let snap: unknown
  try {
    snap = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error(`Conversation snapshot at ${rootHash} did not decrypt to JSON — wrong key or corrupt.`)
  }
  const s = snap as ConversationSnapshot
  if (s?.schemaVersion !== 1 || !Array.isArray(s.messages) || typeof s.companion !== 'string') {
    throw new Error(`Invalid conversation snapshot shape at ${rootHash}.`)
  }
  return s
}

/**
 * Append a delta of messages to a conversation. `head` is the current head
 * rootHash (or null to start a new conversation). Writes one encrypted snapshot
 * and returns the new head. Cheap: one tx per flush, not per message.
 */
export async function appendMessages(
  ctx: ChainContext,
  opts: { companion: string; head: string | null; messages: MemoryMessage[] },
): Promise<SnapshotRef> {
  if (opts.messages.length === 0) throw new Error('appendMessages: nothing to append.')
  const snapshot: ConversationSnapshot = {
    schemaVersion: 1,
    companion: opts.companion,
    prev: opts.head,
    messages: opts.messages,
    updatedAt: new Date().toISOString(),
  }
  const bytes = toUtf8Bytes(canonicalize(snapshot))
  const up = await uploadBytes(ctx, bytes, { encryptToSelf: true })
  if (!up.encrypted) throw new Error('Conversation memory must be stored encrypted.')
  return { head: up.rootHash, txHash: up.txHash, added: opts.messages.length }
}

/** Load + decrypt a single snapshot by rootHash. */
export async function loadSnapshot(ctx: ChainContext, rootHash: string): Promise<ConversationSnapshot> {
  const bytes = await downloadBytes(ctx, rootHash, { decrypt: true })
  return decodeSnapshot(bytes, rootHash)
}

/**
 * Walk the chain from `head` back to genesis. Returns snapshots genesis-first.
 * `maxDepth` guards against a corrupted/cyclic chain.
 */
export async function loadHistory(
  ctx: ChainContext,
  head: string,
  maxDepth = 10_000,
): Promise<ConversationSnapshot[]> {
  const chain: ConversationSnapshot[] = []
  const seen = new Set<string>()
  let cursor: string | null = head
  while (cursor) {
    if (seen.has(cursor)) throw new Error(`Cycle detected in conversation chain at ${cursor}.`)
    if (chain.length >= maxDepth) throw new Error(`Conversation chain exceeds maxDepth ${maxDepth}.`)
    seen.add(cursor)
    const snap: ConversationSnapshot = await loadSnapshot(ctx, cursor)
    chain.push(snap)
    cursor = snap.prev
  }
  return chain.reverse()
}

/**
 * Reconstruct the full ordered message list of a conversation from its head
 * rootHash alone (+ the wallet key for decryption). This is the P2 recovery proof.
 */
export async function loadConversation(ctx: ChainContext, head: string): Promise<MemoryMessage[]> {
  const chain = await loadHistory(ctx, head)
  return chain.flatMap((s) => s.messages)
}
