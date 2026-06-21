# KIPR — API Appendix (verified 0G signatures)

> Every signature below was taken from `research/RESEARCH_FULL.md` (harvested 2026-06-19 from docs.0g.ai and the 0gfoundation GitHub repos). **Verify against live docs before relying on it.** ⚠️ marks a known discrepancy in 0G's own sources.

---

## 1. 0G Compute — Direct path (`@0gfoundation/0g-compute-ts-sdk`)

**Install:** `pnpm add @0gfoundation/0g-compute-ts-sdk` · **Node >= 22** (README says ≥20; inference doc says ≥22 — use 22). Browser needs `vite-plugin-node-polyfills` for `crypto, stream, util, buffer, process`.

### Create broker
```ts
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker   = await createZGComputeNetworkBroker(wallet);
// Browser: use BrowserProvider(window.ethereum) + signer instead of a raw wallet.
```

### Ledger / funding (`broker.ledger`)
```ts
await broker.ledger.depositFund(10);                  // deposit to main account (min 3 0G to create ledger)
await broker.ledger.transferFund(providerAddress, 'inference', BigInt(1) * BigInt(10 ** 18)); // ≥1 0G per provider; auto-acknowledges the provider's TEE signer
```
- Node.js: SDK background auto-funds provider sub-accounts from the ledger.
- **Browser: no auto-funding** — you must `depositFund` then `transferFund` manually (avoids mid-chat wallet popups).
- Fees use **delayed batch settlement** — sub-account balance can drop in lumps; total always equals actual usage.

### Discover services / models (`broker.inference`)
```ts
const services = await broker.inference.listService();          // all providers/services
const chatbots = services.filter(s => s.serviceType === 'chatbot');
const catalog  = await broker.inference.getProviderModels(providerAddress); // {multiModel, models:[{id, canonical_id?, type?}]}
```
Each service declares a **verification mode**: `TeeML` (model runs in the TEE; responses signed by the TEE key — **use this for KIPR**) or `TeeTLS` (broker-in-TEE proxies a centralized LLM).

### Verify a provider's TEE attestation (optional, recommended once per provider)
```ts
const result = await broker.inference.verifyService(
  providerAddress,
  './reports',
  (step) => console.log(step.message)
);
// result.signerVerification.allMatch, result.composeVerification.passed, result.dockerImages, result.outputDirectory
```
Automated checks cover signer-address match + compose-hash. Full verification also needs the manual dstack-verifier + sigstore steps noted in the output.

### Make an inference request (OpenAI-compatible, wallet-signed headers)
```ts
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress); // model = provider default; pass a modelId to pick another
const headers = await broker.inference.getRequestHeaders(providerAddress);

const response = await fetch(`${endpoint}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ model, messages: [{ role: "user", content: "Hello!" }] }),
});
const data = await response.json();
const answer = data.choices[0].message.content;
```

### Verify the response came from the genuine TEE (the "no silent swap" check)
```ts
let chatID = response.headers.get("ZG-Res-Key") || response.headers.get("zg-res-key");
if (!chatID) chatID = data.id || data.chatID;        // chatbot fallback
if (chatID) {
  const isValid = await broker.inference.processResponse(providerAddress, chatID); // boolean
  // store isValid as messages.tee_verified
}
```
- `processResponse` is optional in the SDK but **mandatory for KIPR** — it's the proof. Without a `chatID` it returns `null` (skipped).
- Streaming: read the stream, parse `id`/`chatID` from the SSE lines as fallback if the header is absent, then call `processResponse`.

### Acknowledge provider (only if not funding via transferFund)
```ts
await broker.inference.acknowledgeProviderSigner(providerAddress);
```

### Rate limits (per provider, default)
30 req/min sustained, burst 5, 5 concurrent → HTTP 429 on exceed.

### Router fallback (NOT the verified path — label in UI if used)
OpenAI-compatible, single API key (`app-sk-...`), base URL `https://router-api.0g.ai/v1`. One unified balance, auto failover. Get a key at `pc.0g.ai`.

---

## 2. 0G Storage — TypeScript SDK (`@0gfoundation/0g-storage-ts-sdk`)

**Install:** `npm install @0gfoundation/0g-storage-ts-sdk ethers` · **Encryption requires v1.2.6+.**

### Init
```ts
import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';

const RPC_URL     = 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai'; // turbo (faster); standard network uses a different indexer
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer   = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const indexer  = new Indexer(INDEXER_RPC); // flow contract auto-discovered
```

### Upload a file
```ts
const file = await ZgFile.fromFilePath(filePath);
const [tree, treeErr] = await file.merkleTree();      // MUST call before upload
if (treeErr !== null) throw new Error(treeErr);
const rootHash = tree?.rootHash();
const [tx, upErr] = await indexer.upload(file, RPC_URL, signer);
await file.close();                                   // always close
// tx is { rootHash, txHash } or, for >4GB, { rootHashes, txHashes }
```

### Upload in-memory data (no disk)
```ts
const data    = new TextEncoder().encode('Hello, 0G!');
const memData = new MemData(data);
await memData.merkleTree();
const [tx, err] = await indexer.upload(memData, RPC_URL, signer);
```

### Download
```ts
const err = await indexer.download(rootHash, outputPath, true); // withProof=true → Merkle verification
// NOTE: indexer.download uses fs and does NOT work in the browser.
```

### Encryption (client-side, v1.2.6+) — the user-owned-key requirement
**ECIES encrypt-to-self (recommended for KIPR — wallet key does both signing and decryption):**
```ts
import { ZgFile, Indexer } from '@0gfoundation/0g-storage-ts-sdk';
const recipientPubKey = ethers.SigningKey.computePublicKey(wallet.signingKey.publicKey, true); // compressed 33-byte
const file = await ZgFile.fromFilePath('./memory.json');
const [tx, err] = await indexer.upload(file, RPC_URL, signer, {
  encryption: { type: 'ecies', recipientPubKey },
});
// decrypt
const [blob, dlErr] = await indexer.downloadToBlob(rootHash, {
  proof: true,
  decryption: { privateKey },
});
```
**AES-256 (32-byte symmetric key you manage):**
```ts
const key = crypto.getRandomValues(new Uint8Array(32)); // SAVE THIS — no server-side recovery
await indexer.upload(file, RPC_URL, signer, { encryption: { type: 'aes256', key } });
await indexer.downloadToBlob(rootHash, { proof: true, decryption: { symmetricKey: key } });
```
- ⚠️ Wrong key does **not** throw — `downloadToBlob` silently returns ciphertext. Call `indexer.peekHeader(rootHash)` first (`null`=plaintext, `version 1`=aes256, `version 2`=ecies).
- `indexer.download()` does not decrypt — always use `downloadToBlob()` for encrypted files (buffers fully in memory).

### Browser
```ts
import { Blob as ZgBlob, Indexer } from '@0gfoundation/0g-storage-ts-sdk';
const zgBlob = new ZgBlob(fileInput.files[0]);
await zgBlob.merkleTree();
const [tx, err] = await indexer.upload(zgBlob, RPC_URL, signer);
// Browser downloads: indexer.download() won't work; use StorageNode.downloadSegmentByTxSeq()
// and reassemble in memory — see the ts-starter-kit web/src/storage.ts.
```
Bundler: needs `vite-plugin-node-polyfills` + stub aliases (SDK imports `fs`/`crypto` at load). See starter-kit `web/vite.config.ts`.

---

## 3. ERC-7857 "Agent NFT" (owned companion identity)

A proposed NFT standard for AI agents whose **private metadata** transfers in a privacy-preserving, verifiable way (unlike ERC-721). Core idea: `transfer()` accepts a **proof** produced by a TEE (or ZKP) oracle that re-encrypts the metadata under the receiver's key and emits a `sealedKey` the receiver can open with their private key.

Key operations (from the standard's README — confirm exact Solidity signatures against the `0g-agent-nft` repo source before coding):
- `transfer(...)` — moves ownership **and** re-seals private metadata to the new owner via the oracle proof (`oldDataHash` → `newDataHash`, plus `sealedKey`).
- `clone(...)` — like transfer but mints a *new* token with the same metadata.
- `authorizeUsage(...)` — grants the right to *use* the private metadata (via a sealed executor: TEE or FHE) without granting access to read it.

For KIPR: the companion is an ERC-7857 token owned by the user's wallet; the personality config is the private metadata. "Take it with you / no one can alter it" = these transfer/clone semantics. ⚠️ Pull the canonical interface + deployed contract addresses from the repo and the `agentic-id/erc7857` + `agentic-id/integration` docs (both in `research/`) before implementing — the README describes the scheme, not a frozen ABI.

---

## 4. Memory — 0g-memory (EverMemOS) and 0gmem

### 0g-memory (EverMemOS) — encrypted, on-chain, user-keyed
- Writes every memory to 0G Storage via the storage SDK, **encrypted with a key only the user holds**, persisted on-chain; a local `zgs_kv` node acts as a read cache and re-syncs from chain on a new machine.
- Backend exposes a REST API at `http://localhost:1995` (health: `GET /health`).
- Multi-user/server mode: `SERVER_MODE=true` enforces Bearer API-key auth; per-user namespace; user registration:
  ```bash
  curl -X POST http://localhost:1995/api/v1/users/register \
    -H 'Content-Type: application/json' \
    -d '{"user_id":"alice","zerog_wallet_key":"<hex key>"}'
  # → { user_id, api_key }  (api_key shown once)
  ```
- Each user supplies their own `ZEROG_WALLET_KEY` (64-char hex, Galileo testnet). Uses EverMemOS over MongoDB/Elasticsearch/Milvus/Redis (Docker) for indexing.
- Can run inference on a **0G-hosted GLM model** instead of OpenAI:
  ```bash
  LLM_API_KEY=app-sk-<key>
  LLM_MODEL=zai-org/GLM-5-FP8
  LLM_BASE_URL=https://compute-network-1.integratenetwork.work/v1/proxy
  ```

### 0gmem — lighter structured memory (fallback / option)
- `pip install -e .` then `python -m spacy download en_core_web_sm`.
- Python API:
  ```python
  from zerogmem import MemoryManager, Encoder, Retriever
  memory = MemoryManager(); encoder = Encoder()
  memory.set_embedding_function(encoder.get_embedding)
  retriever = Retriever(memory, embedding_fn=encoder.get_embedding)
  memory.start_session(); memory.add_message("Alice", "..."); memory.end_session()
  result = retriever.retrieve("When did Alice visit the Alps?")
  ```
- Ships as an **MCP server**: `python -m zerogmem.mcp_server` (tools include `store_memory`, `retrieve_memories`, `search_memories_by_entity`, `search_memories_by_time`, `export_memory`, `import_memory`, `clear_all_memories`). `export_memory`/`import_memory` give portable backup/restore (useful for P4).

---

## 5. Network constants (verified)

| | Testnet (Galileo) | Mainnet (Aristotle) |
|---|---|---|
| Chain ID | **16602** ⚠️ (some sources say 16601) | **16661** |
| EVM RPC | `https://evmrpc-testnet.0g.ai` (also seen: `https://evmrpc-galileo.0g.ai`) ⚠️ | `https://evmrpc.0g.ai` |
| Storage indexer (turbo) | `https://indexer-storage-testnet-turbo.0g.ai` | `https://indexer-storage-turbo.0g.ai` |
| Storage Flow contract | `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` ⚠️ may change | `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526` |
| Explorer | `https://chainscan-galileo.0g.ai` | `https://chainscan.0g.ai` |
| Faucet | `https://faucet.0g.ai` (0.1 0G/day) | — |
| Compute Router | `https://router-api.0g.ai/v1` | same |
| Token | 0G (18 decimals) | 0G |

> Prefer SDK indexer auto-discovery over hardcoding the Flow contract. Resolve the chain-ID and RPC discrepancies against the actual wallet network you add before P0.
