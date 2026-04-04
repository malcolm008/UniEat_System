require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./db');

const RESET = process.argv.includes('--reset');

const migrations = [
  // ── USERS ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120) NOT NULL,
    email       VARCHAR(180) UNIQUE,
    reg_number  VARCHAR(60)  UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'student'
                CHECK (role IN ('student','staff','admin')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── MENU CATEGORIES ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(60)  NOT NULL UNIQUE,
    slug        VARCHAR(60)  NOT NULL UNIQUE,
    icon        VARCHAR(10),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── MENU ITEMS ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS menu_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(180) NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL CHECK (price > 0),
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    emoji         VARCHAR(10)  DEFAULT '🍽️',
    badge         VARCHAR(20)  CHECK (badge IN ('popular','new','')),
    calories      INTEGER,
    is_available  BOOLEAN NOT NULL DEFAULT true,
    image_url     VARCHAR(500),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── ORDERS ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_name      VARCHAR(120),
    guest_phone     VARCHAR(20),
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','preparing','ready','served','cancelled','refunded')),
    subtotal        INTEGER NOT NULL DEFAULT 0,
    service_charge  INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── ORDER ITEMS ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id  UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    name          VARCHAR(180) NOT NULL,
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    INTEGER NOT NULL CHECK (unit_price >= 0),
    subtotal      INTEGER NOT NULL DEFAULT 0
  )`,

  // ── PAYMENTS ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider            VARCHAR(30) NOT NULL
                        CHECK (provider IN ('mpesa','tigopesa','halopesa','cash')),
    phone_number        VARCHAR(20),
    amount              INTEGER NOT NULL CHECK (amount > 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','success','failed','refunded')),
    provider_ref        VARCHAR(120),
    provider_response   JSONB,
    initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
  )`,

  // ── QR TOKENS ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS qr_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token         VARCHAR(64)  NOT NULL UNIQUE,
    qr_image_url  TEXT,
    is_used       BOOLEAN NOT NULL DEFAULT false,
    used_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at       TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── DAILY MENUS ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_menus (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date          DATE NOT NULL,
    menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    is_available  BOOLEAN NOT NULL DEFAULT true,
    stock_count   INTEGER,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(date, menu_item_id)
  )`,

  // ── AUDIT LOG ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(80) NOT NULL,
    entity      VARCHAR(60),
    entity_id   VARCHAR(80),
    meta        JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── INDEXES ────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user_id       ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order_id    ON payments(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_tokens_token      ON qr_tokens(token)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_tokens_order_id   ON qr_tokens(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON menu_items(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_menus_date     ON daily_menus(date)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log(entity, entity_id)`,

  // ── AUTO-UPDATE updated_at ─────────────────────────────────────
  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_users_updated_at')
    THEN CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
   END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_menu_items_updated_at')
    THEN CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
   END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_orders_updated_at')
    THEN CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
   END $$`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    if (RESET) {
      console.log('⚠️  Dropping all tables...');
      await client.query(`
        DROP TABLE IF EXISTS audit_log, qr_tokens, payments, order_items,
        orders, daily_menus, menu_items, categories, users CASCADE
      `);
      console.log('✓ Tables dropped');
    }

    console.log('Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
    }
    console.log(`✓ ${migrations.length} migration steps completed`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();