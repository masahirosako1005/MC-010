CREATE TABLE users (
  id uuid PRIMARY KEY, external_id text NOT NULL UNIQUE,
  email text UNIQUE CHECK (email = lower(email)), display_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('fixture','organizer')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_aliases (
  email text PRIMARY KEY CHECK (email = lower(email)), user_id uuid NOT NULL REFERENCES users(id), label text NOT NULL
);
CREATE TABLE spots (
  id uuid PRIMARY KEY, external_id text NOT NULL UNIQUE, name text NOT NULL, category text NOT NULL,
  description text NOT NULL, companion_tags text[] NOT NULL DEFAULT '{}', theme_tags text[] NOT NULL DEFAULT '{}',
  image text NOT NULL, source text NOT NULL CHECK (source IN ('fixture','organizer')), source_url text
);
CREATE TABLE visits (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), spot_id uuid NOT NULL REFERENCES spots(id),
  visited_at timestamptz NOT NULL, stamp boolean NOT NULL DEFAULT true, source_key text NOT NULL UNIQUE
);
CREATE INDEX visits_user_idx ON visits(user_id);
CREATE TABLE surveys (
  user_id uuid PRIMARY KEY REFERENCES users(id), satisfaction integer CHECK (satisfaction BETWEEN 1 AND 5),
  good_points text, tags text[] NOT NULL DEFAULT '{}', previous_companion text
);
CREATE TABLE brochures (
  id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  companion text NOT NULL CHECK (companion IN ('家族','子ども','パートナー','友人','親','一人')),
  duration text NOT NULL CHECK (duration IN ('day','overnight')),
  trip_style text NOT NULL CHECK (trip_style IN ('slow','active')),
  template text NOT NULL CHECK (template IN ('colorful','postcard')),
  title text NOT NULL, theme text NOT NULL, invitation text NOT NULL,
  regeneration_count integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE brochure_items (
  id uuid PRIMARY KEY, brochure_id uuid NOT NULL REFERENCES brochures(id), spot_id uuid NOT NULL REFERENCES spots(id),
  kind text NOT NULL CHECK (kind IN ('visited','candidate')), selected boolean NOT NULL DEFAULT false,
  is_memory boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 200), reason text NOT NULL,
  UNIQUE (brochure_id,spot_id)
);
CREATE TABLE item_photos (
  id uuid PRIMARY KEY, item_id uuid NOT NULL UNIQUE REFERENCES brochure_items(id),
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^[a-f0-9-]{36}\.webp$'),
  mime text NOT NULL CHECK (mime='image/webp'), byte_size integer NOT NULL CHECK (byte_size > 0), sha256 text NOT NULL
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE import_runs (
  id uuid PRIMARY KEY, source_hash text NOT NULL UNIQUE, counts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

