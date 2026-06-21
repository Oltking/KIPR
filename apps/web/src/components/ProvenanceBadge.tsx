/**
 * The honest provenance affordance on every assistant message: 🔒 Private · the TEE
 * verification state · model. Tappable to reveal the full proof (model, personality
 * version, provider, chatID). We never show a checkmark we didn't earn — until the
 * compute grant lands, TEE state reads "pending", not "verified".
 */
import type { MessageProvenance } from '../lib/conversation-store'

const shortModel = (m: string) => m.split('/').pop() ?? m

export function ProvenanceBadge({ p, currentVersion }: { p: MessageProvenance; currentVersion?: string }) {
  const tee =
    p.teeVerified === true
      ? { cls: 'ok', label: '✓ TEE-verified' }
      : p.teeVerified === false
        ? { cls: 'error', label: '✕ unverified' }
        : { cls: 'pending', label: '◌ TEE pending' }
  const older = !!currentVersion && p.personalityVersion !== currentVersion

  return (
    <details className="prov">
      <summary>
        <span className="prov-lock">🔒 Private</span>
        <span className={`prov-tee ${tee.cls}`}>{tee.label}</span>
        <span className="prov-model">{shortModel(p.modelId)}</span>
        {older && <span className="prov-old">· earlier version</span>}
      </summary>
      <div className="prov-body">
        <div><span>model</span><code>{p.modelId}</code></div>
        <div><span>personality</span><code>{p.personalityVersion.slice(0, 18)}…</code></div>
        <div><span>provider</span><code>{p.providerAddr}</code></div>
        <div><span>chatID</span><code>{p.chatId ?? '—'}</code></div>
      </div>
    </details>
  )
}
