/**
 * Browser ↔ 0G Storage. Uses the same SDK surface as @kipr/og (Indexer + MemData +
 * downloadToBlob) but with the injected-wallet SIGNER. MemData and downloadToBlob
 * are in-memory, so they work in the browser (unlike indexer.download, which needs fs).
 *
 * These move OPAQUE bytes — KIPR encrypts client-side (lib/crypto) BEFORE upload, so
 * 0G only ever sees ciphertext (the SDK's own encryption is unused here; our key is
 * wallet-signature-derived, which ECIES-to-self can't be in the browser).
 */
import type { JsonRpcSigner } from 'ethers'
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk'
import { OG_TESTNET } from './og'

function makeIndexer(): Indexer {
  return new Indexer(OG_TESTNET.indexerRpc)
}

/** Turn an opaque wallet/RPC submit failure into actionable guidance. */
function explainUploadError(raw: unknown): Error {
  const msg = (raw as { message?: string })?.message ?? String(raw)
  const code = (raw as { code?: number | string })?.code
  const looksLikeRpc =
    code === -32603 ||
    /endpoint not found or unavailable|RPC submit|could not coalesce|failed to fetch|ECONNREFUSED/i.test(msg)
  if (looksLikeRpc) {
    return new Error(
      `Your wallet couldn't submit the transaction to 0G. This is a wallet RPC problem, not your funds — ` +
        `MetaMask is using a stale endpoint for the 0G network. Fix it: open MetaMask → Networks → ` +
        `“0G-Galileo-Testnet” → set the RPC URL to ${OG_TESTNET.evmRpc} (remove any others), then retry. ` +
        `(The 0G network itself is up.)`,
    )
  }
  return new Error(`upload failed: ${msg}`)
}

export interface UploadRef {
  rootHash: string
  txHash: string
}

/** Upload opaque bytes to 0G. Bytes should already be encrypted for production data. */
export async function uploadBytes(signer: JsonRpcSigner, data: Uint8Array): Promise<UploadRef> {
  const indexer = makeIndexer()
  const mem = new MemData(data)
  const [tree, treeErr] = await mem.merkleTree()
  if (treeErr !== null || !tree) throw new Error(`merkleTree failed: ${treeErr ?? 'no tree'}`)

  const [res, upErr] = await indexer.upload(mem, OG_TESTNET.evmRpc, signer)
  if (upErr !== null) throw explainUploadError(upErr)
  // single result, or fragmented (>4GB) — narrow it.
  const rootHash = 'rootHashes' in res ? res.rootHashes[0] : res.rootHash
  const txHash = 'rootHashes' in res ? res.txHashes[0] : res.txHash
  return { rootHash, txHash }
}

/** Download opaque bytes from 0G by rootHash (in-memory, browser-safe). */
export async function downloadBytes(rootHash: string): Promise<Uint8Array> {
  const indexer = makeIndexer()
  const [blob, dlErr] = await indexer.downloadToBlob(rootHash, { proof: true })
  if (dlErr !== null) throw new Error(`download failed: ${dlErr.message ?? String(dlErr)}`)
  return new Uint8Array(await blob.arrayBuffer())
}

// ── P0 harness: a plaintext round-trip just to prove the pipe ──────────────────
export interface StorageRoundTrip {
  rootHash: string
  txHash: string
  uploadedBytes: number
  downloadedBytes: number
  match: boolean
}

export async function storageRoundTrip(signer: JsonRpcSigner, text: string): Promise<StorageRoundTrip> {
  const data = new TextEncoder().encode(text)
  const { rootHash, txHash } = await uploadBytes(signer, data)
  const downloaded = await downloadBytes(rootHash)
  const match = downloaded.length === data.length && downloaded.every((b, i) => b === data[i])
  return { rootHash, txHash, uploadedBytes: data.length, downloadedBytes: downloaded.length, match }
}
