const express = require('express');
const router = express.Router();
const { validateCredentials } = require('../utils/whatsapp');
const { readObject, writeData } = require('../utils/dataStore');

// GET settings (never expose full access token)
router.get('/', (req, res) => {
  const settings = readObject('settings');
  res.json({
    success: true,
    data: {
      phoneNumberId: settings.phoneNumberId || '',
      accessTokenSet: !!settings.accessToken,
      businessAccountId: settings.businessAccountId || '',
      companyName: settings.companyName || 'AB Fashion Jewellery',
      // Mask token
      accessTokenPreview: settings.accessToken
        ? settings.accessToken.substring(0, 8) + '...'
        : ''
    }
  });
});

// POST save settings
router.post('/', async (req, res) => {
  const { phoneNumberId, accessToken, businessAccountId, companyName } = req.body;

  const existing = readObject('settings');
  const updated = {
    ...existing,
    phoneNumberId: phoneNumberId?.trim() || existing.phoneNumberId,
    businessAccountId: businessAccountId?.trim() || existing.businessAccountId,
    companyName: companyName?.trim() || existing.companyName || 'AB Fashion Jewellery',
    updatedAt: new Date().toISOString()
  };

  // Only update token if a new one is provided
  if (accessToken && accessToken.length > 10 && !accessToken.includes('...')) {
    updated.accessToken = accessToken.trim();
  }

  writeData('settings', updated);
  res.json({ success: true, message: 'Settings saved successfully' });
});

// POST validate API credentials
router.post('/validate', async (req, res) => {
  const settings = readObject('settings');
  if (!settings.phoneNumberId || !settings.accessToken) {
    return res.status(400).json({
      success: false,
      error: 'Phone Number ID and Access Token must be set first'
    });
  }

  const result = await validateCredentials(settings.phoneNumberId, settings.accessToken);
  res.json({ success: result.valid, ...result });
});

// POST send test message
router.post('/test-message', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number required' });

  const settings = readObject('settings');
  if (!settings.phoneNumberId || !settings.accessToken) {
    return res.status(400).json({ success: false, error: 'API credentials not configured' });
  }

  const { sendMessage } = require('../utils/whatsapp');
  try {
    const result = await sendMessage(phone, `Assalam o Alaikum! 🙏\n\n*AB Fashion Jewellery*\n\nThis is a test message from your WhatsApp Dashboard. If you received this, your API connection is working correctly.\n\nالسلام علیکم! 🙏\n\nیہ آپ کے واٹس ایپ ڈیش بورڈ کا ٹیسٹ پیغام ہے۔`, settings);
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
