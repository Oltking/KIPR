-- KIPR backend cache/index schema (MASTER_SPEC §4).
--
-- DERIVED DATA ONLY. Every row here is reconstructable from 0G + the user's key.
-- This DB is never the source of truth (non-negotiable #2). In particular there is
-- NO `content` column on `messages` — message text lives only in the user's
-- encrypted 0G memory stream. Do not add one.

CREATE TABLE IF NOT EXISTS companions (
  owner_addr                  TEXT PRIMARY KEY,
  token_id                    TEXT,                 -- ERC-7857 token id; NULL until minted
  current_personality_version BYTEA NOT NULL,       -- keccak256 version (32 bytes)
  metadata_root_hash          TEXT NOT NULL,        -- 0G rootHash of encrypted personality blob
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id                   TEXT PRIMARY KEY,            -- `${snapshot_root_hash}:${idx}` (deterministic)
  companion_id         TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('system','user','assistant')),
  model_id             TEXT,
  provider_addr        TEXT,
  chat_id              TEXT,
  tee_verified         BOOLEAN,
  personality_version  BYTEA,
  source_root_hash     TEXT NOT NULL,              -- 0G snapshot this row was derived from
  created_at           TIMESTAMPTZ NOT NULL
  -- INTENTIONALLY NO content COLUMN. Message text never lives server-side.
);
CREATE INDEX IF NOT EXISTS messages_companion_idx ON messages (companion_id, created_at);

CREATE TABLE IF NOT EXISTS personality_versions (
  version_hash    BYTEA PRIMARY KEY,
  companion_id    TEXT NOT NULL,
  root_hash       TEXT NOT NULL,
  model_id_pinned TEXT NOT NULL,
  user_confirmed  BOOLEAN NOT NULL DEFAULT false,  -- explicit opt-in (non-negotiable #4)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS root_index (
  root_hash    TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('personality','conversation','export')),
  companion_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS root_index_companion_idx ON root_index (companion_id, created_at);
