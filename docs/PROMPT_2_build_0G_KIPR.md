# PROMPT 2 (FILLED) — give to Claude Code to BUILD KIPR from your generated docs

Use this after you've (a) harvested the 0G docs with Prompt 1, and (b) brought that corpus to a chat assistant to generate your spec set: an **API appendix** (verified 0G signatures), a **master spec** (product, architecture, data model, phased build order, non-negotiables), a **design brief**, and a **frontend attack plan**. Arrange the folder, then paste below the line into Claude Code.

Filled values (for reference):
- `{PROJECT}` = **KIPR** — a private AI companion that's truly yours: conversations run in a TEE so they're never harvested, and its memory + personality live in storage you own, so no company can alter, censor, or take it away.
- `{PLATFORM}` = **0G (Zero Gravity)** — 0G Compute for TEE-verified inference, 0G Storage for user-owned encrypted memory, 0G Chain (EVM) for identity/settlement.
- `{ENV_KEYS}` (your `.env` — never commit):
  - `ZG_EVM_RPC` — 0G EVM RPC (testnet `https://evmrpc-testnet.0g.ai`, mainnet `https://evmrpc.0g.ai`)
  - `ZG_CHAIN_ID` — `16601` (testnet) / `16661` (mainnet)
  - `ZG_PRIVATE_KEY` — funded wallet for gas + storage/compute fees (testnet 0G from `faucet.0g.ai`)
  - `ZG_INDEXER_RPC` — 0G Storage indexer (confirm exact testnet turbo URL from research)
  - `ZG_STORAGE_CONTRACT` — flow/storage contract address (confirm from research)
  - `ZG_COMPUTE_*` — 0G Compute inference broker/provider config (confirm exact keys from research)
  - `KIPR_JWT_SECRET` — app session signing
  - `KIPR_CACHE_DB_URL` — local cache/index DB **only** (not source of truth)
  - `DEV_FALLBACK_MODEL_KEY` — **local dev only**, never used on any production path (see non-negotiables)
- `{NON_NEGOTIABLES}` = the privacy/ownership rules below
- `{PHASES}` = P0–P5 below

Expected folder:
```
kipr/
├─ CLAUDE.md
├─ .env                 # ZG_* keys etc. — never commit
├─ docs/                # API_APPENDIX (0G), MASTER_SPEC, FRONTEND_ATTACK_PLAN, design specs
├─ design/              # design-tool output (tokens + screens + screenshots), if any
└─ research/RESEARCH_FULL.md   # from Prompt 1
```

---

Read `CLAUDE.md` first, then the files in `docs/` in the order it lists, before writing any code. `research/RESEARCH_FULL.md` is the source of truth — **verify every 0G API call against it (or the live docs at docs.0g.ai) before using it. Never invent an API.**

We are building the real, working app for **KIPR** — a private, user-owned AI companion on 0G — **no mocks in production paths**. Honor these non-negotiables throughout:

1. **Privacy is load-bearing.** All companion inference runs through **0G Compute TEE-verified inference**. No conversation content is ever sent to a non-TEE third-party model on any production path. (`DEV_FALLBACK_MODEL_KEY` may be used in local dev only, behind an explicit dev flag, never in prod.)
2. **The user owns the companion.** The companion's memory, personality config, and conversation history are persisted to **0G Storage** under keys the user controls. Our backend DB is a **cache/index only, never the source of truth**. If our company vanished, the user could still recover and load their companion from 0G with their own key.
3. **Client-side encryption.** Everything written to 0G Storage is encrypted client-side with a key derived from the user's wallet/passphrase, so storage nodes can never read it.
4. **No silent model/personality swaps.** Record the model + system prompt + personality **version** (hash) that produced every response. Personality changes require explicit user opt-in. Old messages keep showing the version that produced them.
5. **No training on user data, ever. No selling or sharing.** State it plainly in-product and enforce it architecturally (TEE + user-held encrypted storage).
6. **Export & real delete.** The user can export their full encrypted memory/history from 0G and decrypt locally, and can truly delete.
7. **Human approval before destructive actions** (wipe memory, delete companion): explicit confirmation required.
8. **Real, no mocks in production** — verify every 0G call against `research/`; never fake around a missing capability.

Use the model/credential wiring exactly as specified in `docs/` and `.env` (the `ZG_*` keys). Do not introduce paid accounts or services the spec didn't call for.

Build by these phases, and **stop for my review at the end of each phase** with a smoke test that proves the thing actually works end-to-end so far (not just compiles — show real data flowing through 0G):

- **P0 — Foundations & wiring.** Repo + env; connect to 0G testnet (RPC + wallet, confirm gas); round-trip a trivial blob through **0G Storage** via the TS SDK (upload → get root hash → download → bytes match); make one **0G Compute** TEE inference call. *Smoke test:* text in → TEE response out, **and** a blob written to 0G Storage and read back by root hash, both shown with real tx/hashes.
- **P1 — Identity & ownership.** Wallet-based auth; derive a client-side encryption key from the wallet/passphrase; create a "companion" record (personality config + empty memory), encrypt it client-side, store to 0G Storage; recover it on a fresh session from the wallet alone. *Smoke test:* log in on a clean browser with no server-side companion row, pull the companion back from 0G, decrypt, and load it.
- **P2 — Conversation loop with owned memory.** Chat UI; each turn runs through 0G Compute TEE inference; memory (rolling summaries/embeddings of past turns) encrypted and persisted to 0G Storage; retrieval feeds context into each turn; record model+personality version per message. *Smoke test:* hold a multi-turn conversation, clear the local cache, reload — the companion still remembers, and each message exposes its verifiable model/version metadata.
- **P3 — Personality & "no silent swap" guarantees.** Editable personality with explicit versioning and user opt-in to any change; surface provenance in the UI ("private · verified · model X v1.2"). *Smoke test:* personality only changes via explicit confirm; historical messages still display the exact version that produced them; attempting a swap without consent is impossible.
- **P4 — Export / delete / portability.** Full encrypted export from 0G + local decrypt; real delete; prove "recover from 0G with just my key" end-to-end. *Smoke test:* export, wipe everything (local + our cache), re-import from 0G with only the user's key — companion comes back intact.
- **P5 — Consumer polish.** Onboarding that hides crypto complexity (abstract gas/keys; no raw seed-phrase confusion); make the privacy/ownership story visible and felt; mobile-first UI. *Smoke test:* a non-crypto person onboards and chats without hitting a single step they can't understand.

Rules of engagement:
- If a credential, access code, account, or asset is missing at any point, **stop and ask me — don't stub or fake around it.**
- If the live docs contradict our `docs/` appendix, the live docs win; note the discrepancy and proceed.
- Keep secrets out of code, logs, and output; never commit `.env`.
- Small, phase-scoped commits; original work; the license stated in the spec.
- After the final phase, give me a short "how to run" and a list of anything left as `(confirm)` or TODO.

Begin with the first phase.
