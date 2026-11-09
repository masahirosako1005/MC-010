ALTER TABLE users ADD COLUMN account_role text NOT NULL DEFAULT 'visitor'
  CHECK (account_role IN ('visitor', 'town_admin'));
ALTER TABLE spots ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE spots ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE spots ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE spots DROP CONSTRAINT spots_source_check;
ALTER TABLE spots ADD CONSTRAINT spots_source_check CHECK (source IN ('fixture', 'organizer', 'town'));

CREATE TABLE spot_photos (
  id uuid PRIMARY KEY, spot_id uuid NOT NULL UNIQUE REFERENCES spots(id),
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^[a-f0-9-]{36}\.webp$')
);
CREATE TABLE admin_audit_logs (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, spot_id uuid NOT NULL REFERENCES spots(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brochure_items_spot_idx ON brochure_items(spot_id);
CREATE INDEX visits_spot_idx ON visits(spot_id);
