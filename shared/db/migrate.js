require('dotenv').config({ path: require('path').join(__dirname, '../../main-system/backend/.env') });
const { pool } = require('./db');

const RESET = process.argv.includes('--reset');

const migrations = [

  `CREATE TABLE IF NOT EXISTS super_admins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(120) NOT NULL,
    email               VARCHAR(180) UNIQUE NOT NULL,
    password            VARCHAR(255) NOT NULL,
    role                VARCHAR(30) DEFAULT 'super_admin'
                        CHECK (role IN ('super_admin','system_owner')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── UNIVERSITIES (TENANT) ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS universities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(180) NOT NULL UNIQUE,
    domain              VARCHAR(120) UNIQUE,
    email               VARCHAR(180) UNIQUE NOT NULL,
    phone               VARCHAR(20),
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(100) DEFAULT 'Tanzania',
    logo_url            VARCHAR(500),
    status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('active','inactive','pending','suspended')),
    subscription_status VARCHAR(30) NOT NULL DEFAULT 'inactive'
                        CHECK (subscription_status IN ('active','inactive','expired')),
    subscription_start  TIMESTAMPTZ,
    subscription_end    TIMESTAMPTZ,
    max_users           INTEGER DEFAULT 5000,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── SUBSCRIPTIONS (Payment History) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    amount              INTEGER NOT NULL,
    currency            VARCHAR(3) DEFAULT 'USD',
    billing_cycle       VARCHAR(20) NOT NULL DEFAULT 'annual'
                        CHECK (billing_cycle IN ('monthly','annual')),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('active','expired','pending','cancelled')),
    start_date          TIMESTAMPTZ NOT NULL,
    end_date            TIMESTAMPTZ NOT NULL,
    payment_method      VARCHAR(30),
    payment_reference   VARCHAR(200),
    notes               TEXT,
    created_by          UUID REFERENCES super_admins(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── SUBSCRIPTIONS-LOGS (Payment History) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS subscription_logs (
      id                  BIGSERIAL PRIMARY KEY,
      university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      action              VARCHAR(50) NOT NULL,
      details             JSONB,
      created_by          UUID,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── SYSTEM-SETTINGS  ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      setting_type VARCHAR(20) DEFAULT 'string',
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID REFERENCES super_admins(id)
  )`,

  // ── USERS ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120) NOT NULL,
    display_name VARCHAR(120),
    email       VARCHAR(180) UNIQUE,
    reg_number  VARCHAR(60)  UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'student'
                CHECK (role IN ('student','staff','admin')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
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

  // ── MENU ITEMS (updated with category field instead of category_id) ──
  `CREATE TABLE IF NOT EXISTS menu_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(180) NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL CHECK (price > 0),
    category      VARCHAR(50) DEFAULT 'other',
    emoji         VARCHAR(10)  DEFAULT '🍽️',
    badge         VARCHAR(20)  CHECK (badge IN ('popular','new','')),
    calories      INTEGER,
    is_available  BOOLEAN NOT NULL DEFAULT true,
    image_url     VARCHAR(500),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── ORDERS (with vendor_id and university_id) ─────────────────────
  `CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    vendor_id       UUID REFERENCES users(id),
    university_id   UUID REFERENCES universities(id) ON DELETE CASCADE,
    guest_name      VARCHAR(120),
    guest_phone     VARCHAR(20),
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','pending_verification','paid','preparing','ready','served','cancelled','refunded','completed')),
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

  // ── PAYMENTS (with university_id) ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    university_id       UUID REFERENCES universities(id) ON DELETE CASCADE,
    provider            VARCHAR(30) NOT NULL
                        CHECK (provider IN ('mpesa','tigopesa','airtelmoney','halopesa','selcom','cash')),
    phone_number        VARCHAR(20),
    amount              INTEGER NOT NULL CHECK (amount > 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','pending_verification','processing','success','failed','refunded')),
    payment_method      VARCHAR(20) DEFAULT 'lipa',
    provider_ref        VARCHAR(120),
    provider_response   JSONB,
    initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
  )`,

  // ── QR TOKENS (with university_id) ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS qr_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    token         VARCHAR(64)  NOT NULL UNIQUE,
    qr_image_url  TEXT,
    is_used       BOOLEAN NOT NULL DEFAULT false,
    used_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at       TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── DAILY MENUS (with university_id) ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_menus (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date          DATE NOT NULL,
    menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    is_available  BOOLEAN NOT NULL DEFAULT true,
    stock_count   INTEGER,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(date, menu_item_id, university_id)
  )`,

  // ── VENDOR PAYMENT METHODS (with university_id) ─────────────────
  `CREATE TABLE IF NOT EXISTS vendor_payment_methods (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      method_type         VARCHAR(20) NOT NULL DEFAULT 'lipa'
                          CHECK (method_type IN ('lipa', 'stk')),
      provider            VARCHAR(30) NOT NULL
                          CHECK (provider IN ('mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'selcom')),
      lipa_number         VARCHAR(20),
      account_name        VARCHAR(100),
      api_key             TEXT,
      api_secret          TEXT,
      merchant_id         VARCHAR(100),
      api_endpoint        VARCHAR(255),
      is_active           BOOLEAN NOT NULL DEFAULT true,
      is_default          BOOLEAN NOT NULL DEFAULT false,
      settings            JSONB DEFAULT '{}',
      created_by          UUID REFERENCES users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(vendor_id, provider, university_id)
  )`,

  // ── TRANSACTIONS (with university_id) ───────────────────────────
  `CREATE TABLE IF NOT EXISTS transactions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      vendor_id           UUID NOT NULL REFERENCES users(id),
      customer_id         UUID REFERENCES users(id),
      university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      amount              INTEGER NOT NULL,
      phone_number        VARCHAR(20),
      transaction_code    VARCHAR(100) UNIQUE,
      provider            VARCHAR(30),
      payment_method      VARCHAR(20),
      status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'pending_verification', 'processing', 'success', 'failed', 'refunded', 'cancelled')),
      provider_reference  VARCHAR(200),
      provider_response   JSONB,
      verified_by         UUID REFERENCES users(id),
      verified_at         TIMESTAMPTZ,
      notes               TEXT,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── QR CODES (with university_id) ───────────────────────────────
  `CREATE TABLE IF NOT EXISTS qr_codes (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      token               VARCHAR(100) NOT NULL UNIQUE,
      qr_image_url        TEXT,
      is_used             BOOLEAN NOT NULL DEFAULT false,
      used_by             UUID REFERENCES users(id),
      used_at             TIMESTAMPTZ,
      expires_at          TIMESTAMPTZ NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  `CREATE INDEX IF NOT EXISTS idx_users_university_id ON users(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_university_subscription ON users(university_id, is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_universities_status ON universities(status, subscription_status)`,
  `CREATE INDEX IF NOT EXISTS idx_universities_subscription_end ON universities(subscription_end)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_university_id ON subscriptions(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_subscription_logs_university_id ON subscription_logs(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscription_logs_created_at ON subscription_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user_id       ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_vendor_id     ON orders(vendor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_university_id ON orders(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order_id    ON payments(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_university  ON payments(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_tokens_token      ON qr_tokens(token)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_tokens_order_id   ON qr_tokens(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_tokens_university ON qr_tokens(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON menu_items(category)`,
  `CREATE INDEX IF NOT EXISTS idx_menu_items_university ON menu_items(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_menus_date     ON daily_menus(date)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_menus_university ON daily_menus(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log(entity, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vendor_payment_methods_university ON vendor_payment_methods(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_university ON transactions(university_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(transaction_code)`,

  // ── ADD missing columns to existing tables ─────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,
  `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,
  `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES users(id)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'lipa'`,
  `ALTER TABLE qr_tokens ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,
  `ALTER TABLE daily_menus ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE`,

  // ── DROP old category_id if exists ─────────────────────────────
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'category_id') THEN
       ALTER TABLE menu_items DROP COLUMN category_id;
     END IF;
   END $$`,

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

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_vendor_payment_methods_updated_at')
    THEN CREATE TRIGGER trg_vendor_payment_methods_updated_at BEFORE UPDATE ON vendor_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
   END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_transactions_updated_at')
    THEN CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
   END $$`,

  // ── AUTO-CHECK SUBSCRIPTION STATUS ────────────────────────────────
  `CREATE OR REPLACE FUNCTION check_subscription_status()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.subscription_end IS NOT NULL AND NEW.subscription_end < NOW() THEN
       NEW.subscription_status := 'expired';
     ELSIF NEW.subscription_status = 'active' AND NEW.subscription_end > NOW() THEN
       NEW.subscription_status := 'active';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_check_subscription ON universities`,

  `CREATE TRIGGER trg_check_subscription
   BEFORE UPDATE ON universities
   FOR EACH ROW
   EXECUTE FUNCTION check_subscription_status()`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    if (RESET) {
      console.log('⚠️  Dropping all tables...');
      await client.query(`
        DROP TABLE IF EXISTS audit_log, qr_codes, qr_tokens, transactions, vendor_payment_methods,
        payments, order_items, orders, daily_menus, menu_items, categories, users,
        universities, super_admins, subscriptions, subscription_logs, system_settings CASCADE
      `);
      console.log('✓ Tables dropped');
    }

    console.log('Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
      console.log('✓ Executed migration step');
    }
    console.log(`✓ ${migrations.length} migration steps completed`);
    console.log('✅ Database migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();