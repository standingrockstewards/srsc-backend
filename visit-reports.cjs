// SRSC Visit Reports Route - saves completed reports and auto-emails the customer
// Registered by index.cjs on startup
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = new Database('./data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'srsc-secret-2024';

const mailer = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: { user: 'info@standingrockstewards.com', pass: process.env.ZOHO_PASS }
});

db.prepare('CREATE TABLE IF NOT EXISTS visit_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, property_id INTEGER, visit_id INTEGER, tech_id INTEGER, summary TEXT, details TEXT, status TEXT DEFAULT "completed", emailed INTEGER DEFAULT 0, email_to TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();

function auth(req) {
  try {
    const a = req.headers.authorization;
    if (!a || !a.startsWith('Bearer ')) return null;
    return jwt.verify(a.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

function buildEmailHtml(prop, report) {
  const name = (prop && prop.owner_name) || 'Valued Client';
  const nick = (prop && (prop.nickname || prop.address)) || 'your property';
  return '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">'
    + '<div style="background:#C05A43;color:#fff;padding:20px;"><h1 style="margin:0;font-size:20px;">Standing Rock Stewardship Co.</h1><p style="margin:4px 0 0;">Visit Report</p></div>'
    + '<div style="padding:24px;color:#1C1C1C;line-height:1.6;">'
    + '<p>Hello ' + name + ',</p>'
    + '<p>Our steward has just completed a visit at <strong>' + nick + '</strong>. Here is your report:</p>'
    + '<h3 style="color:#C05A43;margin-bottom:4px;">Summary</h3><p>' + ((report.summary) || '') + '</p>'
    + (report.details ? ('<h3 style="color:#C05A43;margin-bottom:4px;">Details</h3><p>' + report.details + '</p>') : '')
    + '<p style="margin-top:24px;color:#555;">Thank you for trusting Standing Rock Stewardship Co.<br>(918) 707-2228 &middot; info@standingrockstewards.com</p>'
    + '</div></div>';
}

function registerVisitReportsRoute(app) {
  // Tech or admin submits a completed report; customer is emailed immediately
  app.post('/api/visit-reports', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!(u.role === 'admin' || u.role === 'field_tech')) return res.status(403).json({ error: 'Forbidden' });
      const b = req.body || {};
      if (!b.property_id || !b.summary) return res.status(400).json({ error: 'property_id and summary are required' });
      const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(b.property_id);
      if (!prop) return res.status(404).json({ error: 'Property not found' });
      const to = b.email_to || prop.owner_email;
      const info = db.prepare('INSERT INTO visit_reports (property_id, visit_id, tech_id, summary, details, email_to) VALUES (?, ?, ?, ?, ?, ?)')
        .run(b.property_id, b.visit_id || null, u.id, b.summary, b.details || null, to || null);
      const reportId = info.lastInsertRowid;
      if (!to) {
        return res.json({ id: reportId, emailed: false, warning: 'No owner_email on file; report saved but not emailed' });
      }
      mailer.sendMail({
        from: '"Standing Rock Stewardship" <info@standingrockstewards.com>',
        to: to,
        subject: 'Your Standing Rock visit report - ' + ((prop.nickname) || ('Property #' + prop.id)),
        html: buildEmailHtml(prop, b)
      }, function (err) {
        if (err) {
          console.error('[visit-reports] email error:', err.message);
        } else {
          try { db.prepare('UPDATE visit_reports SET emailed = 1 WHERE id = ?').run(reportId); } catch (e) {}
          console.log('[visit-reports] report ' + reportId + ' emailed to ' + to);
        }
      });
      res.json({ id: reportId, emailed: true, email_to: to });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // List reports: admin sees all; tech sees own; client sees own property reports
  app.get('/api/visit-reports', function (req, res) {
    try {
      const u = auth(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      let rows;
      if (u.role === 'admin') {
        rows = db.prepare('SELECT vr.*, p.nickname as property_name FROM visit_reports vr LEFT JOIN properties p ON p.id = vr.property_id ORDER BY vr.created_at DESC').all();
      } else if (u.role === 'field_tech') {
        rows = db.prepare('SELECT vr.*, p.nickname as property_name FROM visit_reports vr LEFT JOIN properties p ON p.id = vr.property_id WHERE vr.tech_id = ? ORDER BY vr.created_at DESC').all(u.id);
      } else {
        rows = db.prepare('SELECT vr.*, p.nickname as property_name FROM visit_reports vr LEFT JOIN properties p ON p.id = vr.property_id WHERE p.client_user_id = ? ORDER BY vr.created_at DESC').all(u.id);
      }
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { registerVisitReportsRoute };
