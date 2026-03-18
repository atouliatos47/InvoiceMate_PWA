const express = require('express');
const router = express.Router();
const db = require('../db');

// GET settings
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT settings (upsert)
router.put('/', async (req, res) => {
  const {
    company_name, company_address, company_email, company_phone,
    company_logo_url, currency, currency_symbol, tax_rate, tax_name,
    invoice_prefix, next_invoice_no, bank_name, bank_account,
    bank_sort_code, payment_terms, notes
  } = req.body;

  try {
    const result = await db.query(`
      UPDATE settings SET
        company_name      = $1,
        company_address   = $2,
        company_email     = $3,
        company_phone     = $4,
        company_logo_url  = $5,
        currency          = $6,
        currency_symbol   = $7,
        tax_rate          = $8,
        tax_name          = $9,
        invoice_prefix    = $10,
        next_invoice_no   = $11,
        bank_name         = $12,
        bank_account      = $13,
        bank_sort_code    = $14,
        payment_terms     = $15,
        notes             = $16,
        updated_at        = NOW()
      WHERE id = 1
      RETURNING *
    `, [
      company_name, company_address, company_email, company_phone,
      company_logo_url, currency, currency_symbol, tax_rate, tax_name,
      invoice_prefix, next_invoice_no, bank_name, bank_account,
      bank_sort_code, payment_terms, notes
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
