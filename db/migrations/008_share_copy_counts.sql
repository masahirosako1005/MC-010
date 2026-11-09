ALTER TABLE brochure_shares
  ADD COLUMN copy_count integer NOT NULL DEFAULT 0 CHECK (copy_count >= 0),
  ADD COLUMN last_copied_at timestamptz;

CREATE TABLE share_url_copies (
  share_id uuid NOT NULL REFERENCES brochure_shares(id),
  request_id uuid NOT NULL,
  copied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id, request_id)
);
CREATE INDEX share_url_copies_date_idx ON share_url_copies(share_id, copied_at);
