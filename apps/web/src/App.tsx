/**
 * P0 plumbing harness (throwaway UI). Proves the pipes the rest of KIPR builds on:
 *   (a) connect wallet on 0G Galileo testnet
 *   (b) round-trip a blob through 0G Storage (rootHash + tx, bytes match)
 *   (c) TEE-verified compute — honestly GATED until a ≥3 0G ledger is funded
 *
 * Not the product UI. Per FRONTEND_ATTACK_PLAN, this is the proof harness; the warm,
 * companion-facing surfaces come in P1+.
 */
import { useState } from 'react'
import { connectWallet, hasInjectedWallet, type Connection } from './lib/wallet'
import { storageRoundTrip, type StorageRoundTrip } from './lib/storage'
import { OG_TESTNET } from './lib/og'

type Status = 'idle' | 'busy' | 'ok' | 'error'

export function App() {
  const [conn, setConn] = useState<Connection | null>(null)
  const [walletStatus, setWalletStatus] = useState<Status>('idle')
  const [walletErr, setWalletErr] = useState<string>('')

  const [storeStatus, setStoreStatus] = useState<Status>('idle')
  const [storeErr, setStoreErr] = useState<string>('')
  const [result, setResult] = useState<StorageRoundTrip | null>(null)
  const [note, setNote] = useState('KIPR is private and yours.')

  async function onConnect() {
    setWalletStatus('busy')
    setWalletErr('')
    try {
      setConn(await connectWallet())
      setWalletStatus('ok')
    } catch (e) {
      setWalletErr((e as Error).message)
      setWalletStatus('error')
    }
  }

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
    <main className="wrap">
      <header className="hd">
        <h1>KIPR</h1>
        <p className="sub">private · yours — P0 plumbing harness</p>
      </header>

      {/* (a) Wallet */}
      <section className={`card ${walletStatus}`}>
        <div className="card-h">
          <span className="step">a</span>
          <h2>Connect wallet</h2>
          <Dot status={walletStatus} />
        </div>
        {!hasInjectedWallet() && (
          <p className="muted">
            No injected wallet detected. Install MetaMask (or another EVM wallet) to use this harness.
          </p>
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
          Upload a blob to 0G, download it by rootHash, verify the bytes match.{' '}
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
          explicit user step, never a silent mid-chat popup. We won't show a verification checkmark we
          didn't earn.
        </p>
        <button disabled title="Requires a funded 0G Compute ledger (≥3 0G)">Run inference (locked)</button>
      </section>

      <footer className="ft">
        <span>0G Galileo testnet · chainId {OG_TESTNET.chainId}</span>
      </footer>
    </main>
  )
}

function Dot({ status }: { status: Status }) {
  const label = status === 'ok' ? 'ok' : status === 'error' ? 'error' : status === 'busy' ? 'working' : 'idle'
  return <span className={`statusdot ${status}`} aria-label={label} title={label} />
}
