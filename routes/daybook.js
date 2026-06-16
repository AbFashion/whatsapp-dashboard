const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { parseDayBookEnhanced } = require('../utils/pdfParser');
const { sendMessage } = require('../utils/whatsapp');
const templates = require('../utils/templates');
const { readData, writeData, readObject } = require('../utils/dataStore');

// Multer: store PDF in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  }
});

// POST upload and parse Day Book PDF
router.post('/upload', upload.single('daybook'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No PDF file uploaded' });

    const parsed = await parseDayBookEnhanced(req.file.buffer);

    // Try to match parsed entries with known contacts for phone numbers
    const customers = readData('customers');
    const suppliers = readData('suppliers');
    const allContacts = [...customers, ...suppliers];

    // Enrich entries with phone numbers from contact directory
    for (const [category, entries] of Object.entries(parsed.categories || {})) {
      for (const entry of entries) {
        // Fuzzy match by name
        const match = allContacts.find(c => {
          const cName = c.name?.toUpperCase().replace(/\s+/g, ' ').trim();
          const eName = entry.accountName?.toUpperCase().replace(/\s+/g, ' ').trim();
          return cName === eName ||
            cName?.includes(eName) ||
            eName?.includes(cName);
        });

        if (match) {
          entry.phone = match.phone;
          entry.contactId = match.id;
          entry.blacklisted = match.blacklisted;
        }
      }
    }

    // Store parsed result temporarily for sending
    const sessionId = uuidv4();
    const sessions = readObject('daybook_sessions') || {};
    sessions[sessionId] = {
      ...parsed,
      uploadedAt: new Date().toISOString(),
      fileName: req.file.originalname
    };
    writeData('daybook_sessions', sessions);

    res.json({
      success: true,
      sessionId,
      date: parsed.date,
      totalEntries: parsed.totalEntries,
      categories: parsed.categories,
      summary: {
        receivable: (parsed.categories?.receivable || []).length,
        payment: (parsed.categories?.payment || []).length,
        staff: (parsed.categories?.staff || []).length,
        tp: (parsed.categories?.tp || []).length
      }
    });

  } catch (error) {
    console.error('Day Book parse error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST send messages for a parsed session
router.post('/send/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { categories: selectedCategories } = req.body; // Which categories to send

  const sessions = readObject('daybook_sessions');
  const session = sessions[sessionId];
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found. Please re-upload the PDF.' });
  }

  const settings = readObject('settings');
  if (!settings.phoneNumberId || !settings.accessToken) {
    return res.status(400).json({ success: false, error: 'WhatsApp API credentials not configured. Go to Settings.' });
  }

  const results = [];
  const messageHistory = readData('messages');
  const today = new Date().toLocaleDateString('en-PK');

  const categoriesToSend = selectedCategories || Object.keys(session.categories || {});

  for (const category of categoriesToSend) {
    const entries = session.categories[category] || [];

    for (const entry of entries) {
      // Skip blacklisted
      if (entry.blacklisted) {
        results.push({ name: entry.accountName, status: 'skipped', reason: 'Blacklisted' });
        continue;
      }

      // Skip if no phone number
      if (!entry.phone) {
        results.push({ name: entry.accountName, status: 'no_phone', reason: 'Phone number not found in directory' });
        continue;
      }

      // Build message based on category
      let messageText = '';
      const data = {
        name: entry.accountName,
        voucherNo: entry.vouchers?.join(', ') || entry.voucherRef,
        amount: entry.amount,
        date: session.date || today
      };

      switch (category) {
        case 'receivable': messageText = templates.receivableVoucher(data); break;
        case 'payment': messageText = templates.paymentVoucher(data); break;
        case 'staff': messageText = templates.staffPayment(data); break;
        case 'tp': messageText = templates.thirdParty(data); break;
        default: messageText = templates.generalVoucher(data);
      }

      // Send message
      try {
        const result = await sendMessage(entry.phone, messageText, settings);

        const historyEntry = {
          id: uuidv4(),
          contactName: entry.accountName,
          phone: entry.phone,
          category,
          messageType: 'daybook',
          amount: entry.amount,
          voucherRef: data.voucherNo,
          status: 'sent',
          messageId: result.messageId,
          sentAt: new Date().toISOString(),
          messageText
        };

        messageHistory.push(historyEntry);
        results.push({ name: entry.accountName, status: 'sent', phone: entry.phone });

        // Small delay to avoid rate limiting
        await sleep(300);

      } catch (err) {
        const historyEntry = {
          id: uuidv4(),
          contactName: entry.accountName,
          phone: entry.phone,
          category,
          messageType: 'daybook',
          amount: entry.amount,
          status: 'failed',
          error: err.message,
          sentAt: new Date().toISOString()
        };
        messageHistory.push(historyEntry);
        results.push({ name: entry.accountName, status: 'failed', error: err.message });
      }
    }
  }

  writeData('messages', messageHistory);

  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped' || r.status === 'no_phone').length;

  res.json({ success: true, results, summary: { sent, failed, skipped } });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
