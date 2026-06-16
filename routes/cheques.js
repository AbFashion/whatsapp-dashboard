const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { sendMessage } = require('../utils/whatsapp');
const templates = require('../utils/templates');
const { readData, writeData, readObject } = require('../utils/dataStore');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET all cheques with filters
router.get('/', (req, res) => {
  const { status, search, dateFrom, dateTo } = req.query;
  let cheques = readData('cheques');

  if (status) cheques = cheques.filter(c => c.status === status);
  if (search) {
    const q = search.toLowerCase();
    cheques = cheques.filter(c =>
      c.accountName?.toLowerCase().includes(q) ||
      c.chequeNo?.toLowerCase().includes(q) ||
      c.bankName?.toLowerCase().includes(q)
    );
  }
  if (dateFrom) cheques = cheques.filter(c => c.chequeDate >= dateFrom);
  if (dateTo) cheques = cheques.filter(c => c.chequeDate <= dateTo);

  // Sort by cheque date descending
  cheques.sort((a, b) => new Date(b.chequeDate || 0) - new Date(a.chequeDate || 0));

  res.json({ success: true, data: cheques, total: cheques.length });
});

// GET cheque stats
router.get('/stats', (req, res) => {
  const cheques = readData('cheques');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const stats = {
    total: cheques.length,
    pending: cheques.filter(c => c.status === 'Pending').length,
    cleared: cheques.filter(c => c.status === 'Cleared').length,
    dishonored: cheques.filter(c => c.status === 'Dishonored').length,
    dueToday: cheques.filter(c => c.status === 'Pending' && c.chequeDate === today).length,
    dueTomorrow: cheques.filter(c => c.status === 'Pending' && c.chequeDate === tomorrow).length,
    totalPendingAmount: cheques.filter(c => c.status === 'Pending').reduce((s, c) => s + (c.amount || 0), 0),
    totalDishonoredAmount: cheques.filter(c => c.status === 'Dishonored').reduce((s, c) => s + (c.balance || c.amount || 0), 0)
  };

  res.json({ success: true, data: stats });
});

// GET upcoming cheques (pending, due within N days)
router.get('/upcoming', (req, res) => {
  const days = parseInt(req.query.days) || 3;
  const cheques = readData('cheques');
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);

  const upcoming = cheques.filter(c => {
    if (c.status !== 'Pending') return false;
    const d = parseDate(c.chequeDate);
    return d && d >= now && d <= future;
  });

  res.json({ success: true, data: upcoming, total: upcoming.length });
});

// POST add single cheque
router.post('/', (req, res) => {
  const { accountName, phone, chequeNo, bankName, amount, chequeDate, status, notes } = req.body;
  if (!accountName || !amount) {
    return res.status(400).json({ success: false, error: 'Account name and amount are required' });
  }

  const cheque = {
    id: uuidv4(),
    accountName: accountName.trim(),
    phone: phone?.trim() || '',
    chequeNo: chequeNo?.trim() || '',
    bankName: bankName?.trim() || '',
    amount: parseFloat(amount) || 0,
    balance: parseFloat(req.body.balance) || parseFloat(amount) || 0,
    chequeDate: chequeDate || '',
    status: status || 'Pending',
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString()
  };

  const cheques = readData('cheques');
  cheques.push(cheque);
  writeData('cheques', cheques);

  res.json({ success: true, data: cheque });
});

// PUT update cheque status
router.put('/:id', (req, res) => {
  const cheques = readData('cheques');
  const idx = cheques.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Cheque not found' });

  cheques[idx] = {
    ...cheques[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeData('cheques', cheques);
  res.json({ success: true, data: cheques[idx] });
});

// DELETE cheque
router.delete('/:id', (req, res) => {
  const cheques = readData('cheques');
  const idx = cheques.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Cheque not found' });
  cheques.splice(idx, 1);
  writeData('cheques', cheques);
  res.json({ success: true });
});

// POST send reminder for a specific cheque
router.post('/:id/send-reminder', async (req, res) => {
  const { reminderType } = req.body; // 'upcoming', 'cleared', 'dishonored'

  const cheques = readData('cheques');
  const cheque = cheques.find(c => c.id === req.params.id);
  if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

  if (!cheque.phone) {
    return res.status(400).json({ success: false, error: 'No phone number for this cheque entry' });
  }

  const settings = readObject('settings');
  if (!settings.phoneNumberId || !settings.accessToken) {
    return res.status(400).json({ success: false, error: 'WhatsApp API credentials not configured' });
  }

  // Build message
  const data = {
    name: cheque.accountName,
    chequeNo: cheque.chequeNo,
    bankName: cheque.bankName,
    amount: cheque.amount,
    balance: cheque.balance,
    chequeDate: cheque.chequeDate
  };

  let messageText;
  const type = reminderType || cheque.status.toLowerCase();
  if (type === 'upcoming' || type === 'pending') messageText = templates.chequeUpcoming(data);
  else if (type === 'cleared') messageText = templates.chequeCleared(data);
  else if (type === 'dishonored') messageText = templates.chequeDishonored(data);
  else messageText = templates.chequeUpcoming(data);

  try {
    const result = await sendMessage(cheque.phone, messageText, settings);

    const messageHistory = readData('messages');
    messageHistory.push({
      id: uuidv4(),
      contactName: cheque.accountName,
      phone: cheque.phone,
      category: 'cheque',
      messageType: type,
      amount: cheque.amount,
      chequeNo: cheque.chequeNo,
      status: 'sent',
      messageId: result.messageId,
      sentAt: new Date().toISOString(),
      messageText
    });
    writeData('messages', messageHistory);

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST bulk send upcoming reminders (for all cheques due tomorrow)
router.post('/bulk/send-upcoming', async (req, res) => {
  const cheques = readData('cheques');
  const settings = readObject('settings');

  if (!settings.phoneNumberId || !settings.accessToken) {
    return res.status(400).json({ success: false, error: 'WhatsApp API credentials not configured' });
  }

  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Also support DD-MM-YYYY format
  const tomorrowFormatted = `${String(tomorrow.getDate()).padStart(2,'0')}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${tomorrow.getFullYear()}`;

  const dueChecques = cheques.filter(c =>
    c.status === 'Pending' &&
    c.phone &&
    (c.chequeDate === tomorrowStr || c.chequeDate === tomorrowFormatted)
  );

  const results = [];
  const messageHistory = readData('messages');

  for (const cheque of dueChecques) {
    const data = {
      name: cheque.accountName,
      chequeNo: cheque.chequeNo,
      bankName: cheque.bankName,
      amount: cheque.amount,
      chequeDate: cheque.chequeDate
    };

    try {
      const messageText = templates.chequeUpcoming(data);
      const result = await sendMessage(cheque.phone, messageText, settings);

      messageHistory.push({
        id: uuidv4(),
        contactName: cheque.accountName,
        phone: cheque.phone,
        category: 'cheque',
        messageType: 'upcoming',
        amount: cheque.amount,
        status: 'sent',
        sentAt: new Date().toISOString(),
        messageText
      });

      results.push({ name: cheque.accountName, status: 'sent' });
      await sleep(300);
    } catch (err) {
      results.push({ name: cheque.accountName, status: 'failed', error: err.message });
    }
  }

  writeData('messages', messageHistory);

  res.json({
    success: true,
    results,
    summary: {
      total: dueChecques.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length
    }
  });
});

// POST import cheques from PDF
router.post('/import-pdf', upload.single('cheques'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No PDF uploaded' });

    const data = await pdfParse(req.file.buffer);
    const text = data.text;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const cheques = readData('cheques');
    let imported = 0;
    const errors = [];

    // Parse BillX Cheque List format
    // Sr# | Account Name | Mobile No. | Chq. Date | Chq. No | Bank Name | Status | Total | Balance
    for (const line of lines) {
      // Skip header lines
      if (line.match(/^Sr#|^Account|^Mobile|^-{3,}/i)) continue;

      // Look for lines with cheque data (starts with a number - serial number)
      const srMatch = line.match(/^(\d+)\s+(.+)/);
      if (!srMatch) continue;

      // Extract fields using regex patterns
      // Status can be: Cleared, Dishonored, Pending
      const statusMatch = line.match(/(Cleared|Dishonored|Pending)/i);
      if (!statusMatch) continue;

      const status = statusMatch[1];

      // Extract date (DD-MM-YYYY or DD/MM/YYYY)
      const dateMatches = [...line.matchAll(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g)];
      const chequeDate = dateMatches[0]?.[1] || '';

      // Extract amounts (numbers with commas)
      const amounts = [...line.matchAll(/\b([\d,]+)\b/g)]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => n > 100);

      const total = amounts[amounts.length - 2] || amounts[0] || 0;
      const balance = amounts[amounts.length - 1] || 0;

      // Extract phone number (10-11 digit number)
      const phoneMatch = line.match(/\b(0\d{10}|\d{10,11})\b/);
      const phone = phoneMatch?.[1] || '';

      // Extract cheque number (mixed alphanumeric, separate from large amounts)
      const chequeNoMatch = line.match(/\b([A-Z0-9]{4,12})\b(?!\d{6,})/);
      const chequeNo = chequeNoMatch?.[1] || '';

      // Try to extract bank name (common Pakistani banks)
      const banks = ['HBL', 'MCB', 'UBL', 'ABL', 'NBP', 'MEEZAN', 'FAYSAL', 'BANK ALFALAH', 'HABIB', 'ALLIED', 'ASKARI', 'STANDARD', 'SILK', 'SUMMIT'];
      let bankName = '';
      for (const bank of banks) {
        if (line.toUpperCase().includes(bank)) { bankName = bank; break; }
      }

      // Extract account name (non-numeric text between serial number and phone/date)
      const afterSr = line.substring(srMatch[1].length).trim();
      const nameMatch = afterSr.match(/^([A-Za-z][A-Za-z0-9\s\.\-\'&\/\(\)]+?)(?=\s+0\d|\s+\d{2}[-\/]|\s{4,})/);
      const accountName = nameMatch?.[1]?.trim() || '';

      if (accountName && total > 0) {
        // Check for duplicate
        const exists = cheques.find(c =>
          c.accountName?.toUpperCase() === accountName.toUpperCase() &&
          c.chequeNo === chequeNo &&
          c.chequeDate === chequeDate
        );

        if (!exists) {
          cheques.push({
            id: uuidv4(),
            accountName,
            phone,
            chequeNo,
            bankName,
            amount: total,
            balance: status === 'Cleared' ? 0 : (balance || total),
            chequeDate,
            status,
            createdAt: new Date().toISOString()
          });
          imported++;
        }
      }
    }

    writeData('cheques', cheques);
    res.json({
      success: true,
      imported,
      total: cheques.length,
      errors: errors.slice(0, 10)
    });

  } catch (err) {
    console.error('Cheque PDF import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function parseDate(str) {
  if (!str) return null;
  // Support DD-MM-YYYY and YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(str);
  const parts = str.split(/[-\/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = router;
