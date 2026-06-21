/**
 * Browser-direct 0G Compute — TEE-verified inference, KIPR's privacy core.
 *
 * Per 0G's browser guidance: the broker is created from the MetaMask signer, funding
 * is MANUAL + one-time (deposit + transfer, an explicit user step — never a mid-chat
 * popup), and inference goes straight from the browser to the TeeML provider. Our
 * server is never in the path, so conversation content is never harvested.
 *
 * processResponse() is the proof: it verifies the TEE signature over the reply, so a
 * `true` means the answer provably came from the genuine model inside the enclave.
 */
import type { JsonRpcSigner } from 'ethers'
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk'

export type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>

const ONE_0G = 10n ** 18n

export interface InferenceService {
  provider: string
  serviceType: string
  url: string
  model: string
  verifiability: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  content: string
  model: string
  provider: string
  chatID: string | null
  teeVerified: boolean | null
}

export async function createBroker(signer: JsonRpcSigner): Promise<Broker> {
  return createZGComputeNetworkBroker(signer)
}

/** Pick a verifiable (TeeML) chatbot provider — KIPR requires TeeML for production. */
export async function pickTeeMLProvider(broker: Broker, prefer?: string): Promise<InferenceService> {
  const services = (await broker.inference.listService()) as unknown as InferenceService[]
  const teeml = services.filter((s) => s.verifiability === 'TeeML')
  if (prefer) {
    const pinned = teeml.find((s) => s.provider.toLowerCase() === prefer.toLowerCase())
    if (pinned) return pinned
  }
  const chatbot = teeml.find((s) => s.serviceType === 'chatbot') ?? teeml[0]
  if (!chatbot) throw new Error('No TeeML (verifiable) provider is available on 0G right now.')
  return chatbot
}

export interface LedgerStatus {
  exists: boolean
  /** Total ledger balance in 0G (string for display). */
  balance0G: string
}

/** Is the user's compute ledger set up + funded? (Read-only, no popup.) */
export async function ledgerStatus(broker: Broker): Promise<LedgerStatus> {
  try {
    const ledger = (await broker.ledger.getLedger()) as unknown as { totalBalance?: bigint; balance?: bigint }
    const bal = ledger?.totalBalance ?? ledger?.balance ?? 0n
    return { exists: true, balance0G: (Number(bal) / 1e18).toFixed(4) }
  } catch {
    return { exists: false, balance0G: '0' }
  }
}

/**
 * One-time, explicit funding (the FundingPanel action): create/deposit the ledger,
 * then transfer to the provider sub-account. Two wallet confirmations. Browser never
 * auto-funds (that would pop the wallet mid-chat).
 */
export async function activateFunding(
  broker: Broker,
  provider: string,
  opts: { ledgerOG?: number; providerOG?: number } = {},
): Promise<void> {
  const ledgerOG = opts.ledgerOG ?? 3
  const providerOG = opts.providerOG ?? 1
  const status = await ledgerStatus(broker)
  if (!status.exists) {
    await broker.ledger.addLedger(ledgerOG)
  } else if (Number(status.balance0G) < ledgerOG) {
    await broker.ledger.depositFund(ledgerOG - Number(status.balance0G))
  }
  // transferFund also acknowledges the provider's TEE signer.
  await broker.ledger.transferFund(provider, 'inference', BigInt(providerOG) * ONE_0G)
}

/** Run one TEE-verified completion, returning the answer + provenance. Browser → provider direct. */
export async function chat(
  broker: Broker,
  service: InferenceService,
  messages: ChatMessage[],
): Promise<ChatResult> {
  const provider = service.provider
  const { endpoint, model } = await broker.inference.getServiceMetadata(provider)
  const signedContent = messages.map((m) => m.content).join('\n')
  const headers = await broker.inference.getRequestHeaders(provider, signedContent)

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers as unknown as Record<string, string>) },
    body: JSON.stringify({ model, messages }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Inference failed: HTTP ${response.status} ${body.slice(0, 200)}`)
  }
  const data: { choices?: { message?: { content?: string } }[]; id?: string; chatID?: string } =
    await response.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('Provider returned an empty response.')

  const chatID =
    response.headers.get('ZG-Res-Key') ||
    response.headers.get('zg-res-key') ||
    data?.id ||
    data?.chatID ||
    null
  const teeVerified = chatID ? await broker.inference.processResponse(provider, chatID, content) : null

  return { content, model, provider, chatID, teeVerified }
}
