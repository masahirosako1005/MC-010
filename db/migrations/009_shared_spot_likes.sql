CREATE TABLE share_spot_likes (
  share_id uuid NOT NULL REFERENCES brochure_shares(id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id, spot_id, visitor_hash)
);
