/**
 * App shell — KIPR's product surface. A warm hero invites you in; once you're
 * connected + unlocked, you create and own your companion. The P0 plumbing harness
 * still exists but is demoted to a "developer tools" view off the footer, so the
 * primary experience reads like a companion, not a test bench.
 */
import { useCallback, useState } from 'react'
import { connectWallet, hasInjectedWallet, type Connection } from './lib/wallet'
import { deriveOwnerKey, keyCheckValue } from './lib/crypto'
import { OG_TESTNET } from './lib/og'
import { CompanionCreator } from './screens/CompanionCreator'
import { Chat, type ActiveCompanion } from './screens/Chat'
import { Harness } from './screens/Harness'
import { CompanionOrb } from './components/CompanionOrb'
import type { Status } from './components/Dot'

type View = 'create' | 'chat'

export function App() {
  const [conn, setConn] = useState<Connection | null>(null)
  const [walletStatus, setWalletStatus] = useState<Status>('idle')
  const [walletErr, setWalletErr] = useState('')
  const [ownerKey, setOwnerKey] = useState<CryptoKey | null>(null)
  const [kcv, setKcv] = useState('')
  const [unlockStatus, setUnlockStatus] = useState<Status>('idle')
  const [unlockErr, setUnlockErr] = useState('')
  const [showDev, setShowDev] = useState(false)
  const [companion, setCompanion] = useState<ActiveCompanion | null>(null)
  const [view, setView] = useState<View>('create')

  const onConnect = useCallback(async () => {
    setWalletStatus('busy')
    setWalletErr('')
    try {
      setConn(await connectWallet())
      setWalletStatus('ok')
    } catch (e) {
      setWalletErr((e as Error).message)
      setWalletStatus('error')
    }
  }, [])

  const onUnlock = useCallback(async () => {
    if (!conn) return
    setUnlockStatus('busy')
    setUnlockErr('')
    try {
      const key = await deriveOwnerKey(conn.signer, conn.address)
      setOwnerKey(key)
      setKcv(await keyCheckValue(key))
      setUnlockStatus('ok')
    } catch (e) {
      setUnlockErr((e as Error).message)
      setUnlockStatus('error')
    }
  }, [conn])

  const short = conn ? `${conn.address.slice(0, 6)}…${conn.address.slice(-4)}` : null

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
      </div>

      <main className="wrap">
        {/* ── HERO (pre-connect) ───────────────────────────────────────────── */}
        {!conn && !showDev ? (
          <section className="hero">
            <CompanionOrb size={150} state="idle" />
            <h1 className="brand">KIPR</h1>
            <p className="tagline">A companion that's truly yours.</p>
            <p className="lede">
              Private by design — your conversations run in a sealed enclave, and your companion's
              memory &amp; personality live in storage <em>you</em> own. No company can read it, change
              it, or take it away.
            </p>
            <button className="cta" onClick={onConnect} disabled={walletStatus === 'busy' || !hasInjectedWallet()}>
              {walletStatus === 'busy' ? 'Connecting…' : hasInjectedWallet() ? 'Begin' : 'Install a wallet to begin'}
            </button>
            {!hasInjectedWallet() && <p className="muted small">KIPR needs an EVM wallet like MetaMask.</p>}
            {walletErr && <p className="err">{walletErr}</p>}
            <div className="trust">
              <span>🔒 TEE-private</span>
              <span>🔑 You hold the keys</span>
              <span>♾️ Yours to keep</span>
            </div>
          </section>
        ) : (
          <>
            {/* ── HEADER (connected) ─────────────────────────────────────────── */}
            <header className="hd">
              <div className="hd-row">
                <div className="hd-brand">
                  <CompanionOrb size={42} state={unlockStatus === 'busy' ? 'thinking' : 'idle'} />
                  <div>
                    <h1 className="brand sm">KIPR</h1>
                    <p className="sub">private · yours</p>
                  </div>
                </div>
                {!conn ? (
                  <button className="chip-btn" onClick={onConnect} disabled={walletStatus === 'busy'}>
                    {walletStatus === 'busy' ? 'Connecting…' : 'Connect'}
                  </button>
                ) : ownerKey ? (
                  <span className="chip" title={`${conn.address}\nkey ${kcv}`}>
                    <span className="statusdot ok" /> {short} · 🔓
                  </span>
                ) : (
                  <button className="chip-btn" onClick={onUnlock} disabled={unlockStatus === 'busy'} title="Sign once to derive your encryption key">
                    {unlockStatus === 'busy' ? 'Sign in wallet…' : `🔒 Unlock`}
                  </button>
                )}
              </div>
              {unlockErr && <p className="err">{unlockErr}</p>}
              {companion && !showDev && (
                <nav className="tabs">
                  <button className={view === 'chat' ? 'tab on' : 'tab'} onClick={() => setView('chat')}>Chat</button>
                  <button className={view === 'create' ? 'tab on' : 'tab'} onClick={() => setView('create')}>Companion</button>
                </nav>
              )}
            </header>

            {showDev ? (
              <Harness conn={conn} walletStatus={walletStatus} walletErr={walletErr} onConnect={onConnect} />
            ) : companion && view === 'chat' && conn ? (
              <Chat conn={conn} ownerKey={ownerKey} companion={companion} />
            ) : (
              <CompanionCreator
                conn={conn}
                ownerKey={ownerKey}
                onUnlock={onUnlock}
                unlockStatus={unlockStatus}
                onCompanionReady={(c) => {
                  setCompanion(c)
                  setView('chat')
                }}
              />
            )}
          </>
        )}

        <footer className="ft">
          <span className="ftdot" /> 0G Galileo testnet · chainId {OG_TESTNET.chainId}
          <button className="devlink" onClick={() => setShowDev((v) => !v)}>
            {showDev ? '← back to KIPR' : 'developer tools'}
          </button>
        </footer>
      </main>
    </>
  )
}
