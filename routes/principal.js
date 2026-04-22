const express = require('express');
const { requireRole } = require('./helpers');
const router = express.Router();
const only = requireRole('principal');

router.use(only, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(501).json({ error: 'Not yet migrated to Firestore.' });
  }
  const p = req.path;
  if (p.includes('stats'))       return res.json({ totals: {} });
  if (p.includes('students'))    return res.json({ students: [], total: 0 });
  if (p.includes('faculty'))     return res.json({ items: [] });
  if (p.includes('batches'))     return res.json({ items: [] });
  if (p.includes('attendance'))  return res.json({ items: [], summary: {} });
  if (p.includes('exams'))       return res.json({ items: [] });
  if (p.includes('results'))     return res.json({ items: [] });
  if (p.includes('fees'))        return res.json({ items: [], total: 0 });
  if (p.includes('timetable'))   return res.json({ items: [] });
  if (p.includes('clinical'))    return res.json({ items: [] });
  if (p.includes('report'))      return res.json({ items: [] });
  if (p.includes('notif'))       return res.json({ items: [] });
  if (p.includes('notices'))     return res.json({ items: [] });
  if (p.includes('logs'))        return res.json({ items: [] });
  if (p.includes('profile'))     return res.json({});
  return res.json({ items: [], total: 0 });
});

module.exports = router;
