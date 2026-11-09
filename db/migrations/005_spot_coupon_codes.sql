CREATE TABLE spot_coupon_codes (
  user_id uuid NOT NULL REFERENCES users(id),
  spot_id uuid NOT NULL REFERENCES spots(id),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,spot_id)
);
