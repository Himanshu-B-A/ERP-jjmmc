const express = require('express');
const { requireRole } = require('./helpers');
const router = express.Router();
const only = requireRole('parent');

router.use(only, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(501).json({ error: 'Not yet migrated to Firestore.' });
  }
  const p = req.path;

  if (p.includes('dashboard'))   return res.json({ ward: {}, total_fees_paid: 0, attendance: [], notices: [] });
  if (p.includes('ward'))        return res.json({ ward: {} });
  if (p.includes('attendance'))  return res.json({ items: [], summary: [] });
  if (p.includes('fees'))        return res.json({ items: [], total_paid: 0 });
  if (p.includes('results'))     return res.json({ results: [] });
  if (p.includes('notices'))     return res.json({ items: [] });
  if (p.includes('notif'))       return res.json({ items: [] });

  return res.json({ items: [], total: 0 });
});

module.exports = router;
