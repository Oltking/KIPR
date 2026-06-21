/**
 * P4 — "Yours": export, restore, delete. The surfaces that make ownership tangible.
 *
 * Export  — pull your companion + conversation from 0G, decrypt locally, download a
 *           readable file. Yours, readable by you alone.
 * Restore — import an export file (integrity-verified) and re-seat the companion.
 * Delete  — a deliberate two-step guard (non-negotiable #7). Honest about on-chain
 *           permanence: the encrypted blobs persist on 0G but are useless without your
 *           key — discarding the key/pointers is a cryptographic erasure.
 */
import { useRef, useState } from 'react'
import type { Connection } from '../lib/wallet'
import { buildExport, downloadJson, parseExport, type KiprExport } from '../lib/export'
import { conversationHeadKey, type ActiveCompanion } from './Chat'
import type { Status } from '../components/Dot'

export function Vault({
  conn,
  ownerKey,
  companion,
  onRestore,
  onDelete,
}: {
  conn: Connection
  ownerKey: CryptoKey | null
  companion: ActiveCompanion | null
  onRestore: (exp: KiprExport) => void
  onDelete: () => void
}) {
  const [exportStatus, setExportStatus] = useState<Status>('idle')
  const [exportErr, setExportErr] = useState('')
  const [importErr, setImportErr] = useState('')
  const [importOk, setImportOk] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onExport() {
    if (!ownerKey || !companion) return
    setExportStatus('busy')
    setExportErr('')
    try {
      const head = localStorage.getItem(conversationHeadKey(companion.ownerAddr))
      const bundle = await buildExport(ownerKey, {
        owner: conn.address.toLowerCase(),
        personalityRootHash: companion.personalityRootHash,
        conversationHead: head,
      })
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(bundle, `kipr-${companion.name.toLowerCase()}-${date}.json`)
      setExportStatus('ok')
    } catch (e) {
      setExportErr((e as Error).message)
      setExportStatus('error')
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportErr('')
    setImportOk('')
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const exp = parseExport(await file.text())
      onRestore(exp)
      setImportOk(`Restored ${exp.companion.name} — ${exp.conversation.length} messages, integrity verified.`)
    } catch (err) {
      setImportErr((err as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <section className="intro">
        <h2 className="intro-h">Yours to keep</h2>
        <p className="intro-p">
          Take your companion with you, bring one back, or truly let go. No lock-in — this is the whole
          point of KIPR.
        </p>
      </section>

      {/* Export */}
      <section className={`card ${exportStatus}`}>
        <div className="card-h">
          <span className="step">↓</span>
          <h2>Export</h2>
        </div>
        <p className="muted small">
          Download a decrypted, readable copy of {companion ? companion.name : 'your companion'} —
          personality + full conversation, pulled from 0G and unlocked with your key.
        </p>
        {!ownerKey ? (
          <p className="muted">Unlock to export.</p>
        ) : !companion ? (
          <p className="muted">Create a companion first.</p>
        ) : (
          <button onClick={onExport} disabled={exportStatus === 'busy'}>
            {exportStatus === 'busy' ? 'Gathering from 0G…' : 'Export my companion'}
          </button>
        )}
        {exportStatus === 'ok' && <div className="okbox"><p>✓ Downloaded. That file is readable by you alone.</p></div>}
        {exportErr && <p className="err">{exportErr}</p>}
      </section>

      {/* Restore */}
      <section className="card">
        <div className="card-h">
          <span className="step">↑</span>
          <h2>Restore</h2>
        </div>
        <p className="muted small">
          Bring a companion back from an export file — on a new device or wallet. We verify its integrity
          before trusting it.
        </p>
        <button onClick={() => fileRef.current?.click()}>Choose export file…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onPickFile} style={{ display: 'none' }} />
        {importOk && <div className="okbox"><p>✓ {importOk}</p></div>}
        {importErr && <p className="err">{importErr}</p>}
      </section>

      {/* Delete */}
      <section className="card danger">
        <div className="card-h">
          <span className="step danger-step">⚠</span>
          <h2>Delete locally</h2>
        </div>
        <p className="muted small">
          Removes this companion and its memory pointers from this device. The encrypted blobs on 0G
          can’t be un-published from a decentralized network — but they’re useless without your key, so
          letting go of the key is a real, cryptographic erasure. <strong>Export first</strong> if you
          might want it back.
        </p>
        {!confirmDelete ? (
          <button className="ghost danger-btn" onClick={() => setConfirmDelete(true)} disabled={!companion}>
            Delete companion
          </button>
        ) : (
          <div className="confirm">
            <p className="muted small"><strong>Are you sure?</strong> This clears it from this device.</p>
            <div className="confirm-row">
              <button className="danger-btn" onClick={() => { onDelete(); setConfirmDelete(false) }}>Yes, delete</button>
              <button className="ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
