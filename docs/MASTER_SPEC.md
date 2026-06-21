# KIPR — Master Spec

> Source of truth for every 0G API is `research/RESEARCH_FULL.md`. This spec cites verified signatures from that harvest (fetched 2026-06-19). Where 0G's own docs disagree with themselves, the discrepancy is flagged inline — verify against live docs before relying on it.

---

## 1. Product

**KIPR** is a private AI companion that is genuinely *yours*. Two felt guarantees a normal person understands:

1. **It's private.** Your conversations run inside a Trusted Execution Environment (TEE). No company — not even us — can read or train on them.
2. **It's yours and permanent.** The companion's identity, personality, and memory live in storage *you* own, encrypted with *your* key. No company can alter it, censor it, "lobotomize" it with a silent model swap, or take it away. If our company disappeared tomorrow, you could still load your companion from 0G with your key alone.

This is the answer to the Replika/Character.AI betrayal pattern: people bonded with an AI, then a model change or shutdown took it from them. KIPR makes that structurally impossible.

### Non-goals (v1)
- Not a general chatbot platform, not a marketplace, not a token launch.
- No fine-tuning per user in v1 (0G supports it; out of scope until later).
- No multi-agent / agent-to-agent features in v1.

---

## 2. Why 0G (and why these specific primitives)

KIPR is an *assembly* of three 0G primitives that already exist, not an invention:

| Need | 0G primitive | Why it fits |
|------|-------------|-------------|
| Private + verifiable inference | **0G Compute** (Direct path, TeeML provider, `processResponse` TEE-signature verification) | Each reply is signed by the provider's TEE key; we can prove which model produced it → "no silent swap." |
| User-owned, encrypted, permanent memory | **0g-memory (EverMemOS)** persisted to **0G Storage** | Memory encrypted with a key only the user holds, persisted on-chain, survives hardware failure. Matches our non-negotiables exactly. |
| Owned, portable companion identity | **ERC-7857 "Agent NFT"** | A standard purpose-built for owning an AI agent whose *private* metadata transfers via TEE-sealed keys. The companion = an ERC-7857 token in the user's wallet; personality config = its private metadata. |
| Encrypted blob storage (exports, personality versions, snapshots) | **0G Storage** TS SDK with **ECIES encrypt-to-self** (v1.2.6+) | Wallet's secp256k1 key both signs storage txs and decrypts. No hand-rolled crypto. |

**Decision — Direct over Router for inference.** 0G Compute offers two paths: the **Router** (OpenAI-compatible, single API key, simplest) and **Direct** (per-provider, wallet-signed, with `processResponse` TEE verification). KIPR's flagship guarantee is *verifiable* private inference, which the Direct path's per-response TEE signature gives us. Use **Direct + a TeeML provider** for production. The Router is acceptable only as a degraded fallback and must be labelled as such in the UI (verification is not equivalent).

**Decision — memory backend.** Build on **0g-memory / EverMemOS** for the encrypted-on-chain story. `0gmem` is the lighter, structured alternative (excellent recall, clean export/import, MCP server) — keep it as a fallback/option, but EverMemOS's "encrypted with a key only you hold, persisted on-chain" is the closer match to the product promise.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (browser / mobile webview)                          │
│  - Wallet connect (MetaMask / WalletConnect)                │
│  - Chat UI, personality editor, provenance badges           │
│  - Holds the user's key; does client-side encrypt/decrypt   │
└───────────┬──────────────────────────────┬──────────────────┘
            │ wallet-signed                │ wallet-signed
            ▼                              ▼
┌────────────────────────┐     ┌──────────────────────────────┐
│ 0G Compute (Direct)    │     │ 0G Storage (TS SDK)          │
│ broker.inference.*     │     │ ECIES encrypt-to-self        │
│ TeeML provider         │     │ memory snapshots, personality│
│ processResponse() ✓    │     │ versions, exports            │
└────────────────────────┘     └──────────────────────────────┘
            │                              ▲
            ▼                              │
┌────────────────────────┐     ┌──────────────────────────────┐
│ ERC-7857 Agent NFT     │     │ 0g-memory (EverMemOS)        │
│ companion identity +   │     │ structured memory, encrypted │
│ private personality    │     │ persisted to 0G storage      │
│ metadata (on 0G chain) │     │ REST API (localhost:1995)    │
└────────────────────────┘     └──────────────────────────────┘
            ▲
            │ cache/index ONLY (never source of truth)
┌────────────────────────┐
│ KIPR backend (Node)  │  thin: session, RPC fan-out,
│ Postgres = cache/index │  root-hash index, message metadata
└────────────────────────┘
```

**Hard architectural rule:** the Postgres DB stores only *derived* data — root hashes, message metadata (model id, provider, chatID, TEE-verified flag, personality version, timestamps), and UI cache. The *authoritative* companion (identity, personality, memory) lives on 0G. A clean client + the user's key must fully reconstruct the companion with the backend DB wiped.

### Networks / endpoints (verified)
- **Testnet (dev):** 0G Galileo. Chain ID **16602** ⚠️ *(0G's testnet-overview table says 16602; some third-party RPC URLs say "16601" — verify against the wallet you add).* RPC: `https://evmrpc-testnet.0g.ai` (0g-memory README uses `https://evmrpc-galileo.0g.ai` — both appear in 0G docs; confirm which your SDK version expects). Faucet: `https://faucet.0g.ai`.
- **Mainnet:** 0G Aristotle. Chain ID **16661**. RPC: `https://evmrpc.0g.ai`. Explorer: `https://chainscan.0g.ai`.
- **Storage indexer (turbo):** testnet `https://indexer-storage-testnet-turbo.0g.ai`, mainnet `https://indexer-storage-turbo.0g.ai`. SDK auto-discovers the flow contract from the indexer.
- **Storage flow contract:** testnet `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`, mainnet `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526` ⚠️ *(testnet addresses may change; SDK auto-discovery is preferred over hardcoding).*

### Packages (verified, current)
- `@0gfoundation/0g-storage-ts-sdk` (+ `ethers` peer dep). Encryption requires **v1.2.6+**.
- `@0gfoundation/0g-compute-ts-sdk` (Node **>= 20**, though the inference doc says **>= 22** — use 22 to be safe). ⚠️ The old `@0glabs/0g-serving-broker` / `@0glabs/0g-ts-sdk` names are deprecated; do not use them.

---

## 4. Data model

### On 0G (authoritative)
- **Companion (ERC-7857 token):** `tokenId`, `owner` (wallet), private metadata = encrypted personality config blob. Personality changes mint a new metadata version (hash recorded).
- **Memory stream (EverMemOS / 0G Storage):** per-user encrypted stream; stream id + encryption key held by the user. Structured episodic + semantic memory.
- **Encrypted blobs (0G Storage, ECIES-to-self):** personality version snapshots, full exports. Keyed by Merkle `rootHash`.

### In Postgres (cache/index only — reconstructable, never authoritative)
- `companions(token_id, owner_addr, current_personality_version, metadata_root_hash, created_at)`
- `messages(id, companion_id, role, model_id, provider_addr, chat_id, tee_verified bool, personality_version, created_at)` — **note: message *content* is not stored server-side as source of truth; it belongs to the user's encrypted memory/store.**
- `personality_versions(version_hash, companion_id, root_hash, model_id_pinned, created_at, user_confirmed bool)`
- `root_index(root_hash, kind, companion_id, created_at)`

---

## 5. Non-negotiables (enforced, not aspirational)

1. **Privacy is load-bearing.** All production inference goes through 0G Compute Direct on a **TeeML** provider; call `processResponse(provider, chatID)` and store the result. No conversation content ever reaches a non-TEE model in production. `DEV_FALLBACK_MODEL_KEY` is local-dev only, behind an explicit flag.
2. **User owns the companion.** Identity = ERC-7857 token in the user's wallet; memory + personality = encrypted, user-keyed, on 0G. Backend DB is cache/index only. Recovery from 0G with the user's key alone must be proven (P4).
3. **Client-side encryption.** ECIES encrypt-to-self (wallet key) for all 0G Storage blobs; EverMemOS encryption key held only by the user. Storage nodes never see plaintext.
4. **No silent swaps.** Per message, record `model_id`, `provider_addr`, `chat_id`, `tee_verified`, `personality_version`. Personality changes require explicit user confirmation and mint a new version. Old messages always display the version that produced them.
5. **No training on user data. No selling/sharing.** Stated in-product, enforced by architecture.
6. **Export & real delete.** Full encrypted export from 0G + local decrypt; real delete path.
7. **Human approval before destructive actions** (wipe memory, delete companion, burn token).
8. **Real, no mocks in production.** Verify every 0G call against `research/`. If a credential/capability is missing, stop and ask — never stub around it.

---

## 6. Funding reality (read before P0)

⚠️ **This is the most likely thing to block the build.** 0G Compute Direct requires a **minimum 3 0G** to open a ledger and **≥1 0G per provider** sub-account. The public testnet faucet caps at **0.1 0G/day**. So the faucet alone cannot fund compute in a reasonable time. Per the 0g-memory README, the path is to **request testnet tokens from the 0G team early** (Discord `discord.gg/0glabs`, or the contact listed in the harvest) — this can take **hours to 1–2 days**. **Start this on day one, before writing code.** Storage operations are cheap and faucet-fundable; compute is the gated piece.

---

## 7. Phased build order

Each phase ends with a **real end-to-end smoke test** (real data through 0G, not "it compiles") and a stop for review.

- **P0 — Foundations & funding.** Repo, env, wallet on testnet, **funding secured** (see §6). Round-trip a blob through 0G Storage (upload → rootHash → download → bytes match). One 0G Compute Direct inference call against a TeeML provider with `processResponse` returning `true`.
  *Smoke test:* show a real storage tx + rootHash round-trip, and a chat completion whose TEE verification returns valid, with the provider/model/chatID printed.
- **P1 — Owned identity.** Wallet auth; mint an **ERC-7857 companion token** to the user; personality config written as encrypted private metadata; reconstruct the companion on a clean client from the wallet alone.
  *Smoke test:* fresh browser, no backend row → companion loads from chain + 0G, decrypts, renders.
- **P2 — Conversation loop with owned memory.** Chat UI; each turn → Compute Direct (TeeML) → `processResponse`; memory captured into EverMemOS / 0G Storage, encrypted; retrieval feeds prior context; per-message provenance recorded.
  *Smoke test:* multi-turn convo, clear local cache, reload → companion still remembers; each message shows model/provider/`tee_verified`.
- **P3 — Personality & no-silent-swap.** Versioned personality with explicit user opt-in to changes; provenance surfaced in UI ("private · TEE-verified · model X v1.2"); historical messages pinned to their producing version.
  *Smoke test:* personality changes only via confirm; old messages keep old version; an attempted swap without consent is impossible by construction.
- **P4 — Export / delete / portability.** Full encrypted export from 0G + local decrypt; real delete; prove "recover from 0G with just my key."
  *Smoke test:* export → wipe local + backend cache → re-import from 0G with only the user's key → companion intact.
- **P5 — Consumer polish.** Onboarding that hides crypto (abstract gas/keys; consider account-abstraction or a managed-signer option for non-crypto users, while preserving recoverability); make privacy/ownership *visible and felt*; mobile-first.
  *Smoke test:* a non-crypto person onboards and chats without hitting a step they can't understand.

---

## 8. Open product decisions (resolve before/while building)

1. **Self-custody vs managed keys.** True wallet self-custody maximizes the ownership story but adds onboarding friction; a managed-signer/account-abstraction approach smooths onboarding but must *still* let the user export their key and recover independently, or the core promise breaks. This shapes P1 and P5.
2. **EverMemOS vs 0gmem** as the memory engine (encrypted-on-chain native vs lighter structured + MCP). Pick in P2.
3. **Per-message verification UX.** Verifying every response via `processResponse` adds latency/cost. Decide: verify every message, sample, or verify on demand — and how to show it honestly.
4. **Mainnet economics.** Compute is paid per token in real 0G on mainnet. Model the per-user cost before launch.

---

## 9. License & conduct
Original work. License per repo decision (MIT is consistent with the 0G ecosystem repos). Secrets never committed. Small, phase-scoped commits.
