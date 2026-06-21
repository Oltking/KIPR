/**
 * CacheStore — the swappable backend cache interface.
 *
 * Because the cache is explicitly NOT the source of truth (non-negotiable #2), the
 * concrete store is pluggable: an in-memory store for dev/tests, a Postgres store
 * for deployment. Both implement this identical surface. Anything here must be
 * derivable from 0G; nothing here may be the only copy of anything.
 *
 * Reads are best-effort cache hits. A miss is never an error — the caller falls
 * back to reconstructing from 0G (reindex.ts) and re-populates the cache.
 */
import type {
  CompanionRow,
  MessageIndexRow,
  PersonalityVersionRow,
  RootIndexRow,
} from '../schema.js'

export interface CacheStore {
  /** Idempotent upserts — re-running a reindex must converge, not duplicate. */
  upsertCompanion(row: CompanionRow): Promise<void>
  upsertMessages(rows: MessageIndexRow[]): Promise<void>
  upsertPersonalityVersion(row: PersonalityVersionRow): Promise<void>
  upsertRoot(row: RootIndexRow): Promise<void>

  getCompanion(ownerAddr: string): Promise<CompanionRow | null>
  /** Cached message metadata for a companion, oldest-first. */
  listMessages(companionId: string): Promise<MessageIndexRow[]>
  listPersonalityVersions(companionId: string): Promise<PersonalityVersionRow[]>
  listRoots(companionId: string): Promise<RootIndexRow[]>

  /** Drop everything for a companion (the "wipe the cache" half of the recovery proof). */
  purgeCompanion(companionId: string): Promise<void>
  /** Drop the entire cache. */
  purgeAll(): Promise<void>
}
