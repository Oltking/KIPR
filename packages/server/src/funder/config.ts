/**
 * Funder service config (Phase 2 — sponsored onboarding).
 *
 * A SPONSOR wallet drips a one-time bit of 0G to each verified new user so their
 * embedded wallet can pay for storage (and optionally open a compute ledger). The
 * sponsor only ever SENDS funds — it never touches conversation content, so inference
 * stays browser-direct and private.
 *
 * Loads from the repo-root .env. Fails loud if a required secret is missing — per the
 * non-negotiable "stop and ask; never stub around a missing credential."
 */
import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')
loadDotenv({ path: resolve(repoRoot, '.env') })

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '' || v.includes('your_')) {
    throw new Error(`Missing required env var ${name}. Set it in .env before running the funder.`)
  }
  return v.trim()
}

function optional(name: string, fallback: string): string {
  const v = process.env[name]
  return v && v.trim() !== '' ? v.trim() : fallback
}

export interface FunderConfig {
  port: number
  evmRpc: string
  chainId: number
  /** Sponsor wallet private key — a DEDICATED wallet, not a user's. Secret. */
  sponsorKey: string
  privyAppId: string
  privyAppSecret: string
  /** Optional: paste from Privy dashboard to skip a verification-key fetch per request. */
  privyVerificationKey?: string
  /** 0G dripped per user (string for parseEther). */
  dripOG: string
  /** Allowed browser origin for CORS. */
  webOrigin: string
  /** Where the one-drip-per-user log is persisted. */
  dataFile: string
}

let cached: FunderConfig | null = null

export function getFunderConfig(): FunderConfig {
  if (cached) return cached
  cached = {
    port: Number(optional('FUNDER_PORT', '8787')),
    evmRpc: optional('ZG_EVM_RPC', 'https://evmrpc-testnet.0g.ai'),
    chainId: Number(optional('ZG_CHAIN_ID', '16602')),
    sponsorKey: required('SPONSOR_PRIVATE_KEY'),
    privyAppId: required('PRIVY_APP_ID'),
    privyAppSecret: required('PRIVY_APP_SECRET'),
    privyVerificationKey: process.env.PRIVY_VERIFICATION_KEY?.trim() || undefined,
    dripOG: optional('FUNDER_DRIP_OG', '0.1'),
    webOrigin: optional('FUNDER_WEB_ORIGIN', 'http://localhost:5173'),
    dataFile: optional('FUNDER_DATA_FILE', resolve(repoRoot, '.funder-drips.json')),
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(cached.sponsorKey)) {
    throw new Error('SPONSOR_PRIVATE_KEY must be a 0x-prefixed 32-byte private key.')
  }
  return cached
}
