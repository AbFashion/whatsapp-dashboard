const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData, readObject } = require('../utils/dataStore');
const { sendMessage } = require('../utils/whatsapp');

// ── GET /api/inbox  — List all conversations ──
router.get('/', (req, res) => {
  const inbox  = readData('inbox');
  // Sort by lastAt desc
  inbox.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  const unread = inbox.reduce((sum, c) => sum + (c.unread || 0), 0);
  res.json({ success: true, data: inbox, total: inbox.length, unread });
});

// ── GET /api/inbox/:id  — Get single conversation ──
router.get('/:id', (req, res) => {
  const inbox = readData('inbox');
  const conv  = inbox.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: conv });
});

// ── POST /api/inbox/:id/reply  — Reply to a conversation ──
router.post('/:id/reply', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message required' });

  const inbox = readData('inbox');
  const idx   = inbox.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Conversation not found' });

  const settings = readObject('settings');
  try {
    const result = await sendMessage(inbox[idx].phone, message.trim(), settings);

    inbox[idx].messages = inbox[idx].messages || [];
    inbox[idx].messages.push({
      id:        uuidv4(),
      text:      message.trim(),
      direction: 'out',
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });
    inbox[idx].lastMessage = message.trim();
    inbox[idx].lastAt      = new Date().toISOString();
    inbox[idx].unread      = 0;

    writeData('inbox', inbox);
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/inbox/:id/read  — Mark conversation as read ──
router.put('/:id/read', (req, res) => {
  const inbox = readData('inbox');
  const idx   = inbox.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
  inbox[idx].unread = 0;
  writeData('inbox', inbox);
  res.json({ success: true });
});

// ── DELETE /api/inbox/all  — Clear all conversations ──
router.delete('/all', (req, res) => {
  writeData('inbox', []);
  res.json({ success: true });
});

module.exports = router;
