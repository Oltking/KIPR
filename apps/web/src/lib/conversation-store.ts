/**
 * Owned, encrypted conversation memory in the browser — the client-side mirror of
 * @kipr/core/memory. A conversation is an append-only chain of encrypted delta
 * snapshots linked by `prev` rootHash; the latest rootHash is the "head". Walking
 * prev from the head + the wallet-derived key reconstructs the whole conversation
 * (the "clear local cache, reload, it still remembers" guarantee) — no server.
 *
 * Same SHAPE as the server's ConversationSnapshot (so metadata stays interoperable),
 * but encrypted with AES-256-GCM under the user's key (lib/crypto), since the browser
 * can't ECIES-to-self. Message content lives only here, on 0G — never server-side.
 */
import type { JsonRpcSigner } from 'ethers'
import { encryptOwned, decryptOwned } from './crypto'
import { uploadBytes, downloadBytes } from './storage'

export interface MessageProvenance {
  modelId: string
  providerAddr: string
  chatId: string | null
  /** true = TEE-verified, false = failed, null = not yet verified (compute gated). */
  teeVerified: boolean | null
  personalityVersion: string
}

export interface MemoryMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: string
  provenance?: MessageProvenance
}

interface ConversationSnapshot {
  schemaVersion: 1
  companion: string
  prev: string | null
  messages: MemoryMessage[]
  updatedAt: string
}

export interface SnapshotRef {
  head: string
  txHash: string
  added: number
}

const encodeSnapshot = (s: ConversationSnapshot): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(s))

function decodeSnapshot(bytes: Uint8Array, rootHash: string): ConversationSnapshot {
  let s: ConversationSnapshot
  try {
    s = JSON.parse(new TextDecoder().decode(bytes)) as ConversationSnapshot
  } catch {
    throw new Error(`Conversation snapshot at ${rootHash} did not decrypt to JSON — wrong key or corrupt.`)
  }
  if (s?.schemaVersion !== 1 || !Array.isArray(s.messages)) {
    throw new Error(`Invalid conversation snapshot at ${rootHash}.`)
  }
  return s
}

/** Append a delta of messages, encrypted, as one new snapshot. Returns the new head. */
export async function appendMessages(
  signer: JsonRpcSigner,
  key: CryptoKey,
  opts: { companion: string; head: string | null; messages: MemoryMessage[] },
): Promise<SnapshotRef> {
  if (opts.messages.length === 0) throw new Error('Nothing to append.')
  const snapshot: ConversationSnapshot = {
    schemaVersion: 1,
    companion: opts.companion,
    prev: opts.head,
    messages: opts.messages,
    updatedAt: new Date().toISOString(),
  }
  const encrypted = await encryptOwned(key, encodeSnapshot(snapshot))
  const { rootHash, txHash } = await uploadBytes(signer, encrypted)
  return { head: rootHash, txHash, added: opts.messages.length }
}

/** Reconstruct the full ordered conversation from the head rootHash + key alone. */
export async function loadConversation(key: CryptoKey, head: string): Promise<MemoryMessage[]> {
  const chain: ConversationSnapshot[] = []
  const seen = new Set<string>()
  let cursor: string | null = head
  while (cursor) {
    if (seen.has(cursor)) throw new Error(`Cycle detected in conversation chain at ${cursor}.`)
    seen.add(cursor)
    const bytes = await decryptOwned(key, await downloadBytes(cursor))
    const snap = decodeSnapshot(bytes, cursor)
    chain.push(snap)
    cursor = snap.prev
  }
  return chain.reverse().flatMap((s) => s.messages)
}
