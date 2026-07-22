// SRSC Change Password Route - bcrypt secured
// Registered by index.cjs on startup
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const db = new Database('./data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'srsc-secret-2024';

function registerChangePasswordRoute(app) {
  app.put('/api/auth/change-password', async (req, res) => {
    try {
      // Verify token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }
      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
            // Any authenticated user may change their OWN password (self-service).
      // Security is preserved by requiring a valid token + correct currentPassword below.
      // The password updated is always the one belonging to decoded.id.
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      // Verify current password against bcrypt hash
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      // Hash and store the new password
      const newHash = await bcrypt.hash(newPassword, 12);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('[change-password] Error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  console.log('[SRSC] /api/auth/change-password route registered');
}

module.exports = { registerChangePasswordRoute };
