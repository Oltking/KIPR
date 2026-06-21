# INDEX — 0G (Zero Gravity) research harvest

Harvested: **2026-06-19** for the **KIPR** project. Target confirmed via identity markers:
"Zero Gravity"; four modules **0G Chain + 0G Storage + 0G Compute + 0G DA**; token ticker **0G** (a zero).
No decoy (ticker "OG", parabolic-flight / trampoline "Zero Gravity", the 2010 film) was harvested.

> ⚠️ **Read `GAPS.md` before building.** The live platform has materially diverged from the values
> baked into `CLAUDE.md` / the PROMPT files: the GitHub org migrated **`0glabs` → `0gfoundation`**,
> the single `@0glabs/0g-ts-sdk` is now **two packages** (`@0gfoundation/0g-storage-ts-sdk`,
> `@0gfoundation/0g-compute-ts-sdk`), and the Galileo testnet chain ID is **16602** (not 16601).
> Per the "live docs win" rule, this harvest reflects the live state.

Raw downloaded files (`llms-full.txt`, `llms.txt`, `*_raw.html`) are kept **byte-for-byte pristine**
(no injected header) to preserve verbatim fidelity; provenance for each lives in this table.

## Documentation (docs.0g.ai)

| Source URL | Saved path | Status | Size |
|---|---|---|---|
| https://docs.0g.ai/llms-full.txt | research/docs/llms-full.txt | OK (verbatim, raw curl) | 560 KB |
| https://docs.0g.ai/llms.txt | research/docs/llms.txt | OK (verbatim, raw curl) — index of 80 doc pages | 18 KB |
| All 80 doc pages (concepts, developer-hub, router, agentic-id, node-sale, run-a-node, resources) | research/github/0g-doc/docs/**/*.md(x) | OK (verbatim MDX source, cloned) | 170 files |

The full doc-page list is enumerated in `research/docs/llms.txt`. Every page is captured **twice**:
(1) concatenated in `llms-full.txt`, (2) as raw MDX in the cloned `0g-doc` repo.

## Website (0g.ai)

| Source URL | Saved path | Status | Size |
|---|---|---|---|
| https://0g.ai/ | research/website/0g.ai_homepage_raw.html | OK (raw JS bundle bytes) | 283 KB |
| https://0g.ai/ | research/website/0g.ai_homepage.md | PARTIAL (WebFetch render, NOT verbatim) | — |
| https://0g.ai/blog | — | NOT CAPTURED (JS-rendered; see GAPS.md) | — |

## GitHub (github.com/0gfoundation) — cloned shallow (depth 1), `.git` stripped

| Repo | Saved path | Lang | Version / module | Why captured |
|---|---|---|---|---|
| 0g-storage-ts-sdk | research/github/0g-storage-ts-sdk | TS | @0gfoundation/0g-storage-ts-sdk @ **1.2.9** | ⭐ user-owned encrypted storage (Indexer, ZgFile, Blob, MerkleTree, KV, EncryptedFile) |
| 0g-compute-ts-sdk | research/github/0g-compute-ts-sdk | TS | @0gfoundation/0g-compute-ts-sdk @ **0.9.0-beta.0** | ⭐ TEE-verified inference broker (createZGComputeNetworkBroker, Verifier, processResponse, attestation reports) |
| 0g-serving-broker | research/github/0g-serving-broker | Go | — | ⭐ provider/serving + TEE attestation backend |
| 0g-storage-ts-starter-kit | research/github/0g-storage-ts-starter-kit | TS | 0g-storage-ts-starter @ 2.0.0 | upload/download CLI + lib reference |
| 0g-storage-web-starter-kit | research/github/0g-storage-web-starter-kit | TS | storage-starter-web @ 0.1.0 | ⭐ browser + MetaMask storage usage |
| 0g-compute-ts-starter-kit | research/github/0g-compute-ts-starter-kit | TS | 0g-compute-starter-kit @ 1.0.0 | compute integration reference |
| ask-ai-widget | research/github/ask-ai-widget | TS | @0gfoundation/ask-ai-widget @ 0.1.0 | ⭐ React chat UI backed by 0G Compute |
| 0g-agent-nft | research/github/0g-agent-nft | Solidity | 0g-agent-nft @ 1.0.0 | ERC-7857 Agentic ID (encrypted-metadata NFT, TEE re-encryption) |
| 0g-memory | research/github/0g-memory | Python | pyproject | ⭐ encrypted on-chain conversational memory (Claude Code memory on 0G) |
| 0gmem | research/github/0gmem | Python | pyproject | ⭐ long-term agent memory (BM25 + semantic retrieval) |
| 0g-storage-client | research/github/0g-storage-client | Go | github.com/0gfoundation/0g-storage-client | Go CLI/client + encryption flags reference |
| 0g-doc | research/github/0g-doc | TS/MDX | docs-0-g | ⭐ verbatim source of all docs |
| awesome-0g | research/github/awesome-0g | — | — | ecosystem index |

File trees for every repo: `research/github/trees/<repo>.txt`. Full org repo manifest (raw API JSON):
`research/api/0gfoundation_repos.json`.

### Repos deliberately NOT cloned (out of scope for KIPR; noted for completeness)
Heavy infra / unrelated, recorded but skipped: `0g-geth`, `0g-reth`, `0gchain-NG`, `0g-storage-node`,
`0g-storage-kv`, `0g-da-node`, `0g-da-client`, `0g-da-encoder`, `0g-da-retriever`, `0g-da-contract`,
`vllm`, `daytona`, `zkevm-contracts`, `alloy-evm`, `0g-tapp`, `0g-sandbox`, `0g-eliza`,
`0g-storage-sdk-rust`, `0g-storage-s3-sdk`, `0g-storage-scan`, `0g-restaking-contracts`,
`0g-serving-contract`, `0g-storage-contracts`, `0g-deployment-scripts`, `A0GI-contracts`, `Agora`,
`reachy-mini-hackathon`, `agent-wrapper`, `0g-agent-skills`, `0g-compute-skills`, `0g-claude-marketplace`,
`agenticID-examples`, `0g-contract-example`, `jaine-docs`, `DefiLlama-Adapters`. (All exist under
github.com/0gfoundation — see api/0gfoundation_repos.json.)

## API definitions
No standalone OpenAPI/Swagger or gRPC file was found exposed at docs.0g.ai. The 0G Compute **Router**
is an OpenAI-compatible REST API (`https://router-api.0g.ai/v1`) documented under
`0g-doc/docs/developer-hub/building-on-0g/compute-network/router/**`. See GAPS.md.

## Verification answers (required by Prompt 1)
- **Does docs.0g.ai serve `llms-full.txt` / `llms.txt`?** YES — both served (raw curl, 200). `llms-full.txt`
  (560 KB) contains all doc content in one file; `llms.txt` indexes 80 pages. Appending `.md` not needed —
  full MDX source is in the `0g-doc` repo.
- **0G Compute / inference-serving repo + package + version:** SDK `@0gfoundation/0g-compute-ts-sdk` @ `0.9.0-beta.0`
  (repo `0gfoundation/0g-compute-ts-sdk`); serving backend `0gfoundation/0g-serving-broker` (Go).
- **0G Storage SDK version + flow/storage contracts + indexer RPC:** `@0gfoundation/0g-storage-ts-sdk` @ `1.2.9`.
  Testnet Flow `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`; mainnet Flow `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526`.
  Testnet indexer `https://indexer-storage-testnet-turbo.0g.ai`; mainnet `https://indexer-storage-turbo.0g.ai`.
- **Where the key `examples/` live:** `0g-storage-ts-sdk/examples`, `0g-compute-ts-sdk/src.ts/sdk/example` +
  `src.ts/example`, and the three starter kits.
