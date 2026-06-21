# KIPR — Frontend Attack Plan

> How the client gets built, screen by screen, mapped to the phases in `MASTER_SPEC.md`. The frontend's real job is to make two invisible properties — *private* and *yours* — **felt**.

---

## Stack

- **Framework:** React + Vite + TypeScript. Mobile-first (KIPR is a companion you reach for; design for a phone screen first).
- **Wallet:** `ethers` v6 + `BrowserProvider(window.ethereum)`; WalletConnect for mobile wallets. (P5 may add a managed-signer/account-abstraction path — see open decision in spec.)
- **0G SDKs in the browser:** `@0gfoundation/0g-storage-ts-sdk` and `@0gfoundation/0g-compute-ts-sdk`, both needing `vite-plugin-node-polyfills` (`crypto, stream, util, buffer, process`) + stub aliases. Copy the working config from the `0g-storage-ts-starter-kit` `web/vite.config.ts`.
- **State:** lightweight (Zustand or React context). No heavy global store needed for v1.
- **Styling:** your design system; see `design/` if present. Keep it warm and personal, not "crypto dashboard."

⚠️ **Browser gotchas to plan for up front** (from the API appendix):
1. `indexer.download()` does not work in-browser — use `StorageNode.downloadSegmentByTxSeq()` + in-memory reassembly (starter-kit `web/src/storage.ts`).
2. Compute **does not auto-fund** in the browser — funding is an explicit, user-initiated screen, never a silent popup mid-chat.
3. Both SDKs import Node built-ins at load — polyfills are not optional.

---

## Build order (mirrors the phases)

### P0 — Plumbing harness (throwaway UI)
A single dev page with three buttons proving the pipes: **(a)** connect wallet, **(b)** store→load a blob (show rootHash + tx), **(c)** one TeeML chat completion with `processResponse` → show `tee_verified: true` + provider + model + chatID. Not pretty; it's the proof the rest builds on.

### P1 — Onboarding & companion creation
- **Connect / create wallet** screen. For non-crypto users, lead with plain language ("Create your private space"), hide seed-phrase jargon; the self-custody-vs-managed decision (spec §8) determines how much wallet UI is exposed.
- **Companion creation:** name, vibe/personality starter. On confirm → mint the ERC-7857 token + write encrypted personality metadata. Show a calm progress state (chain writes take seconds).
- **Recovery proof (the magic moment):** a "Restore on a new device" flow that reconstructs the companion from the wallet + 0G alone. Surface this *as a feature*, not a hidden capability — it's the whole pitch.

### P2 — The chat (the core surface)
- Standard chat UI, but each assistant message carries a **provenance affordance**: a small, honest badge — `🔒 Private · ✓ TEE-verified · GLM-5 v1.2` — tappable to expand into the proof (provider address, chatID, verification result). This is the differentiator made visible; don't bury it, don't over-sell it.
- **Memory is invisible but felt:** no "memory" UI chrome in the message flow; it just remembers. Provide a separate, calm **Memory** view (what it knows about you) for transparency + control.
- Handle the funding state gracefully: if the provider sub-account runs low, a clear "top up" prompt — never a surprise wallet popup mid-sentence.
- Latency honesty: `processResponse` adds a round-trip. Decide (spec §8) whether to verify every message or show a "verifying…" micro-state; never fake the checkmark.

### P3 — Personality & provenance
- **Personality editor** with explicit **versioning**: changes are previewed and require a confirm; each save mints a new version. Show a version history.
- **No silent swap, made legible:** historical messages keep showing the version/model that produced them. A diff/timeline view ("your companion on June 10 vs now") reinforces "no one changed it behind your back."

### P4 — Export, delete, portability
- **Export:** one button → encrypted bundle pulled from 0G, decrypted locally, downloaded. Show it's *yours and readable by you alone*.
- **Delete:** real delete with a deliberate, two-step confirm (destructive-action guard). Be honest about what on-chain permanence means.
- **Restore-from-0G:** the P1 recovery flow, now also reachable as "move to a new device."

### P5 — Polish & the felt story
- Onboarding that a non-crypto friend completes without confusion (the P5 smoke test).
- Make **private** and **yours** felt throughout: the recovery moment, the provenance badge, the export button, the memory view. These four surfaces *are* the product's argument.
- Mobile performance pass; empty/error/low-funds states; accessibility.

---

## Component inventory (v1)

| Component | Phase | Notes |
|-----------|-------|-------|
| `WalletConnect` | P1 | ethers BrowserProvider / WalletConnect |
| `CompanionCreator` | P1 | mint ERC-7857 + write encrypted metadata |
| `RecoveryFlow` | P1/P4 | reconstruct from wallet + 0G |
| `ChatThread` / `MessageBubble` | P2 | bubble carries provenance affordance |
| `ProvenanceBadge` | P2/P3 | 🔒 Private · ✓ TEE-verified · model+version; expandable |
| `MemoryView` | P2 | transparency + control over what it knows |
| `FundingPanel` | P2 | deposit/transfer; explicit, never mid-chat |
| `PersonalityEditor` + `VersionHistory` | P3 | confirm-gated, versioned |
| `ExportButton` / `DeleteFlow` | P4 | encrypted export; two-step destructive guard |
| `OnboardingTour` | P5 | hides crypto; sells private + yours |

---

## Design principles

1. **Warm, not technical.** It's a companion, not a wallet. Crypto machinery stays backstage except where it *is* the feature (provenance, recovery, export).
2. **Honest verification.** Never show a verification checkmark you didn't earn from `processResponse`. If it's the Router fallback (unverified), say so plainly.
3. **The four felt surfaces.** Recovery, provenance, export, memory view — these carry the entire "private and yours" message. Invest design effort here over chrome.
4. **No dark patterns.** This product's whole premise is trust; an engagement-maximizing pattern would contradict it.
