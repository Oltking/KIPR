/**
 * P1 — Companion creation. The warm front door, but every value it shows is real:
 * the personality version hash is computed by the SAME @kipr/core code the server
 * and chain use (makePersonality → personalityVersion), so what you see here is
 * exactly the bytes32 the companion will commit to.
 *
 * "No silent swap" is made *felt*: edit any field (including the pinned model) and
 * the version hash visibly changes — nobody can alter your companion without it
 * becoming a new, opt-in version.
 *
 * Two steps are honestly GATED and not faked here:
 *   - encrypt + write the personality to 0G (needs the client-side encryption-key
 *     decision — a security choice flagged for explicit sign-off)
 *   - mint the ERC-7857 token (needs the contract deploy decision)
 */
import { useMemo, useState } from 'react'
import {
  makePersonality,
  personalityVersion,
  canonicalBytes,
  type PersonalityConfig,
} from '@kipr/core/personality'
import { personalityIntelligentData } from '@kipr/core/companion'
import type { Connection } from '../lib/wallet'

// Pinned at creation from a 0G Compute TeeML provider's model. Until the compute
// ledger is funded we pin the configured default; changing it changes the version.
const DEFAULT_MODEL_ID = 'zai-org/GLM-5-FP8'

const linesToList = (s: string) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean)

export function CompanionCreator({ conn }: { conn: Connection | null }) {
  const [name, setName] = useState('KIPR')
  const [pronouns, setPronouns] = useState('')
  const [vibe, setVibe] = useState('warm, grounded, and honest; concise; a dry sense of humor')
  const [values, setValues] = useState(
    'Privacy is yours, not mine to spend\nTell the truth even when it is inconvenient\nRemember what matters to you',
  )
  const [boundaries, setBoundaries] = useState(
    'judge you for what you share\npretend to be human\nflatter you dishonestly',
  )
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [created, setCreated] = useState<{ config: PersonalityConfig; version: string } | null>(null)

  // Live, real derivation from the shared domain core.
  const config = useMemo<PersonalityConfig>(
    () =>
      makePersonality({
        name: name.trim() || 'KIPR',
        ...(pronouns.trim() ? { pronouns: pronouns.trim() } : {}),
        vibe: vibe.trim(),
        values: linesToList(values),
        boundaries: linesToList(boundaries),
        modelId: modelId.trim() || DEFAULT_MODEL_ID,
      }),
    [name, pronouns, vibe, values, boundaries, modelId],
  )
  const version = useMemo(() => personalityVersion(config), [config])
  const blobSize = useMemo(() => canonicalBytes(config).length, [config])
  const dataHash = personalityIntelligentData(version) // { dataDescription, dataHash }

  return (
    <>
      <section className="card">
        <div className="card-h">
          <span className="step">1</span>
          <h2>Create your companion</h2>
        </div>
        <p className="muted">
          This is who it is and how it talks. It belongs to you — its personality is content you own,
          committed by a version hash nobody can change behind your back.
        </p>

        <label className="lbl">Name</label>
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="lbl">Pronouns (optional)</label>
        <input className="inp" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g. they/them" />

        <label className="lbl">Vibe — how it talks and feels</label>
        <input className="inp" value={vibe} onChange={(e) => setVibe(e.target.value)} />

        <label className="lbl">Values (one per line)</label>
        <textarea className="inp ta" rows={3} value={values} onChange={(e) => setValues(e.target.value)} />

        <label className="lbl">Boundaries — won't do (one per line)</label>
        <textarea className="inp ta" rows={3} value={boundaries} onChange={(e) => setBoundaries(e.target.value)} />

        <label className="lbl">Pinned model</label>
        <input className="inp" value={modelId} onChange={(e) => setModelId(e.target.value)} />
        <p className="muted small">Final pin comes from a 0G Compute TeeML provider at creation. Changing it is a new version.</p>
      </section>

      {/* Live identity — the felt "no silent swap" */}
      <section className="card">
        <div className="card-h">
          <span className="step">2</span>
          <h2>Identity (live)</h2>
        </div>
        <dl className="kv">
          <div>
            <dt>personality version = ERC-7857 dataHash</dt>
            <dd className="mono hash">{version}</dd>
          </div>
          <div><dt>descriptor</dt><dd className="mono">{dataHash.dataDescription}</dd></div>
          <div><dt>owner</dt><dd className="mono">{conn ? conn.address : '— connect wallet —'}</dd></div>
          <div><dt>encrypted blob size</dt><dd>{blobSize} bytes</dd></div>
        </dl>
        <details className="reveal">
          <summary>System prompt (pinned to this version)</summary>
          <pre className="pre">{config.systemPrompt}</pre>
        </details>
        <p className="muted small">Edit any field above and this hash changes — that's the guarantee made visible.</p>
      </section>

      {/* Commit — honest about what's real vs gated */}
      <section className="card">
        <div className="card-h">
          <span className="step">3</span>
          <h2>Bring it to life</h2>
        </div>
        <button
          onClick={() => setCreated({ config, version })}
          disabled={!conn}
          title={conn ? '' : 'Connect a wallet first'}
        >
          Create companion (draft)
        </button>
        {!conn && <p className="muted">Connect a wallet first.</p>}
        {created && (
          <div className="okbox">
            <p>✓ Drafted <strong>{created.config.name}</strong> at version <span className="mono">{created.version.slice(0, 14)}…</span></p>
          </div>
        )}

        <div className="gatedlist">
          <p className="muted"><strong>Next, to make it permanent:</strong></p>
          <ul className="muted">
            <li><span className="badge">gated</span> Encrypt the personality client-side &amp; write to 0G Storage — pending the encryption-key decision (a security choice that needs your sign-off).</li>
            <li><span className="badge">gated</span> Mint the ERC-7857 companion token committing to <span className="mono">{version.slice(0, 10)}…</span> — pending the contract-deploy decision.</li>
          </ul>
        </div>
      </section>
    </>
  )
}
