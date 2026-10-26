-- Presswala schema. Idempotent: safe to run on every deploy (`npm run db:migrate`).

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'presswala', 'admin')),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A catchment unit: a sector, society or colony. Presswalas serve one or more areas
-- and households belong to exactly one.
CREATE TABLE IF NOT EXISTS areas (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  locality   TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT 'Gurgaon',
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, city)
);

CREATE TABLE IF NOT EXISTS presswalas (
  user_id              BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shop_name            TEXT NOT NULL,
  shop_address         TEXT NOT NULL DEFAULT '',
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  upi_id               TEXT NOT NULL DEFAULT '',
  capacity_homes       INT NOT NULL DEFAULT 100,
  daily_piece_capacity INT NOT NULL DEFAULT 300,
  slot_capacity        INT NOT NULL DEFAULT 12,
  working_days         INT[] NOT NULL DEFAULT '{1,2,3,4,5,6}', -- 0 = Sunday
  verified             BOOLEAN NOT NULL DEFAULT FALSE,
  accepting            BOOLEAN NOT NULL DEFAULT TRUE,
  rating_sum           INT NOT NULL DEFAULT 0,
  rating_count         INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS presswala_areas (
  presswala_id BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  area_id      BIGINT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (presswala_id, area_id)
);

-- Each presswala's own rate card.
CREATE TABLE IF NOT EXISTS price_items (
  id           BIGSERIAL PRIMARY KEY,
  presswala_id BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  is_regular   BOOLEAN NOT NULL DEFAULT FALSE, -- counts against subscription pieces
  sort_order   INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (presswala_id, code)
);

CREATE TABLE IF NOT EXISTS households (
  user_id      BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  area_id      BIGINT NOT NULL REFERENCES areas(id),
  address      TEXT NOT NULL,
  landmark     TEXT NOT NULL DEFAULT '',
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  presswala_id BIGINT REFERENCES presswalas(user_id) ON DELETE SET NULL,
  linked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS households_presswala_idx ON households (presswala_id);
CREATE INDEX IF NOT EXISTS households_area_idx ON households (area_id);

-- Recurring pickups, e.g. every Mon/Wed/Fri at 7-9am.
CREATE TABLE IF NOT EXISTS schedules (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presswala_id BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  weekdays     INT[] NOT NULL,
  pickup_mode  TEXT NOT NULL DEFAULT 'doorstep' CHECK (pickup_mode IN ('doorstep', 'self_drop')),
  pickup_slot  TEXT NOT NULL,
  return_mode  TEXT NOT NULL DEFAULT 'doorstep' CHECK (return_mode IN ('doorstep', 'self_collect')),
  return_slot  TEXT NOT NULL,
  est_pieces   INT NOT NULL DEFAULT 10,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS schedules_one_active_per_customer
  ON schedules (customer_id) WHERE active;

CREATE TABLE IF NOT EXISTS plans (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  pieces_per_month INT NOT NULL CHECK (pieces_per_month > 0),
  price            NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  description      TEXT NOT NULL DEFAULT '',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presswala_id BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  plan_id      BIGINT NOT NULL REFERENCES plans(id),
  plan_name    TEXT NOT NULL,
  price        NUMERIC(8,2) NOT NULL,
  pieces_total INT NOT NULL,
  pieces_used  INT NOT NULL DEFAULT 0,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  commission   NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (customer_id, status);

CREATE TABLE IF NOT EXISTS orders (
  id                 BIGSERIAL PRIMARY KEY,
  customer_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presswala_id       BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  area_id            BIGINT NOT NULL REFERENCES areas(id),
  schedule_id        BIGINT REFERENCES schedules(id) ON DELETE SET NULL,
  source             TEXT NOT NULL DEFAULT 'booking' CHECK (source IN ('booking', 'nudge', 'schedule')),
  service_date       DATE NOT NULL,
  pickup_mode        TEXT NOT NULL CHECK (pickup_mode IN ('doorstep', 'self_drop')),
  pickup_slot        TEXT NOT NULL,
  return_mode        TEXT NOT NULL CHECK (return_mode IN ('doorstep', 'self_collect')),
  return_date        DATE NOT NULL,
  return_slot        TEXT NOT NULL,
  est_pieces         INT NOT NULL DEFAULT 0,
  notes              TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested', 'accepted', 'picked_up', 'ready', 'delivered', 'cancelled')),
  subtotal           NUMERIC(10,2) NOT NULL DEFAULT 0,
  subscription_pieces INT NOT NULL DEFAULT 0,
  discount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total              NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission         NUMERIC(10,2) NOT NULL DEFAULT 0,
  subscription_id    BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  rating             INT CHECK (rating BETWEEN 1 AND 5),
  review             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at       TIMESTAMPTZ,
  ready_at           TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_presswala_date_idx ON orders (presswala_id, service_date);
CREATE INDEX IF NOT EXISTS orders_presswala_return_idx ON orders (presswala_id, return_date);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS orders_schedule_date_uniq ON orders (schedule_id, service_date)
  WHERE schedule_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  qty        INT NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(8,2) NOT NULL,
  is_regular BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Khata: running account between a customer and their presswala.
-- balance owed = sum(charge) - sum(confirmed payment)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              BIGSERIAL PRIMARY KEY,
  customer_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presswala_id    BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('charge', 'payment')),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method          TEXT NOT NULL DEFAULT '' CHECK (method IN ('', 'cash', 'upi')),
  order_id        BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE CASCADE,
  note            TEXT NOT NULL DEFAULT '',
  confirmed       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_pair_idx ON ledger_entries (presswala_id, customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_order_charge_uniq ON ledger_entries (order_id)
  WHERE kind = 'charge' AND order_id IS NOT NULL;

-- Commission the presswala has paid over to the platform.
CREATE TABLE IF NOT EXISTS settlements (
  id           BIGSERIAL PRIMARY KEY,
  presswala_id BIGINT NOT NULL REFERENCES presswalas(user_id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('commission_pct', '10'),
  ('subscription_commission_pct', '8')
ON CONFLICT (key) DO NOTHING;
