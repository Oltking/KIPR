/**
 * P0 plumbing harness screen (throwaway). Proves the browser pipes:
 *   (a) wallet on 0G Galileo · (b) 0G Storage round-trip · (c) gated compute.
 */
import { useState } from 'react'
import { hasInjectedWallet, type Connection } from '../lib/wallet'
import { storageRoundTrip, type StorageRoundTrip } from '../lib/storage'
import { OG_TESTNET } from '../lib/og'
import { Dot, type Status } from '../components/Dot'

export function Harness({
  conn,
  walletStatus,
  walletErr,
  onConnect,
}: {
  conn: Connection | null
  walletStatus: Status
  walletErr: string
  onConnect: () => void
}) {
  const [storeStatus, setStoreStatus] = useState<Status>('idle')
  const [storeErr, setStoreErr] = useState('')
  const [result, setResult] = useState<StorageRoundTrip | null>(null)
  const [note, setNote] = useState('KIPR is private and yours.')

  async function onRoundTrip() {
    if (!conn) return
    setStoreStatus('busy')
    setStoreErr('')
    setResult(null)
    try {
      const r = await storageRoundTrip(conn.signer, `${note} · ${new Date().toISOString()}`)
      setResult(r)
      setStoreStatus(r.match ? 'ok' : 'error')
      if (!r.match) setStoreErr('Downloaded bytes did not match uploaded bytes.')
    } catch (e) {
      setStoreErr((e as Error).message)
      setStoreStatus('error')
    }
  }

  return (
    <>
      {/* (a) Wallet */}
      <section className={`card ${walletStatus}`}>
        <div className="card-h">
          <span className="step">a</span>
          <h2>Connect wallet</h2>
          <Dot status={walletStatus} />
        </div>
        {!hasInjectedWallet() && (
          <p className="muted">No injected wallet detected. Install MetaMask (or another EVM wallet).</p>
        )}
        {conn ? (
          <dl className="kv">
            <div><dt>address</dt><dd className="mono">{conn.address}</dd></div>
            <div><dt>chain</dt><dd>{conn.chainId === OG_TESTNET.chainId ? `${OG_TESTNET.name} (${conn.chainId})` : `⚠️ ${conn.chainId}`}</dd></div>
          </dl>
        ) : (
          <button onClick={onConnect} disabled={walletStatus === 'busy' || !hasInjectedWallet()}>
            {walletStatus === 'busy' ? 'Connecting…' : 'Connect'}
          </button>
        )}
        {walletErr && <p className="err">{walletErr}</p>}
      </section>

      {/* (b) Storage round-trip */}
      <section className={`card ${storeStatus}`}>
        <div className="card-h">
          <span className="step">b</span>
          <h2>0G Storage round-trip</h2>
          <Dot status={storeStatus} />
        </div>
        <p className="muted">
          Upload a blob to 0G, download by rootHash, verify the bytes match.{' '}
          <strong>Harness note:</strong> plaintext — production paths encrypt client-side.
        </p>
        <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} aria-label="blob contents" />
        <button onClick={onRoundTrip} disabled={!conn || storeStatus === 'busy'}>
          {storeStatus === 'busy' ? 'Storing → loading…' : 'Round-trip a blob'}
        </button>
        {!conn && <p className="muted">Connect a wallet first.</p>}
        {result && (
          <dl className="kv">
            <div><dt>rootHash</dt><dd className="mono">{result.rootHash}</dd></div>
            <div>
              <dt>tx</dt>
              <dd className="mono">
                <a href={`${OG_TESTNET.explorer}/tx/${result.txHash}`} target="_blank" rel="noreferrer">{result.txHash}</a>
              </dd>
            </div>
            <div><dt>bytes</dt><dd>{result.uploadedBytes} ↑ / {result.downloadedBytes} ↓</dd></div>
            <div><dt>match</dt><dd>{result.match ? '✓ identical' : '✗ mismatch'}</dd></div>
          </dl>
        )}
        {storeErr && <p className="err">{storeErr}</p>}
      </section>

      {/* (c) Compute — gated */}
      <section className="card gated">
        <div className="card-h">
          <span className="step">c</span>
          <h2>TEE-verified compute</h2>
          <span className="badge">gated</span>
        </div>
        <p className="muted">
          One TeeML chat completion with <code>processResponse → tee_verified</code>. Blocked until a
          0G Compute ledger (min <strong>3 0G</strong>) is funded — and in the browser, funding is an
          explicit user step, never a silent mid-chat popup. We won't show a checkmark we didn't earn.
        </p>
        <button disabled title="Requires a funded 0G Compute ledger (≥3 0G)">Run inference (locked)</button>
      </section>
    </>
  )
}
