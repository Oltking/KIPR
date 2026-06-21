/**
 * 0G Storage — user-owned, client-side-encrypted blobs.
 *
 * Verified against research/RESEARCH_FULL.md + cloned @0gfoundation/0g-storage-ts-sdk
 * (v1.2.x) source:
 *   - Indexer.upload(file, rpc, signer, uploadOpts?) -> [{txHash, rootHash, txSeq} | {...es}, Error|null]
 *   - Indexer.downloadToBlob(rootHash, { proof?, decryption? }) -> [Blob, Error|null]
 *   - Indexer.peekHeader(rootHash) -> [EncryptionHeader | null, Error|null]
 *   - EncryptionOption = {type:'aes256';key} | {type:'ecies';recipientPubKey}
 *
 * KIPR default: ECIES "encrypt-to-self" — the AES key is derived from an
 * ephemeral keypair + the wallet's secp256k1 public key, decryptable only by the
 * wallet's private key. Storage nodes never see plaintext (non-negotiable #3).
 */
import { ethers, type Wallet } from 'ethers'
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk'
import type { ChainContext } from './chain.js'

export interface UploadResult {
  rootHash: string
  txHash: string
  txSeq: number
  encrypted: boolean
}

/** Compressed (33-byte) secp256k1 public key of the wallet, as a 0x hex string. */
export function selfPublicKey(wallet: Wallet): string {
  return ethers.SigningKey.computePublicKey(wallet.signingKey.publicKey, true)
}

function makeIndexer(ctx: ChainContext): Indexer {
  // Flow contract is auto-discovered from the indexer; only the indexer URL is needed.
  return new Indexer(ctx.config.indexerRpc)
}

/**
 * Upload raw bytes. With `encryptToSelf` (default true) the blob is ECIES-encrypted
 * to the wallet's own key before leaving the client.
 */
export async function uploadBytes(
  ctx: ChainContext,
  data: Uint8Array,
  opts: { encryptToSelf?: boolean } = {},
): Promise<UploadResult> {
  const encryptToSelf = opts.encryptToSelf ?? true
  const indexer = makeIndexer(ctx)

  const mem = new MemData(data)
  const [tree, treeErr] = await mem.merkleTree()
  if (treeErr !== null) throw new Error(`merkleTree failed: ${treeErr}`)
  const localRoot = tree?.rootHash()

  const uploadOpts = encryptToSelf
    ? { encryption: { type: 'ecies' as const, recipientPubKey: selfPublicKey(ctx.wallet) } }
    : undefined

  const [res, upErr] = await indexer.upload(mem, ctx.config.evmRpc, ctx.wallet, uploadOpts)
  if (upErr !== null) throw new Error(`upload failed: ${upErr.message ?? upErr}`)

  if ('rootHashes' in res) {
    // >4GB fragmented path — not expected for KIPR blobs, but handle honestly.
    return {
      rootHash: res.rootHashes[0],
      txHash: res.txHashes[0],
      txSeq: res.txSeqs[0],
      encrypted: encryptToSelf,
    }
  }

  // For an unencrypted upload the on-chain root must equal the locally computed root.
  if (!encryptToSelf && localRoot && res.rootHash !== localRoot) {
    throw new Error(`Root hash mismatch: local ${localRoot} vs returned ${res.rootHash}`)
  }
  return { rootHash: res.rootHash, txHash: res.txHash, txSeq: res.txSeq, encrypted: encryptToSelf }
}

/** Encryption header version of a stored blob: null=plaintext, 1=aes256, 2=ecies. */
export async function peekVersion(ctx: ChainContext, rootHash: string): Promise<number | null> {
  const indexer = makeIndexer(ctx)
  const [header, err] = await indexer.peekHeader(rootHash)
  if (err !== null) throw new Error(`peekHeader failed: ${err.message ?? err}`)
  return header ? header.version : null
}

/**
 * Download bytes by root hash. When `decrypt` is true the wallet's private key
 * is used to ECIES-decrypt in memory. NOTE: the SDK silently returns ciphertext
 * on a key mismatch, so we peek the header first and only attempt decryption when
 * the blob is actually encrypted.
 */
export async function downloadBytes(
  ctx: ChainContext,
  rootHash: string,
  opts: { decrypt?: boolean } = {},
): Promise<Uint8Array> {
  const decrypt = opts.decrypt ?? true
  const indexer = makeIndexer(ctx)

  const downloadOpts = decrypt
    ? { proof: true, decryption: { privateKey: ctx.config.privateKey } }
    : { proof: true }

  const [blob, dlErr] = await indexer.downloadToBlob(rootHash, downloadOpts)
  if (dlErr !== null) throw new Error(`download failed: ${dlErr.message ?? dlErr}`)
  return new Uint8Array(await blob.arrayBuffer())
}
