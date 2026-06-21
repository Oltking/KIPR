/**
 * Reindex — rebuild the cache/index from 0G alone.
 *
 * This is the executable proof of non-negotiable #2: "a wiped DB + the user's key
 * must fully reconstruct the companion." Every cache row is *derived* here from
 * authoritative 0G data — message metadata from the encrypted conversation chain,
 * the companion + personality version from the encrypted personality blob.
 *
 * The derivation drops message content on the floor: `toMessageRow()` reads a
 * MemoryMessage but writes a MessageIndexRow, which has no content field. The
 * server literally cannot retain message text.
 */
import {
  loadSnapshot,
  loadPersonality,
  type ConversationSnapshot,
  type MemoryMessage,
} from '@kipr/core'
import type { ChainContext } from '@kipr/og'
import type { CacheStore } from './store/store.js'
import type { CompanionRow, MessageIndexRow, PersonalityVersionRow, RootIndexRow } from './schema.js'

/** Walk a conversation chain from head→genesis, capturing each snapshot WITH its rootHash. */
async function walkWithRoots(
  ctx: ChainContext,
  head: string,
  maxDepth = 10_000,
): Promise<Array<{ rootHash: string; snapshot: ConversationSnapshot }>> {
  const out: Array<{ rootHash: string; snapshot: ConversationSnapshot }> = []
  const seen = new Set<string>()
  let cursor: string | null = head
  while (cursor) {
    if (seen.has(cursor)) throw new Error(`Cycle detected in conversation chain at ${cursor}.`)
    if (out.length >= maxDepth) throw new Error(`Conversation chain exceeds maxDepth ${maxDepth}.`)
    seen.add(cursor)
    const snapshot: ConversationSnapshot = await loadSnapshot(ctx, cursor)
    out.push({ rootHash: cursor, snapshot })
    cursor = snapshot.prev
  }
  return out.reverse() // genesis-first
}

/** Derive a metadata row from a message — content is read but NOT written. */
function toMessageRow(
  companionId: string,
  sourceRootHash: string,
  idx: number,
  msg: MemoryMessage,
): MessageIndexRow {
  const p = msg.provenance
  return {
    id: `${sourceRootHash}:${idx}`,
    companionId,
    role: msg.role,
    modelId: p?.modelId ?? null,
    providerAddr: p?.providerAddr ?? null,
    chatId: p?.chatId ?? null,
    teeVerified: p?.teeVerified ?? null,
    personalityVersion: p?.personalityVersion ?? null,
    createdAt: msg.createdAt,
    sourceRootHash,
  }
}

export interface ReindexResult {
  snapshots: number
  messages: number
}

/**
 * Rebuild the message index + conversation root_index for a companion from its
 * conversation head rootHash. Idempotent — re-running converges.
 */
export async function reindexConversation(
  ctx: ChainContext,
  store: CacheStore,
  companionId: string,
  head: string,
): Promise<ReindexResult> {
  const chain = await walkWithRoots(ctx, head)
  const rows: MessageIndexRow[] = []
  for (const { rootHash, snapshot } of chain) {
    const root: RootIndexRow = {
      rootHash,
      kind: 'conversation',
      companionId,
      createdAt: snapshot.updatedAt,
    }
    await store.upsertRoot(root)
    snapshot.messages.forEach((m, i) => rows.push(toMessageRow(companionId, rootHash, i, m)))
  }
  await store.upsertMessages(rows)
  return { snapshots: chain.length, messages: rows.length }
}

/**
 * Rebuild the companion + personality_version + personality root_index from the
 * encrypted personality blob on 0G. `userConfirmed` reflects whether the user has
 * opted into this version (non-negotiable #4) — default true on reindex of an
 * already-active version, since an active version was, by definition, confirmed.
 */
export async function reindexCompanion(
  ctx: ChainContext,
  store: CacheStore,
  owner: string,
  metadataRootHash: string,
  opts: { tokenId?: string | null; createdAt?: string; userConfirmed?: boolean } = {},
): Promise<{ companion: CompanionRow; version: PersonalityVersionRow }> {
  const { config, version } = await loadPersonality(ctx, metadataRootHash)
  const companionId = owner.toLowerCase()
  const createdAt = opts.createdAt ?? new Date().toISOString()

  const companion: CompanionRow = {
    tokenId: opts.tokenId ?? null,
    ownerAddr: companionId,
    currentPersonalityVersion: version,
    metadataRootHash,
    createdAt,
  }
  const versionRow: PersonalityVersionRow = {
    versionHash: version,
    companionId,
    rootHash: metadataRootHash,
    modelIdPinned: config.modelId,
    userConfirmed: opts.userConfirmed ?? true,
    createdAt,
  }
  const root: RootIndexRow = { rootHash: metadataRootHash, kind: 'personality', companionId, createdAt }

  await store.upsertCompanion(companion)
  await store.upsertPersonalityVersion(versionRow)
  await store.upsertRoot(root)
  return { companion, version: versionRow }
}
