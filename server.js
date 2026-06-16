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

// API Routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/daybook', require('./routes/daybook'));
app.use('/api/cheques', require('./routes/cheques'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/settings', require('./routes/settings'));

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
