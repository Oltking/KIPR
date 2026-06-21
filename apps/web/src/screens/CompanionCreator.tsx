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
import { persistPersonality, loadPersonality } from '../lib/companion-store'
import { OG_TESTNET } from '../lib/og'
import { Dot, type Status } from '../components/Dot'
import { CompanionOrb } from '../components/CompanionOrb'

// Pinned at creation from a 0G Compute TeeML provider's model. Until the compute
// ledger is funded we pin the configured default; changing it changes the version.
const DEFAULT_MODEL_ID = 'zai-org/GLM-5-FP8'

const linesToList = (s: string) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean)

export function CompanionCreator({
  conn,
  ownerKey,
  onUnlock,
  unlockStatus,
}: {
  conn: Connection | null
  ownerKey: CryptoKey | null
  onUnlock: () => void
  unlockStatus: Status
}) {
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

  const [saveStatus, setSaveStatus] = useState<Status>('idle')
  const [saveErr, setSaveErr] = useState('')
  const [saved, setSaved] = useState<{ rootHash: string; txHash: string; version: string } | null>(null)

  const [recoverStatus, setRecoverStatus] = useState<Status>('idle')
  const [recoverErr, setRecoverErr] = useState('')
  const [recovered, setRecovered] = useState<{ name: string; version: string } | null>(null)

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

  async function onCreate() {
    if (!conn || !ownerKey) return
    setSaveStatus('busy')
    setSaveErr('')
    setSaved(null)
    setRecovered(null)
    setRecoverStatus('idle')
    try {
      const ref = await persistPersonality(conn.signer, ownerKey, config)
      setSaved(ref)
      setSaveStatus('ok')
    } catch (e) {
      setSaveErr((e as Error).message)
      setSaveStatus('error')
    }
  }

  // The "magic moment": forget the local config, rebuild it from 0G + the key alone.
  async function onRecover() {
    if (!ownerKey || !saved) return
    setRecoverStatus('busy')
    setRecoverErr('')
    setRecovered(null)
    try {
      const { config: c, version: v } = await loadPersonality(ownerKey, saved.rootHash, saved.version)
      setRecovered({ name: c.name, version: v })
      setRecoverStatus('ok')
    } catch (e) {
      setRecoverErr((e as Error).message)
      setRecoverStatus('error')
    }
  }

  const orbState = saveStatus === 'busy' || recoverStatus === 'busy' ? 'thinking' : 'idle'

  return (
    <>
      <section className="intro">
        <CompanionOrb size={108} state={orbState} />
        <h2 className="intro-h">{saved ? `Meet ${config.name}` : 'Shape your companion'}</h2>
        <p className="intro-p">
          Who it is, how it talks, what it holds to — you decide, and it's yours. Nothing here can be
          changed behind your back: every detail is sealed under a version only you can move.
        </p>
      </section>

      <section className="card">
        <div className="card-h">
          <span className="step">1</span>
          <h2>Who they are</h2>
        </div>

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

      {/* Commit — REAL: encrypt client-side + write to 0G */}
      <section className={`card ${saveStatus}`}>
        <div className="card-h">
          <span className="step">3</span>
          <h2>Save to 0G — encrypted, yours</h2>
          <Dot status={saveStatus} />
        </div>
        <p className="muted small">
          Encrypted client-side with your wallet-derived key (AES-256-GCM) before it ever leaves the
          device — 0G stores only ciphertext.
        </p>
        {!conn ? (
          <p className="muted">Connect a wallet first.</p>
        ) : !ownerKey ? (
          <button onClick={onUnlock} disabled={unlockStatus === 'busy'}>
            {unlockStatus === 'busy' ? 'Sign in wallet…' : '🔒 Unlock (sign once to get your key)'}
          </button>
        ) : (
          <button onClick={onCreate} disabled={saveStatus === 'busy'}>
            {saveStatus === 'busy' ? 'Encrypting → storing…' : 'Create companion'}
          </button>
        )}
        {saved && (
          <dl className="kv">
            <div><dt>personality rootHash</dt><dd className="mono">{saved.rootHash}</dd></div>
            <div>
              <dt>tx</dt>
              <dd className="mono"><a href={`${OG_TESTNET.explorer}/tx/${saved.txHash}`} target="_blank" rel="noreferrer">{saved.txHash}</a></dd>
            </div>
            <div><dt>version</dt><dd className="mono hash">{saved.version}</dd></div>
          </dl>
        )}
        {saveErr && <p className="err">{saveErr}</p>}
      </section>

      {/* Recovery — the magic moment, made real */}
      {saved && (
        <section className={`card ${recoverStatus}`}>
          <div className="card-h">
            <span className="step">4</span>
            <h2>Prove it's yours</h2>
            <Dot status={recoverStatus} />
          </div>
          <p className="muted small">
            Rebuild the companion from 0G + your key alone (re-download, re-decrypt, re-hash). This is the
            "restore on a new device" guarantee — no server involved.
          </p>
          <button onClick={onRecover} disabled={recoverStatus === 'busy'}>
            {recoverStatus === 'busy' ? 'Recovering…' : 'Recover from 0G'}
          </button>
          {recovered && (
            <div className="okbox">
              <p>✓ Recovered <strong>{recovered.name}</strong> — integrity verified, version <span className="mono">{recovered.version.slice(0, 14)}…</span> matches.</p>
            </div>
          )}
          {recoverErr && <p className="err">{recoverErr}</p>}
        </section>
      )}

      {/* The one remaining gated step */}
      <section className="card gated">
        <div className="card-h">
          <span className="step">5</span>
          <h2>Mint companion token</h2>
          <span className="badge">gated</span>
        </div>
        <p className="muted small">
          Mint the ERC-7857 token committing to <span className="mono">{version.slice(0, 10)}…</span> — pending
          the contract-deploy decision. Your personality is already encrypted &amp; owned on 0G above; the
          token adds on-chain identity + transfer.
        </p>
      </section>
    </>
  )
}
