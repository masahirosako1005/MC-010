CREATE TABLE brochure_shares (
  id uuid PRIMARY KEY,
  brochure_id uuid NOT NULL UNIQUE REFERENCES brochures(id),
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{64}$'),
  active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz
);
CREATE TABLE share_page_views (
  share_id uuid NOT NULL REFERENCES brochure_shares(id),
  request_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id,request_id)
);
