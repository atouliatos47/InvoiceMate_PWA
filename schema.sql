-- InvoiceMate Database Schema
-- Run this once in your Neon SQL editor

CREATE TABLE IF NOT EXISTS settings (
  id          SERIAL PRIMARY KEY,
  company_name      TEXT,
  company_address   TEXT,
  company_email     TEXT,
  company_phone     TEXT,
  company_logo_url  TEXT,
  currency          TEXT DEFAULT 'GBP',
  currency_symbol   TEXT DEFAULT '£',
  tax_rate          NUMERIC(5,2) DEFAULT 20.00,
  tax_name          TEXT DEFAULT 'VAT',
  invoice_prefix    TEXT DEFAULT 'INV',
  next_invoice_no   INTEGER DEFAULT 1,
  bank_name         TEXT,
  bank_account      TEXT,
  bank_sort_code    TEXT,
  payment_terms     TEXT DEFAULT 'Payment due within 30 days.',
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Insert default settings row (only one row ever exists)
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  postcode    TEXT,
  country     TEXT DEFAULT 'United Kingdom',
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  TEXT NOT NULL UNIQUE,
  client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_snapshot JSONB,         -- snapshot of client at time of invoice
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date      DATE DEFAULT CURRENT_DATE,
  due_date        DATE,
  template        TEXT DEFAULT 'classic',
  currency        TEXT DEFAULT 'GBP',
  currency_symbol TEXT DEFAULT '£',
  subtotal        NUMERIC(12,2) DEFAULT 0,
  tax_rate        NUMERIC(5,2)  DEFAULT 20,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10,2) DEFAULT 1,
  unit_price   NUMERIC(12,2) DEFAULT 0,
  line_total   NUMERIC(12,2) DEFAULT 0,
  sort_order   INTEGER DEFAULT 0
);
