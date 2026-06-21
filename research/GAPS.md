# GAPS & DISCREPANCIES — 0G research harvest (2026-06-19)

## 🔴 Discrepancies between our `CLAUDE.md` / PROMPT files and the LIVE platform
Per the "live docs win" rule in CLAUDE.md, the live values below override the prompt placeholders.
**These must be reflected in MASTER_SPEC / API_APPENDIX / `.env` before building.**

| Topic | Prompt / CLAUDE.md said | Live (verified this harvest) | Evidence |
|---|---|---|---|
| GitHub org | `github.com/0glabs` | **`github.com/0gfoundation`** (org `0glabs` now empty) | 88 vs 1 mentions in llms-full.txt; `api/0gfoundation_repos.json`; `github.com/0glabs` API returned no repos |
| Storage SDK pkg | `@0glabs/0g-ts-sdk` (single SDK) | **`@0gfoundation/0g-storage-ts-sdk` @ 1.2.9** | cloned package.json |
| Compute SDK pkg | (single SDK / "confirm") | **`@0gfoundation/0g-compute-ts-sdk` @ 0.9.0-beta.0** | cloned package.json |
| Storage import | `import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk"` | `from "@0gfoundation/0g-storage-ts-sdk"` | docs + SDK src |
| Galileo testnet chain ID | `16601` | **`16602`** (16601 appears only as legacy) | llms-full.txt (9× 16602 vs 4× 16601) |
| Mainnet | (testnet-only framing) | **Mainnet "Aristotle" is LIVE** since ~Sep 2025, chain ID `16661`, RPC `https://evmrpc.0g.ai` | llms-full.txt, homepage |
| "INFT" | n/a | rebranded **"Agentic ID"** (ERC-7857) | concepts/agentic-id.md |
| Compute integration | single SDK path | **two paths**: Router (OpenAI-compatible `https://router-api.0g.ai/v1`, API key) **or** Direct SDK (per-provider wallet-signed sub-accounts) | router/** docs |

### Impact on KIPR's non-negotiables
- **Privacy / TEE (non-negotiable #1):** The Router path uses an **API key + a single custodial balance**,
  not per-request wallet signing. TEE *verifiable execution* is documented under
  `router/features/verifiable-execution.md`, and the Direct SDK exposes explicit attestation
  (`downloadQuoteReport`, `acknowledgeProviderTEESigner`, `Verifier`, `processResponse(provider, content, chatID)`).
  **Decision needed:** KIPR's "no conversation touches a non-TEE model + verify attestation per response"
  rule maps most directly to the **Direct SDK** path, not the Router. Flag for MASTER_SPEC.
- **`.env` keys:** `ZG_CHAIN_ID` should be `16602` (testnet) / `16661` (mainnet); storage + compute now need
  separate package installs. `ZG_STORAGE_CONTRACT` (Flow) testnet = `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`.
  Note: for TS SDK file upload the Flow contract is resolved internally by the Indexer; it's only needed
  explicitly for KV `Batcher`.

## 🟡 Could not capture verbatim
| Item | Reason | Mitigation |
|---|---|---|
| https://0g.ai/ homepage (rendered text) | Client-side JS app; curl returns only the JS bundle (raw bytes saved). WebFetch's render is a small-model summary, not verbatim. | Raw HTML saved at `website/0g.ai_homepage_raw.html`; rendered summary at `website/0g.ai_homepage.md` (clearly marked). Marketing copy is not load-bearing for the build. |
| https://0g.ai/blog + individual posts | JS-rendered; `0g-doc` blog page is only a pointer to the live blog. | Not captured. Low priority (worldview only). Re-harvest later with a JS-capable fetch if the "verifiable inference" deep-dive posts are wanted. |
| build.0g.ai / hub.0g.ai builder hub | JS-rendered portals. | Builder/starter content fully covered by cloned starter-kit repos. |
| OpenAPI / Swagger / gRPC spec | None found exposed at docs.0g.ai. | Router API is OpenAI-compatible REST; shapes documented in `router/**` MDX + curl examples in llms-full.txt. |

## 🟢 Notes
- No credential/auth wall was hit during this harvest; nothing requires a secret you hold to re-fetch
  the captured items. (Running the SDKs later will need a funded testnet wallet from `faucet.0g.ai`.)
- WebFetch (small-model markdown conversion) was used only for the JS-rendered homepage; **all docs and
  all source code are raw/verbatim** (raw curl for `llms*.txt`, `git clone` for source).
- Heavy infra repos were intentionally skipped (see INDEX.md "NOT cloned"); say the word to add any.
