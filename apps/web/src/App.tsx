/**
 * App shell — shared wallet connection + a lightweight screen switch.
 *   • Create  — P1 onboarding / companion creation (the warm front door)
 *   • Harness — P0 plumbing proof (wallet · storage · gated compute)
 * No router dependency needed for v1; a single piece of screen state is enough.
 */
import { useCallback, useState } from 'react'
import { connectWallet, type Connection } from './lib/wallet'
import { deriveOwnerKey, keyCheckValue } from './lib/crypto'
import { OG_TESTNET } from './lib/og'
import { CompanionCreator } from './screens/CompanionCreator'
import { Harness } from './screens/Harness'
import type { Status } from './components/Dot'

type Screen = 'create' | 'harness'

export function App() {
  const [conn, setConn] = useState<Connection | null>(null)
  const [walletStatus, setWalletStatus] = useState<Status>('idle')
  const [walletErr, setWalletErr] = useState('')
  const [screen, setScreen] = useState<Screen>('create')
  const [ownerKey, setOwnerKey] = useState<CryptoKey | null>(null)
  const [kcv, setKcv] = useState('')
  const [unlockStatus, setUnlockStatus] = useState<Status>('idle')
  const [unlockErr, setUnlockErr] = useState('')

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
    <main className="wrap">
      <header className="hd">
        <div className="hd-row">
          <div>
            <h1>KIPR</h1>
            <p className="sub">private · yours</p>
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
              {unlockStatus === 'busy' ? 'Sign in wallet…' : `🔒 Unlock ${short}`}
            </button>
          )}
        </div>
        {unlockErr && <p className="err">{unlockErr}</p>}
        <nav className="tabs">
          <button className={screen === 'create' ? 'tab on' : 'tab'} onClick={() => setScreen('create')}>Create</button>
          <button className={screen === 'harness' ? 'tab on' : 'tab'} onClick={() => setScreen('harness')}>Harness</button>
        </nav>
      </header>

      {screen === 'create' ? (
        <CompanionCreator conn={conn} ownerKey={ownerKey} onUnlock={onUnlock} unlockStatus={unlockStatus} />
      ) : (
        <Harness conn={conn} walletStatus={walletStatus} walletErr={walletErr} onConnect={onConnect} />
      )}

      <footer className="ft">
        <span>0G Galileo testnet · chainId {OG_TESTNET.chainId}</span>
      </footer>
    </main>
  )
}
