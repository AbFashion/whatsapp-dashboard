const axios = require('axios');

// Send a WhatsApp text message via Meta Cloud API
async function sendMessage(phoneNumber, messageText, settings) {
  const { phoneNumberId, accessToken } = settings;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp API credentials not configured. Please go to Settings.');
  }

  // Normalize phone number: remove spaces, dashes, brackets
  // Add Pakistan country code if missing
  let phone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  if (phone.startsWith('0')) {
    phone = '92' + phone.slice(1); // Convert 0xxx to 92xxx (Pakistan)
  }
  if (!phone.startsWith('+')) {
    if (!phone.startsWith('92')) {
      phone = '92' + phone;
    }
  } else {
    phone = phone.slice(1); // Remove leading +
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: false,
      body: messageText
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id,
      phone
    };
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`WhatsApp API Error: ${errMsg}`);
  }
}

// Send a WhatsApp template message (for pre-approved templates)
async function sendTemplateMessage(phoneNumber, templateName, components, settings) {
  const { phoneNumberId, accessToken } = settings;

  let phone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  if (phone.startsWith('0')) phone = '92' + phone.slice(1);
  if (phone.startsWith('+')) phone = phone.slice(1);

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: components || []
    }
  };

  const response = await axios.post(url, payload, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    messageId: response.data?.messages?.[0]?.id
  };
}

// Validate credentials by calling the API
async function validateCredentials(phoneNumberId, accessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { fields: 'display_phone_number,verified_name' }
    });
    return {
      valid: true,
      phoneNumber: response.data.display_phone_number,
      businessName: response.data.verified_name
    };
  } catch (error) {
    return {
      valid: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

module.exports = { sendMessage, sendTemplateMessage, validateCredentials };
