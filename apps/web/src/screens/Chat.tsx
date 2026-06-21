/**
 * P2 — the chat surface. The core companion experience: talk, and it remembers.
 *
 * Memory is real and owned: "Save to 0G" encrypts the conversation client-side and
 * appends it to the on-chain snapshot chain; "Reload from 0G" rebuilds it from the
 * head + your key alone — proving the conversation lives with you, not a server.
 *
 * Inference is honestly GATED: real replies require 0G Compute (TeeML + processResponse)
 * which needs a funded ledger (≥3 0G). Until then KIPR replies with a local preview
 * message — NO conversation content leaves your device, and no message claims a TEE
 * verification it didn't earn (provenance shows "pending").
 */
import { useEffect, useRef, useState } from 'react'
import type { Connection } from '../lib/wallet'
import {
  appendMessages,
  loadConversation,
  type MemoryMessage,
  type MessageProvenance,
} from '../lib/conversation-store'
import { ProvenanceBadge } from '../components/ProvenanceBadge'
import { CompanionOrb } from '../components/CompanionOrb'
import { OG_TESTNET } from '../lib/og'
import type { Status } from '../components/Dot'

export interface ActiveCompanion {
  ownerAddr: string
  name: string
  modelId: string
  version: string
}

const now = () => new Date().toISOString()
const headKey = (c: ActiveCompanion) => `kipr.conv.head.${c.ownerAddr}`

export function Chat({
  conn,
  ownerKey,
  companion,
}: {
  conn: Connection
  ownerKey: CryptoKey | null
  companion: ActiveCompanion
}) {
  const prov = (): MessageProvenance => ({
    modelId: companion.modelId,
    providerAddr: '0x0000000000000000000000000000000000000000',
    chatId: null,
    teeVerified: null, // compute gated → not yet verified; never faked
    personalityVersion: companion.version,
  })

  const [messages, setMessages] = useState<MemoryMessage[]>([
    {
      role: 'assistant',
      content: `Hi — I'm ${companion.name}. This space is just ours: private, and yours to keep. Tell me anything.`,
      createdAt: now(),
      provenance: prov(),
    },
  ])
  const [input, setInput] = useState('')
  const [head, setHead] = useState<string | null>(() => localStorage.getItem(headKey(companion)))
  const [savedCount, setSavedCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<Status>('idle')
  const [saveErr, setSaveErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const unsaved = messages.length - savedCount

  function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    const user: MemoryMessage = { role: 'user', content: text, createdAt: now() }
    // Local PREVIEW reply — no content leaves the device (real inference is gated).
    const reply: MemoryMessage = {
      role: 'assistant',
      content:
        `I've got that — and once my TEE compute is funded I'll think it through for real. ` +
        `For now I'm in preview, but your words are already safe with you.`,
      createdAt: now(),
      provenance: prov(),
    }
    setMessages((m) => [...m, user, reply])
  }

  async function onSave() {
    if (!ownerKey || unsaved <= 0) return
    setSaveStatus('busy')
    setSaveErr('')
    try {
      const delta = messages.slice(savedCount)
      const ref = await appendMessages(conn.signer, ownerKey, {
        companion: companion.ownerAddr,
        head,
        messages: delta,
      })
      setHead(ref.head)
      localStorage.setItem(headKey(companion), ref.head)
      setSavedCount(messages.length)
      setSaveStatus('ok')
    } catch (e) {
      setSaveErr((e as Error).message)
      setSaveStatus('error')
    }
  }

  async function onReload() {
    if (!ownerKey || !head) return
    setSaveStatus('busy')
    setSaveErr('')
    try {
      const restored = await loadConversation(ownerKey, head)
      setMessages(restored)
      setSavedCount(restored.length)
      setSaveStatus('ok')
    } catch (e) {
      setSaveErr((e as Error).message)
      setSaveStatus('error')
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <CompanionOrb size={40} state={saveStatus === 'busy' ? 'thinking' : 'idle'} />
        <div className="chat-id">
          <strong>{companion.name}</strong>
          <span className="muted small">🔒 private · owned on 0G</span>
        </div>
      </div>

      <div className="thread">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-text">{m.content}</div>
            {m.provenance && <ProvenanceBadge p={m.provenance} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <input
          className="inp"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Message ${companion.name}…`}
        />
        <button className="send" onClick={send} disabled={!input.trim()}>↑</button>
      </div>

      <div className="memrow">
        {!ownerKey ? (
          <p className="muted small">Unlock to save this conversation to 0G.</p>
        ) : (
          <>
            <button className="ghost" onClick={onSave} disabled={saveStatus === 'busy' || unsaved <= 0}>
              {saveStatus === 'busy' ? 'Encrypting → 0G…' : unsaved > 0 ? `Save ${unsaved} to 0G` : 'All saved ✓'}
            </button>
            <button className="ghost" onClick={onReload} disabled={saveStatus === 'busy' || !head}>
              Reload from 0G
            </button>
          </>
        )}
      </div>
      {head && (
        <p className="muted small center">
          memory head <a className="mono" href={`${OG_TESTNET.explorer}`} target="_blank" rel="noreferrer">{head.slice(0, 14)}…</a> · encrypted, yours
        </p>
      )}
      {saveErr && <p className="err">{saveErr}</p>}
    </div>
  )
}
