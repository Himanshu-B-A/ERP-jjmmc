const express = require('express');
const { requireRole } = require('./helpers');
const router = express.Router();
const only = requireRole('faculty');

router.use(only, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(501).json({ error: 'Not yet migrated to Firestore.' });
  }
  const p = req.path;

  if (p.includes('stats')) return res.json({
    my_lectures_today:  0,
    total_lectures:     0,
    my_online_exams:    0,
    study_materials:    0,
    active_postings:    0,
    pending_case_logs:  0,
    pending_proc_logs:  0,
    my_lms_courses:     0,
    recent_notices:     [],
  });

  if (p.includes('students'))    return res.json({ students: [], total: 0 });
  if (p.includes('batches'))     return res.json({ items: [] });
  if (p.includes('courses'))     return res.json({ items: [] });
  if (p.includes('attendance'))  return res.json({ items: [], summary: {}, records: [] });
  if (p.includes('exams'))       return res.json({ items: [] });
  if (p.includes('results'))     return res.json({ items: [], exam: null, students: [] });
  if (p.includes('marks'))       return res.json({ items: [] });
  if (p.includes('lectures'))    return res.json({ items: [] });
  if (p.includes('study'))       return res.json({ items: [] });
  if (p.includes('lms'))         return res.json({ items: [], course: null, modules: [] });
  if (p.includes('online'))      return res.json({ items: [], exam: null, questions: [] });
  if (p.includes('timetable'))   return res.json({ items: [] });
  if (p.includes('clinical'))    return res.json({ items: [] });
  if (p.includes('case'))        return res.json({ items: [] });
  if (p.includes('procedure'))   return res.json({ items: [] });
  if (p.includes('allocation'))  return res.json({ items: [] });
  if (p.includes('notif'))       return res.json({ items: [] });
  if (p.includes('notices'))     return res.json({ items: [] });
  if (p.includes('profile'))     return res.json({ user: {}, employee: {} });
  if (p.includes('report'))      return res.json({ items: [] });
  if (p.includes('reminder'))    return res.json({ items: [] });
  if (p.includes('daily'))       return res.json({ items: [] });

  return res.json({ items: [], total: 0 });
});

module.exports = router;
