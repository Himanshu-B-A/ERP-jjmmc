const express = require('express');
const { requireRole } = require('./helpers');
const router = express.Router();
const only = requireRole('student');

router.use(only, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(501).json({ error: 'Not yet migrated to Firestore.' });
  }
  const p = req.path;

  if (p.includes('profile'))       return res.json({ profile: {} });
  if (p.includes('attendance'))    return res.json({ summary: [], items: [], records: [] });
  if (p.includes('timetable'))     return res.json({ items: [] });
  if (p.includes('exam-schedule')) return res.json({ items: [] });
  if (p.includes('results'))       return res.json({ results: [] });
  if (p.includes('fees'))          return res.json({ items: [], total_paid: 0, pending: [] });
  if (p.includes('online-exams'))  return res.json({ items: [] });
  if (p.includes('study'))         return res.json({ items: [] });
  if (p.includes('lms'))           return res.json({ items: [], courses: [] });
  if (p.includes('electives'))     return res.json({ items: [] });
  if (p.includes('revaluation'))   return res.json({ items: [] });
  if (p.includes('hostel'))        return res.json({ allotment: null });
  if (p.includes('transport'))     return res.json({ allotment: null });
  if (p.includes('library'))       return res.json({ items: [], issued: [] });
  if (p.includes('clinical'))      return res.json({ items: [] });
  if (p.includes('case'))          return res.json({ items: [] });
  if (p.includes('procedure'))     return res.json({ items: [] });
  if (p.includes('allocation'))    return res.json({ items: [] });
  if (p.includes('notif'))         return res.json({ items: [] });
  if (p.includes('notices'))       return res.json({ items: [] });
  if (p.includes('placement'))     return res.json({ items: [] });
  if (p.includes('report'))        return res.json({ items: [] });

  return res.json({ items: [], total: 0 });
});

module.exports = router;
