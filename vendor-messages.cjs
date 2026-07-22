// SRSC Vendor Messages Route - registered by index.cjs on startup
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const db = new Database('./data.db');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('[SRSC] FATAL: JWT_SECRET env var is not set.'); process.exit(1); }

db.prepare('CREATE TABLE IF NOT EXISTS vendor_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER, sender_id INTEGER, subject TEXT, body TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run(); db.prepare('CREATE TABLE IF NOT EXISTS vendor_work_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER, title TEXT, description TEXT, property_name TEXT, scheduled_date TEXT, status TEXT DEFAULT \'assigned\', created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run(); db.prepare('CREATE TABLE IF NOT EXISTS vendor_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER, doc_type TEXT, status TEXT DEFAULT \'not_on_file\', note TEXT, requested_by INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();

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
  // Work orders: vendor sees own; admin can assign and view any
    app.get('/api/vendor-work-orders', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        let vendorId = u.id;
        if (u.role === 'admin' && req.query && req.query.vendor_id) vendorId = parseInt(req.query.vendor_id, 10);
        const rows = db.prepare('SELECT * FROM vendor_work_orders WHERE vendor_id = ? ORDER BY created_at DESC').all(vendorId);
        res.json(rows);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.post('/api/vendor-work-orders', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        if (u.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const b = req.body || {};
        if (!b.vendor_id || !b.title) return res.status(400).json({ error: 'vendor_id and title are required' });
        const info = db.prepare('INSERT INTO vendor_work_orders (vendor_id, title, description, property_name, scheduled_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(b.vendor_id, b.title, b.description || null, b.property_name || null, b.scheduled_date || null, b.status || 'assigned', u.id);
        res.json({ id: info.lastInsertRowid, message: 'Work order created' });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.put('/api/vendor-work-orders/:id/status', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        const b = req.body || {};
        if (!b.status) return res.status(400).json({ error: 'status is required' });
        if (u.role === 'admin') {
          db.prepare('UPDATE vendor_work_orders SET status = ? WHERE id = ?').run(b.status, req.params.id);
        } else {
          db.prepare('UPDATE vendor_work_orders SET status = ? WHERE id = ? AND vendor_id = ?').run(b.status, req.params.id, u.id);
        }
        res.json({ message: 'ok' });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
  // Vendor documents: vendor sees own; admin requests/updates status
    app.get('/api/vendor-documents', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        let vendorId = u.id;
        if (u.role === 'admin' && req.query && req.query.vendor_id) vendorId = parseInt(req.query.vendor_id, 10);
        const rows = db.prepare('SELECT * FROM vendor_documents WHERE vendor_id = ? ORDER BY doc_type ASC').all(vendorId);
        res.json(rows);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.post('/api/vendor-documents', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        if (u.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const b = req.body || {};
        if (!b.vendor_id || !b.doc_type) return res.status(400).json({ error: 'vendor_id and doc_type are required' });
        const info = db.prepare('INSERT INTO vendor_documents (vendor_id, doc_type, status, note, requested_by) VALUES (?, ?, ?, ?, ?)').run(b.vendor_id, b.doc_type, b.status || 'requested', b.note || null, u.id);
        res.json({ id: info.lastInsertRowid, message: 'Document request created' });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.put('/api/vendor-documents/:id/status', function (req, res) {
      try {
        const u = auth(req);
        if (!u) return res.status(401).json({ error: 'Unauthorized' });
        if (u.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const b = req.body || {};
        if (!b.status) return res.status(400).json({ error: 'status is required' });
        db.prepare('UPDATE vendor_documents SET status = ?, note = COALESCE(?, note), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(b.status, b.note || null, req.params.id);
        res.json({ message: 'ok' });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
}

module.exports = { registerVendorMessagesRoute };
