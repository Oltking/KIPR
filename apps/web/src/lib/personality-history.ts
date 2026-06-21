/**
 * Local version-history cache (P3, "no silent swap" made legible). Each adopted
 * personality version is recorded here so the UI can show the timeline of who your
 * companion has been. Derivable, not authoritative — the versions themselves live as
 * encrypted blobs on 0G, keyed by rootHash; this is just the index of them.
 */
export interface VersionEntry {
  version: string
  rootHash: string
  name: string
  modelId: string
  createdAt: string
  /** True once the user explicitly adopted it (always true here — we only record on opt-in). */
  confirmed: boolean
}

const key = (owner: string) => `kipr.pers.history.${owner.toLowerCase()}`

export function getVersions(owner: string): VersionEntry[] {
  try {
    const raw = localStorage.getItem(key(owner))
    return raw ? (JSON.parse(raw) as VersionEntry[]) : []
  } catch {
    return []
  }
}

/** Record an adopted version (newest-last). Dedupes by version hash. */
export function addVersion(owner: string, entry: VersionEntry): void {
  const list = getVersions(owner)
  if (list.some((v) => v.version === entry.version)) return
  list.push(entry)
  try {
    localStorage.setItem(key(owner), JSON.stringify(list))
  } catch {
    /* ignore storage errors */
  }
}

export function clearVersions(owner: string): void {
  try {
    localStorage.removeItem(key(owner))
  } catch {
    /* ignore */
  }
}
