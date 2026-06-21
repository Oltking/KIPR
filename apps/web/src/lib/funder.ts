/**
 * Client for the KIPR funder service — requests a one-time 0G drip so an embedded
 * (email/passkey) user can pay for storage without holding crypto. Sends the user's
 * Privy access token so the funder can verify them and cap to one drip per user.
 */
const FUNDER_URL = (import.meta.env.VITE_FUNDER_URL as string | undefined) || 'http://localhost:8787'

export interface FundResult {
  txHash?: string
  amountOG?: string
  alreadyFunded?: boolean
}

export async function requestFunding(accessToken: string, address: string): Promise<FundResult> {
  const res = await fetch(`${FUNDER_URL}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ address }),
  })
  const data = (await res.json().catch(() => ({}))) as FundResult & { error?: string }
  if (!res.ok) throw new Error(data?.error || `Funding failed (HTTP ${res.status}).`)
  return data
}
