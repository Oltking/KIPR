/**
 * Personality model + content-hash versioning — the spine of "no silent swap"
 * (MASTER_SPEC non-negotiable #4).
 *
 * A PersonalityConfig is hashed canonically to a 32-byte version id. That hash:
 *   - is the `personality_version` recorded per message (old messages keep theirs);
 *   - doubles as the ERC-7857 `IntelligentData.dataHash` (bytes32) the companion
 *     token commits to on-chain (see contracts/interfaces/IERC7857Metadata.sol);
 *   - changes whenever ANY field changes — crucially including `modelId`, so a model
 *     swap is, by construction, a new version the user must opt into.
 *
 * The hash is deterministic: canonical JSON (recursively key-sorted) → keccak256.
 * The exact canonical bytes are what we persist, so a reloaded config re-hashes
 * to the identical version (integrity check in persistence.ts).
 */
import { keccak256, toUtf8Bytes } from 'ethers'

/** 0x-prefixed 32-byte keccak hash — same width as Solidity `bytes32`. */
export type Bytes32 = string

export interface PersonalityConfig {
  /** Bump only on a breaking shape change; part of the hashed content. */
  schemaVersion: 1
  /** What the user calls their companion. */
  name: string
  /** Optional pronouns the companion uses for itself. */
  pronouns?: string
  /** Short, human description of how it talks and feels ("warm, dry humor, concise"). */
  vibe: string
  /** Durable traits it holds to. Order is meaningful and preserved. */
  values: string[]
  /** Hard lines it won't cross (user-defined). Order preserved. */
  boundaries: string[]
  /**
   * The system prompt that actually conditions the model. Assembled from the
   * fields above via buildSystemPrompt(), but stored explicitly so the exact
   * conditioning text is pinned to the version hash.
   */
  systemPrompt: string
  /**
   * Pinned model id. Hashed into the version → a model change is a new version,
   * never silent. Set from a 0G Compute TeeML provider's model at creation time.
   */
  modelId: string
}

/** Recursively key-sorted JSON so logically-equal configs hash identically. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
}

/** Canonical UTF-8 bytes of a config — exactly what gets encrypted + stored. */
export function canonicalBytes(config: PersonalityConfig): Uint8Array {
  return toUtf8Bytes(canonicalize(config))
}

/** The version id: keccak256 over the canonical bytes. 0x + 64 hex (bytes32). */
export function personalityVersion(config: PersonalityConfig): Bytes32 {
  return keccak256(canonicalBytes(config))
}

/**
 * Assemble the system prompt from the structured fields. Deterministic so the
 * same inputs always produce the same conditioning text (and thus version).
 */
export function buildSystemPrompt(
  p: Pick<PersonalityConfig, 'name' | 'pronouns' | 'vibe' | 'values' | 'boundaries'>,
): string {
  const lines = [
    `You are ${p.name}, a private AI companion that belongs to one person.`,
    p.pronouns ? `You refer to yourself using ${p.pronouns} pronouns.` : '',
    `Your manner: ${p.vibe}.`,
    p.values.length ? `You hold to these values: ${p.values.join('; ')}.` : '',
    p.boundaries.length ? `You will not: ${p.boundaries.join('; ')}.` : '',
    'You remember what matters to this person and stay consistent with who you are.',
  ].filter(Boolean)
  return lines.join('\n')
}

/**
 * Build a complete, hashable config from user-facing fields + the pinned model.
 * systemPrompt is derived here so callers can't desync it from the structured fields.
 */
export function makePersonality(input: {
  name: string
  pronouns?: string
  vibe: string
  values: string[]
  boundaries: string[]
  modelId: string
}): PersonalityConfig {
  const base = {
    schemaVersion: 1 as const,
    name: input.name,
    ...(input.pronouns ? { pronouns: input.pronouns } : {}),
    vibe: input.vibe,
    values: input.values,
    boundaries: input.boundaries,
    modelId: input.modelId,
  }
  return { ...base, systemPrompt: buildSystemPrompt(base) }
}

/** A gentle, opinionated starting companion for onboarding (model pinned by caller). */
export function defaultPersonality(modelId: string): PersonalityConfig {
  return makePersonality({
    name: 'KIPR',
    vibe: 'warm, grounded, and honest; concise; a dry sense of humor',
    values: [
      'Privacy is yours, not mine to spend',
      'Tell the truth even when it is inconvenient',
      'Remember what matters to you',
    ],
    boundaries: ['judge you for what you share', 'pretend to be human', 'flatter you dishonestly'],
    modelId,
  })
}
