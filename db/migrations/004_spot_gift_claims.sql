ALTER TABLE spots ADD COLUMN has_gift boolean NOT NULL DEFAULT false;

CREATE TABLE spot_gift_claims (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  spot_id uuid NOT NULL REFERENCES spots(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,spot_id)
);
CREATE INDEX spot_gift_claims_spot_time_idx ON spot_gift_claims(spot_id,claimed_at DESC);
