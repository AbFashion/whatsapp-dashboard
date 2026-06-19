require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Initialize default data files if they don't exist
const defaultFiles = {
  'customers.json': '[]',
  'suppliers.json': '[]',
  'cheques.json': '[]',
  'messages.json': '[]',
  'inbox.json': '[]',
  'settings.json': '{}',
  'daybook_sessions.json': '{}'
};

for (const [file, defaultContent] of Object.entries(defaultFiles)) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent, 'utf8');
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// WhatsApp Webhook (root-level — Meta requires /webhook, not /api/...)
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'abfashion2024';
const { readData: _rData, writeData: _wData } = require('./utils/dataStore');
const { v4: _uuid } = require('uuid');

app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value    = change.value || {};
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          const phone   = msg.from;
          const contact = contacts.find(c => c.wa_id === phone);
          const name    = contact?.profile?.name || phone;
          let text = '';
          if (msg.type === 'text')          text = msg.text?.body || '';
          else if (msg.type === 'image')    text = '📷 Image';
          else if (msg.type === 'document') text = '📄 Document';
          else if (msg.type === 'audio')    text = '🎵 Audio';
          else if (msg.type === 'video')    text = '📹 Video';
          else                              text = `[${msg.type}]`;

          const inbox = _rData('inbox');
          const ts    = new Date(parseInt(msg.timestamp) * 1000).toISOString();
          const idx   = inbox.findIndex(c => c.phone === phone);
          if (idx !== -1) {
            inbox[idx].messages.push({ id: _uuid(), waMessageId: msg.id, text, direction: 'in', timestamp: ts });
            inbox[idx].lastMessage = text;
            inbox[idx].lastAt      = ts;
            inbox[idx].unread      = (inbox[idx].unread || 0) + 1;
            inbox[idx].contactName = name;
          } else {
            inbox.unshift({ id: _uuid(), phone, contactName: name, lastMessage: text, lastAt: ts, unread: 1,
              messages: [{ id: _uuid(), waMessageId: msg.id, text, direction: 'in', timestamp: ts }] });
          }
          _wData('inbox', inbox);
        }
      }
    }
    return res.sendStatus(200);
  }
  res.sendStatus(404);
});

// API Routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/daybook', require('./routes/daybook'));
app.use('/api/cheques', require('./routes/cheques'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/inbox', require('./routes/inbox'));

// Dashboard overview stats
app.get('/api/dashboard', (req, res) => {
  const { readData, readObject } = require('./utils/dataStore');
  const customers = readData('customers');
  const suppliers = readData('suppliers');
  const cheques = readData('cheques');
  const messages = readData('messages');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Format date DD-MM-YYYY for cheque comparison
  const d = new Date(Date.now() + 86400000);
  const tomorrowDDMMYYYY = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

  const todayMessages = messages.filter(m => m.sentAt?.startsWith(today));

  res.json({
    success: true,
    data: {
      contacts: {
        customers: customers.length,
        suppliers: suppliers.length,
        blacklisted: customers.filter(c => c.blacklisted).length
      },
      cheques: {
        pending: cheques.filter(c => c.status === 'Pending').length,
        cleared: cheques.filter(c => c.status === 'Cleared').length,
        dishonored: cheques.filter(c => c.status === 'Dishonored').length,
        dueTomorrow: cheques.filter(c =>
          c.status === 'Pending' &&
          (c.chequeDate === tomorrow || c.chequeDate === tomorrowDDMMYYYY)
        ).length
      },
      messages: {
        todaySent: todayMessages.filter(m => m.status === 'sent').length,
        totalSent: messages.filter(m => m.status === 'sent').length,
        totalFailed: messages.filter(m => m.status === 'failed').length
      },
      settings: {
        configured: !!readObject('settings').accessToken
      }
    }
  });
});

// Catch-all: serve frontend for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   AB Fashion Jewellery - WhatsApp Dashboard   ║
║   Server running at: http://localhost:${PORT}  ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
