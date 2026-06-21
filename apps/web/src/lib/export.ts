/**
 * P4 — export / portability. Your companion is data you own and can walk away with.
 *
 * An export is the DECRYPTED bundle (personality + full conversation) pulled from 0G
 * and readable by you alone — proof it's yours, not locked in our service. Import
 * verifies integrity (the personality must re-hash to its committed version) and can
 * re-seat the companion on a fresh device/wallet.
 */
import { personalityVersion, type PersonalityConfig } from '@kipr/core/personality'
import { loadPersonality } from './companion-store'
import { loadConversation, type MemoryMessage } from './conversation-store'

export interface KiprExport {
  format: 'kipr.export'
  version: 1
  exportedAt: string
  owner: string
  companion: {
    name: string
    personalityVersion: string
    personalityRootHash: string
    conversationHead: string | null
  }
  personality: PersonalityConfig
  conversation: MemoryMessage[]
}

/** Pull everything you own from 0G, decrypt it, and assemble the portable bundle. */
export async function buildExport(
  key: CryptoKey,
  opts: { owner: string; personalityRootHash: string; conversationHead: string | null },
): Promise<KiprExport> {
  const { config, version } = await loadPersonality(key, opts.personalityRootHash)
  const conversation = opts.conversationHead ? await loadConversation(key, opts.conversationHead) : []
  return {
    format: 'kipr.export',
    version: 1,
    exportedAt: new Date().toISOString(),
    owner: opts.owner,
    companion: {
      name: config.name,
      personalityVersion: version,
      personalityRootHash: opts.personalityRootHash,
      conversationHead: opts.conversationHead,
    },
    personality: config,
    conversation,
  }
}

/** Trigger a local file download of the bundle. */
export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Parse + validate an export file, and verify the personality's integrity. */
export function parseExport(text: string): KiprExport {
  let obj: KiprExport
  try {
    obj = JSON.parse(text) as KiprExport
  } catch {
    throw new Error('That file isn’t valid JSON — it may be corrupt or not a KIPR export.')
  }
  if (obj?.format !== 'kipr.export' || obj.version !== 1 || !obj.personality || !obj.companion) {
    throw new Error('That doesn’t look like a KIPR export file.')
  }
  const v = personalityVersion(obj.personality)
  if (v !== obj.companion.personalityVersion) {
    throw new Error(
      `Integrity check failed — personality re-hashes to ${v}, but the file claims ${obj.companion.personalityVersion}. The file may be tampered.`,
    )
  }
  return obj
}
