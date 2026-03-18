const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all invoices (with client name)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*, c.name AS client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET single invoice with items
router.get('/:id', async (req, res) => {
  try {
    const inv = await db.query(
      'SELECT * FROM invoices WHERE id = $1', [req.params.id]
    );
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });

    const items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
      [req.params.id]
    );
    res.json({ ...inv.rows[0], items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST create invoice
router.post('/', async (req, res) => {
  const {
    client_id, client_snapshot, issue_date, due_date,
    template, currency, currency_symbol,
    tax_rate, notes, items = []
  } = req.body;

  const client = await db.begin ? null : null; // plain pool, no transaction helper

  try {
    // Generate invoice number
    const settingsRes = await db.query(
      'SELECT invoice_prefix, next_invoice_no FROM settings WHERE id = 1'
    );
    const { invoice_prefix, next_invoice_no } = settingsRes.rows[0];
    const invoice_number = `${invoice_prefix}-${String(next_invoice_no).padStart(4, '0')}`;

    // Calculate totals
    const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const tax_amount = parseFloat(((subtotal * tax_rate) / 100).toFixed(2));
    const total = parseFloat((subtotal + tax_amount).toFixed(2));

    // Insert invoice
    const invRes = await db.query(`
      INSERT INTO invoices
        (invoice_number, client_id, client_snapshot, issue_date, due_date,
         template, currency, currency_symbol, subtotal, tax_rate, tax_amount, total, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      invoice_number, client_id, JSON.stringify(client_snapshot),
      issue_date, due_date, template || 'classic',
      currency || 'GBP', currency_symbol || '£',
      subtotal, tax_rate, tax_amount, total, notes
    ]);

    const invoice = invRes.rows[0];

    // Insert line items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const line_total = parseFloat((it.quantity * it.unit_price).toFixed(2));
      await db.query(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [invoice.id, it.description, it.quantity, it.unit_price, line_total, i]);
    }

    // Increment next invoice number
    await db.query(
      'UPDATE settings SET next_invoice_no = next_invoice_no + 1 WHERE id = 1'
    );

    res.status(201).json({ ...invoice, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  const {
    client_id, client_snapshot, issue_date, due_date,
    template, currency, currency_symbol,
    tax_rate, status, notes, items = []
  } = req.body;

  try {
    // Recalculate totals
    const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const tax_amount = parseFloat(((subtotal * tax_rate) / 100).toFixed(2));
    const total = parseFloat((subtotal + tax_amount).toFixed(2));

    const invRes = await db.query(`
      UPDATE invoices SET
        client_id = $1, client_snapshot = $2, issue_date = $3, due_date = $4,
        template = $5, currency = $6, currency_symbol = $7,
        subtotal = $8, tax_rate = $9, tax_amount = $10, total = $11,
        status = $12, notes = $13, updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      client_id, JSON.stringify(client_snapshot), issue_date, due_date,
      template, currency, currency_symbol,
      subtotal, tax_rate, tax_amount, total,
      status, notes, req.params.id
    ]);

    if (!invRes.rows.length) return res.status(404).json({ error: 'Invoice not found' });

    // Replace line items
    await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const line_total = parseFloat((it.quantity * it.unit_price).toFixed(2));
      await db.query(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [req.params.id, it.description, it.quantity, it.unit_price, line_total, i]);
    }

    res.json({ ...invRes.rows[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// PATCH status only
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
