/**
 * Browser ↔ 0G Storage round-trip (P0 plumbing proof).
 *
 * Uses the same SDK surface as @kipr/og (Indexer + MemData + downloadToBlob), but
 * with the injected-wallet SIGNER instead of a server-held private key. MemData and
 * downloadToBlob are in-memory, so they work in the browser (unlike indexer.download
 * which needs fs).
 *
 * ⚠️ P0 HARNESS ONLY — this stores PLAINTEXT to prove the pipe. Production paths
 * (P1/P2) MUST encrypt client-side before upload (non-negotiable #3). Client-side
 * ECIES from an injected wallet needs the user's pubkey (derivable from a signature)
 * and is built deliberately in a later phase — not faked here.
 */
import type { JsonRpcSigner } from 'ethers'
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk'
import { OG_TESTNET } from './og'

export interface StorageRoundTrip {
  rootHash: string
  txHash: string
  uploadedBytes: number
  downloadedBytes: number
  match: boolean
  encrypted: false
}

function makeIndexer(): Indexer {
  return new Indexer(OG_TESTNET.indexerRpc)
}

/** Upload bytes, then download by rootHash and verify they match. PLAINTEXT (harness). */
export async function storageRoundTrip(
  signer: JsonRpcSigner,
  text: string,
): Promise<StorageRoundTrip> {
  const indexer = makeIndexer()
  const data = new TextEncoder().encode(text)

  const mem = new MemData(data)
  const [tree, treeErr] = await mem.merkleTree()
  if (treeErr !== null || !tree) throw new Error(`merkleTree failed: ${treeErr ?? 'no tree'}`)

  const [res, upErr] = await indexer.upload(mem, OG_TESTNET.evmRpc, signer)
  if (upErr !== null) throw new Error(`upload failed: ${upErr.message ?? String(upErr)}`)
  // upload returns a single result or (for >4GB) a fragmented one — narrow it.
  const rootHash = 'rootHashes' in res ? res.rootHashes[0] : res.rootHash
  const txHash = 'rootHashes' in res ? res.txHashes[0] : res.txHash

  const [blob, dlErr] = await indexer.downloadToBlob(rootHash, { proof: true })
  if (dlErr !== null) throw new Error(`download failed: ${dlErr.message ?? String(dlErr)}`)
  const downloaded = new Uint8Array(await blob.arrayBuffer())

  const match =
    downloaded.length === data.length && downloaded.every((b, i) => b === data[i])

  return {
    rootHash,
    txHash,
    uploadedBytes: data.length,
    downloadedBytes: downloaded.length,
    match,
    encrypted: false,
  }
}
