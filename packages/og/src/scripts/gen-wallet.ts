/**
 * One-off: generate a fresh testnet wallet and write its key into the repo-root
 * .env (ZG_PRIVATE_KEY). The private key is NEVER printed — only the address,
 * which you fund at faucet.0g.ai. Refuses to overwrite an already-set key
 * unless FORCE=1 (so you can't clobber a funded wallet by accident).
 */
import { Wallet } from 'ethers'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(here, '../../../../.env')

let env = readFileSync(envPath, 'utf8')
const current = env.match(/^ZG_PRIVATE_KEY=(.*)$/m)?.[1]?.trim() ?? ''
const isSet = current !== '' && !current.includes('your_')
if (isSet && process.env.FORCE !== '1') {
  console.error(
    'ZG_PRIVATE_KEY is already set. Re-run with FORCE=1 to overwrite ' +
      '(will abandon any funds on the old wallet).',
  )
  process.exit(1)
}

const w = Wallet.createRandom()
env = /^ZG_PRIVATE_KEY=.*$/m.test(env)
  ? env.replace(/^ZG_PRIVATE_KEY=.*$/m, `ZG_PRIVATE_KEY=${w.privateKey}`)
  : env + `\nZG_PRIVATE_KEY=${w.privateKey}\n`
writeFileSync(envPath, env, { mode: 0o600 })

console.log('Fresh wallet written to .env (private key NOT shown).')
console.log('FUND THIS ADDRESS:', w.address)
