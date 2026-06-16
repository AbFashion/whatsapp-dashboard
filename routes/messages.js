const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../utils/dataStore');

// GET message history with filters
router.get('/', (req, res) => {
  const { category, status, search, date, limit = 100, offset = 0 } = req.query;
  let messages = readData('messages');

  // Sort newest first
  messages.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  if (category) messages = messages.filter(m => m.category === category);
  if (status) messages = messages.filter(m => m.status === status);
  if (search) {
    const q = search.toLowerCase();
    messages = messages.filter(m =>
      m.contactName?.toLowerCase().includes(q) ||
      m.phone?.includes(q)
    );
  }
  if (date) {
    messages = messages.filter(m => m.sentAt?.startsWith(date));
  }

  const total = messages.length;
  const paginated = messages.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({ success: true, data: paginated, total });
});

// GET stats
router.get('/stats', (req, res) => {
  const messages = readData('messages');
  const today = new Date().toISOString().split('T')[0];
  const todayMessages = messages.filter(m => m.sentAt?.startsWith(today));

  res.json({
    success: true,
    data: {
      totalSent: messages.filter(m => m.status === 'sent').length,
      totalFailed: messages.filter(m => m.status === 'failed').length,
      todaySent: todayMessages.filter(m => m.status === 'sent').length,
      todayFailed: todayMessages.filter(m => m.status === 'failed').length,
      byCategory: {
        receivable: messages.filter(m => m.category === 'receivable').length,
        payment: messages.filter(m => m.category === 'payment').length,
        staff: messages.filter(m => m.category === 'staff').length,
        tp: messages.filter(m => m.category === 'tp').length,
        cheque: messages.filter(m => m.category === 'cheque').length
      }
    }
  });
});

// DELETE all messages (clear history)
router.delete('/all', (req, res) => {
  writeData('messages', []);
  res.json({ success: true });
});

module.exports = router;
