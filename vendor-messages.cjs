// SRSC Vendor Messages Route - registered by index.cjs on startup
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const db = new Database('./data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'srsc-secret-2024';

db.prepare('CREATE TABLE IF NOT EXISTS vendor_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER, sender_id INTEGER, subject TEXT, body TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();

function auth(req) {
  try {
    const a = req.headers.authorization;
    if (!a || !a.startsWith('Bearer ')) return null;
    return jwt.verify(a.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

function registerVendorMessagesRoute(app) {
  // Vendor fetches their own messages; admin can fetch any via ?vendor_id=
  app.get('/api/vendor-messages', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      let vendorId = u.id;
      if (u.role === 'admin' && req.query && req.query.vendor_id) {
        vendorId = parseInt(req.query.vendor_id, 10);
      }
      const rows = db.prepare('SELECT * FROM vendor_messages WHERE vendor_id = ? ORDER BY created_at DESC').all(vendorId);
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Admin sends a message to a vendor
  app.post('/api/vendor-messages', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (u.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const b = req.body || {};
      if (!b.vendor_id || !b.body) return res.status(400).json({ error: 'vendor_id and body are required' });
      const info = db.prepare('INSERT INTO vendor_messages (vendor_id, sender_id, subject, body) VALUES (?, ?, ?, ?)').run(b.vendor_id, u.id, b.subject || null, b.body);
      res.json({ id: info.lastInsertRowid, message: 'Message sent' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Mark a message read (vendor)
  app.put('/api/vendor-messages/:id/read', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      db.prepare('UPDATE vendor_messages SET read = 1 WHERE id = ? AND vendor_id = ?').run(req.params.id, u.id);
      res.json({ message: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerVendorMessagesRoute };
