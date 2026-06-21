/**
 * In-memory CacheStore — the default for dev and smoke tests.
 *
 * This is a legitimate cache implementation, not a mock of 0G: the authoritative
 * data still lives on real 0G; this just holds the derived index in a Map. Swap it
 * for PostgresStore in deployment without touching call sites.
 */
import type { CacheStore } from './store.js'
import type {
  CompanionRow,
  MessageIndexRow,
  PersonalityVersionRow,
  RootIndexRow,
} from '../schema.js'

export class MemoryStore implements CacheStore {
  private companions = new Map<string, CompanionRow>() // keyed by ownerAddr
  private messages = new Map<string, MessageIndexRow>() // keyed by row id
  private versions = new Map<string, PersonalityVersionRow>() // keyed by versionHash
  private roots = new Map<string, RootIndexRow>() // keyed by rootHash

  async upsertCompanion(row: CompanionRow): Promise<void> {
    this.companions.set(row.ownerAddr.toLowerCase(), row)
  }

  async upsertMessages(rows: MessageIndexRow[]): Promise<void> {
    for (const r of rows) this.messages.set(r.id, r)
  }

  async upsertPersonalityVersion(row: PersonalityVersionRow): Promise<void> {
    this.versions.set(row.versionHash, row)
  }

  async upsertRoot(row: RootIndexRow): Promise<void> {
    this.roots.set(row.rootHash, row)
  }

  async getCompanion(ownerAddr: string): Promise<CompanionRow | null> {
    return this.companions.get(ownerAddr.toLowerCase()) ?? null
  }

  async listMessages(companionId: string): Promise<MessageIndexRow[]> {
    return [...this.messages.values()]
      .filter((m) => m.companionId === companionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async listPersonalityVersions(companionId: string): Promise<PersonalityVersionRow[]> {
    return [...this.versions.values()]
      .filter((v) => v.companionId === companionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async listRoots(companionId: string): Promise<RootIndexRow[]> {
    return [...this.roots.values()]
      .filter((r) => r.companionId === companionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async purgeCompanion(companionId: string): Promise<void> {
    for (const [addr, c] of this.companions)
      if (c.ownerAddr.toLowerCase() === companionId.toLowerCase()) this.companions.delete(addr)
    for (const [id, m] of this.messages) if (m.companionId === companionId) this.messages.delete(id)
    for (const [h, v] of this.versions) if (v.companionId === companionId) this.versions.delete(h)
    for (const [h, r] of this.roots) if (r.companionId === companionId) this.roots.delete(h)
  }

  async purgeAll(): Promise<void> {
    this.companions.clear()
    this.messages.clear()
    this.versions.clear()
    this.roots.clear()
  }
}
