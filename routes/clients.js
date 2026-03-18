const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all clients
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM clients ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET single client
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM clients WHERE id = $1', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// POST create client
router.post('/', async (req, res) => {
  const { name, email, phone, address, city, postcode, country, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name is required' });

  try {
    const result = await db.query(`
      INSERT INTO clients (name, email, phone, address, city, postcode, country, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [name, email, phone, address, city, postcode, country || 'United Kingdom', notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  const { name, email, phone, address, city, postcode, country, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name is required' });

  try {
    const result = await db.query(`
      UPDATE clients SET
        name      = $1, email   = $2, phone    = $3,
        address   = $4, city    = $5, postcode = $6,
        country   = $7, notes   = $8, updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [name, email, phone, address, city, postcode, country, notes, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
