/**
 * KIPR funder service (Phase 2 — sponsored onboarding).
 *
 * POST /fund  — body { address }, header Authorization: Bearer <Privy access token>.
 *   1. verify the Privy token → user DID (rejects anonymous/abusive callers)
 *   2. one drip per user (persisted)
 *   3. send a fixed amount of 0G from the sponsor wallet to the user's address
 *   4. return the tx hash
 * GET /health — liveness + sponsor balance + drips so far.
 *
 * The sponsor only SENDS native 0G. It never sees conversation content; inference
 * stays browser-direct (the user spends their own dripped funds via their own ledger).
 *
 * Run: pnpm --filter @kipr/server funder   (needs SPONSOR_PRIVATE_KEY, PRIVY_APP_ID,
 * PRIVY_APP_SECRET in .env, and a funded sponsor wallet).
 */
import express from 'express'
import cors from 'cors'
import { ethers } from 'ethers'
import { PrivyClient } from '@privy-io/server-auth'
import { getFunderConfig } from './config.js'
import { DripLog } from './drip-log.js'

async function main() {
  const cfg = getFunderConfig()
  const provider = new ethers.JsonRpcProvider(cfg.evmRpc, cfg.chainId)
  const sponsor = new ethers.Wallet(cfg.sponsorKey, provider)
  const privy = new PrivyClient(cfg.privyAppId, cfg.privyAppSecret)
  const log = new DripLog(cfg.dataFile)
  const dripWei = ethers.parseEther(cfg.dripOG)

  console.log(`▶ KIPR funder — sponsor ${sponsor.address}`)
  console.log(`  drip ${cfg.dripOG} 0G/user · ${log.count()} funded so far · origin ${cfg.webOrigin}`)

  const app = express()
  app.use(cors({ origin: cfg.webOrigin }))
  app.use(express.json())

  app.get('/health', async (_req, res) => {
    const bal = await provider.getBalance(sponsor.address).catch(() => 0n)
    res.json({
      ok: true,
      sponsor: sponsor.address,
      sponsorBalance0G: ethers.formatEther(bal),
      dripOG: cfg.dripOG,
      funded: log.count(),
    })
  })

  app.post('/fund', async (req, res) => {
    try {
      const auth = req.headers.authorization
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
      if (!token) return res.status(401).json({ error: 'Missing Privy access token.' })

      let userId: string
      try {
        const claims = await privy.verifyAuthToken(token, cfg.privyVerificationKey)
        userId = claims.userId
      } catch {
        return res.status(401).json({ error: 'Invalid or expired session.' })
      }

      const address = String(req.body?.address ?? '')
      if (!ethers.isAddress(address)) return res.status(400).json({ error: 'Invalid address.' })

      // One drip per user.
      const existing = log.get(userId)
      if (existing) {
        return res.status(200).json({ alreadyFunded: true, txHash: existing.txHash, amountOG: existing.amountOG })
      }

      // Don't re-fund a wallet that already has funds (cheap abuse/double-spend guard).
      const bal = await provider.getBalance(address)
      if (bal >= dripWei) {
        log.record(userId, { address, txHash: '(already funded)', amountOG: '0', at: new Date().toISOString() })
        return res.status(200).json({ alreadyFunded: true, amountOG: '0' })
      }

      const sponsorBal = await provider.getBalance(sponsor.address)
      if (sponsorBal < dripWei) {
        return res.status(503).json({ error: 'Funder is temporarily out of funds. Try again later.' })
      }

      const tx = await sponsor.sendTransaction({ to: address, value: dripWei })
      await tx.wait()
      log.record(userId, { address, txHash: tx.hash, amountOG: cfg.dripOG, at: new Date().toISOString() })
      console.log(`  funded ${userId} → ${address} (${cfg.dripOG} 0G, tx ${tx.hash})`)
      res.json({ txHash: tx.hash, amountOG: cfg.dripOG })
    } catch (e) {
      console.error('fund error:', (e as Error).message)
      res.status(500).json({ error: 'Funding failed. Please try again.' })
    }
  })

  app.listen(cfg.port, () => console.log(`  listening on http://localhost:${cfg.port}`))
}

main().catch((e) => {
  console.error('\n❌ Funder failed to start:', (e as Error).message)
  process.exit(1)
})
