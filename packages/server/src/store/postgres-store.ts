/**
 * Postgres CacheStore — the deployment backend. Implements the same CacheStore
 * surface as MemoryStore, so it drops in without touching call sites.
 *
 * `pg` is dynamically imported so importing this module never forces a DB
 * connection; you only pay for it when you actually construct a PostgresStore.
 * Run the DDL in src/sql/schema.sql once (or call `init()`), then point
 * DATABASE_URL at it. The schema has no message-content column by construction.
 *
 * Not exercised by the cache smoke (which has no DB) — that uses MemoryStore. This
 * is real, not a mock: same idempotent upsert semantics, ready for a live Postgres.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { CacheStore } from './store.js'
import type {
  CompanionRow,
  MessageIndexRow,
  PersonalityVersionRow,
  RootIndexRow,
} from '../schema.js'

type PgPool = {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>
  end(): Promise<void>
}

const hexToBuf = (h: string) => Buffer.from(h.replace(/^0x/, ''), 'hex')
const bufToHex = (b: Buffer | null) => (b ? '0x' + b.toString('hex') : null)

export class PostgresStore implements CacheStore {
  private constructor(private pool: PgPool) {}

  /** Connect and ensure the schema exists. */
  static async connect(connectionString: string): Promise<PostgresStore> {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString }) as unknown as PgPool
    const store = new PostgresStore(pool)
    await store.init()
    return store
  }

  async init(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url))
    const ddl = readFileSync(resolve(here, '../sql/schema.sql'), 'utf8')
    await this.pool.query(ddl)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async upsertCompanion(row: CompanionRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO companions (owner_addr, token_id, current_personality_version, metadata_root_hash, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (owner_addr) DO UPDATE SET
         token_id = EXCLUDED.token_id,
         current_personality_version = EXCLUDED.current_personality_version,
         metadata_root_hash = EXCLUDED.metadata_root_hash`,
      [row.ownerAddr.toLowerCase(), row.tokenId, hexToBuf(row.currentPersonalityVersion), row.metadataRootHash, row.createdAt],
    )
  }

  async upsertMessages(rows: MessageIndexRow[]): Promise<void> {
    for (const r of rows) {
      await this.pool.query(
        `INSERT INTO messages (id, companion_id, role, model_id, provider_addr, chat_id, tee_verified, personality_version, source_root_hash, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.companionId, r.role, r.modelId, r.providerAddr, r.chatId, r.teeVerified,
          r.personalityVersion ? hexToBuf(r.personalityVersion) : null, r.sourceRootHash, r.createdAt,
        ],
      )
    }
  }

  async upsertPersonalityVersion(row: PersonalityVersionRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO personality_versions (version_hash, companion_id, root_hash, model_id_pinned, user_confirmed, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (version_hash) DO UPDATE SET user_confirmed = EXCLUDED.user_confirmed`,
      [hexToBuf(row.versionHash), row.companionId, row.rootHash, row.modelIdPinned, row.userConfirmed, row.createdAt],
    )
  }

  async upsertRoot(row: RootIndexRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO root_index (root_hash, kind, companion_id, created_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT (root_hash) DO NOTHING`,
      [row.rootHash, row.kind, row.companionId, row.createdAt],
    )
  }

  async getCompanion(ownerAddr: string): Promise<CompanionRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM companions WHERE owner_addr = $1`, [ownerAddr.toLowerCase()])
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      tokenId: r.token_id,
      ownerAddr: r.owner_addr,
      currentPersonalityVersion: bufToHex(r.current_personality_version) as `0x${string}`,
      metadataRootHash: r.metadata_root_hash,
      createdAt: new Date(r.created_at).toISOString(),
    }
  }

  async listMessages(companionId: string): Promise<MessageIndexRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM messages WHERE companion_id = $1 ORDER BY created_at ASC`, [companionId],
    )
    return rows.map((r) => ({
      id: r.id,
      companionId: r.companion_id,
      role: r.role,
      modelId: r.model_id,
      providerAddr: r.provider_addr,
      chatId: r.chat_id,
      teeVerified: r.tee_verified,
      personalityVersion: bufToHex(r.personality_version) as `0x${string}` | null,
      sourceRootHash: r.source_root_hash,
      createdAt: new Date(r.created_at).toISOString(),
    }))
  }

  async listPersonalityVersions(companionId: string): Promise<PersonalityVersionRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM personality_versions WHERE companion_id = $1 ORDER BY created_at ASC`, [companionId],
    )
    return rows.map((r) => ({
      versionHash: bufToHex(r.version_hash) as `0x${string}`,
      companionId: r.companion_id,
      rootHash: r.root_hash,
      modelIdPinned: r.model_id_pinned,
      userConfirmed: r.user_confirmed,
      createdAt: new Date(r.created_at).toISOString(),
    }))
  }

  async listRoots(companionId: string): Promise<RootIndexRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM root_index WHERE companion_id = $1 ORDER BY created_at ASC`, [companionId],
    )
    return rows.map((r) => ({
      rootHash: r.root_hash,
      kind: r.kind,
      companionId: r.companion_id,
      createdAt: new Date(r.created_at).toISOString(),
    }))
  }

  async purgeCompanion(companionId: string): Promise<void> {
    const id = companionId.toLowerCase()
    await this.pool.query(`DELETE FROM messages WHERE companion_id = $1`, [id])
    await this.pool.query(`DELETE FROM personality_versions WHERE companion_id = $1`, [id])
    await this.pool.query(`DELETE FROM root_index WHERE companion_id = $1`, [id])
    await this.pool.query(`DELETE FROM companions WHERE owner_addr = $1`, [id])
  }

  async purgeAll(): Promise<void> {
    await this.pool.query(`TRUNCATE messages, personality_versions, root_index, companions`)
  }
}
