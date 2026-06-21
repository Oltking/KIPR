/**
 * One-drip-per-user record, persisted to a JSON file so the cap survives restarts.
 * Keyed by Privy user DID. Small scale by design — swap for a DB if it grows.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export interface DripRecord {
  address: string
  txHash: string
  amountOG: string
  at: string
}

export class DripLog {
  private map: Record<string, DripRecord> = {}

  constructor(private file: string) {
    if (existsSync(file)) {
      try {
        this.map = JSON.parse(readFileSync(file, 'utf8')) as Record<string, DripRecord>
      } catch {
        this.map = {}
      }
    }
  }

  has(userId: string): boolean {
    return userId in this.map
  }

  get(userId: string): DripRecord | undefined {
    return this.map[userId]
  }

  record(userId: string, rec: DripRecord): void {
    this.map[userId] = rec
    writeFileSync(this.file, JSON.stringify(this.map, null, 2))
  }

  count(): number {
    return Object.keys(this.map).length
  }
}
