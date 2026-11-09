CREATE TABLE admin_mcp_keys (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX admin_mcp_keys_owner_idx ON admin_mcp_keys(owner_id,created_at DESC);
