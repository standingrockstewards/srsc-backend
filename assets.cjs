// SRSC Asset Management + QR Route - registered by index.cjs on startup
// Each asset gets a unique qr_token; scanning /api/assets/qr/:token returns its info.
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = new Database('./data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'srsc-secret-2024';

db.prepare('CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY AUTOINCREMENT, property_id INTEGER, name TEXT, category TEXT, make TEXT, model TEXT, serial TEXT, location TEXT, install_date TEXT, warranty_expires TEXT, notes TEXT, qr_token TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();

function auth(req) {
  try {
    const a = req.headers.authorization;
    if (!a || !a.startsWith('Bearer ')) return null;
    return jwt.verify(a.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

function newToken() {
  return crypto.randomBytes(9).toString('hex');
}

function registerAssetsRoute(app) {
  // List assets (optionally by ?property_id=)
  app.get('/api/assets', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      let rows;
      if (req.query && req.query.property_id) {
        rows = db.prepare('SELECT a.*, p.nickname as property_name FROM assets a LEFT JOIN properties p ON p.id = a.property_id WHERE a.property_id = ? ORDER BY a.name').all(parseInt(req.query.property_id, 10));
      } else {
        rows = db.prepare('SELECT a.*, p.nickname as property_name FROM assets a LEFT JOIN properties p ON p.id = a.property_id ORDER BY a.name').all();
      }
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Create an asset (admin/tech); auto-assigns a QR token
  app.post('/api/assets', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!(u.role === 'admin' || u.role === 'field_tech')) return res.status(403).json({ error: 'Forbidden' });
      const b = req.body || {};
      if (!b.name) return res.status(400).json({ error: 'name is required' });
      const token = newToken();
      const info = db.prepare('INSERT INTO assets (property_id, name, category, make, model, serial, location, install_date, warranty_expires, notes, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(b.property_id || null, b.name, b.category || null, b.make || null, b.model || null, b.serial || null, b.location || null, b.install_date || null, b.warranty_expires || null, b.notes || null, token);
      res.json({ id: info.lastInsertRowid, qr_token: token });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Resolve a QR token to full asset info (auth required to protect client data)
  app.get('/api/assets/qr/:token', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      const row = db.prepare('SELECT a.*, p.nickname as property_name FROM assets a LEFT JOIN properties p ON p.id = a.property_id WHERE a.qr_token = ?').get(req.params.token);
      if (!row) return res.status(404).json({ error: 'Asset not found' });
      res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerAssetsRoute };
