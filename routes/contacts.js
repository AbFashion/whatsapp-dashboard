const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/dataStore');

// GET all contacts (customers + suppliers combined with type filter)
router.get('/', (req, res) => {
  const { type, search, city } = req.query;
  let customers = readData('customers');
  let suppliers = readData('suppliers');

  let all = [
    ...customers.map(c => ({ ...c, contactType: 'customer' })),
    ...suppliers.map(s => ({ ...s, contactType: 'supplier' }))
  ];

  if (type === 'customer') all = customers.map(c => ({ ...c, contactType: 'customer' }));
  if (type === 'supplier') all = suppliers.map(s => ({ ...s, contactType: 'supplier' }));

  if (search) {
    const q = search.toLowerCase();
    all = all.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.code?.toLowerCase().includes(q)
    );
  }

  if (city) {
    all = all.filter(c => c.city?.toLowerCase().includes(city.toLowerCase()));
  }

  res.json({ success: true, data: all, total: all.length });
});

// GET single contact
router.get('/:id', (req, res) => {
  const customers = readData('customers');
  const suppliers = readData('suppliers');
  const all = [...customers, ...suppliers];
  const contact = all.find(c => c.id === req.params.id);
  if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
  res.json({ success: true, data: contact });
});

// POST create contact
router.post('/', (req, res) => {
  const { name, phone, city, code, balance, contactType, blacklisted, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }

  const newContact = {
    id: uuidv4(),
    name: name.trim(),
    phone: phone.trim(),
    city: city?.trim() || '',
    code: code?.trim() || '',
    balance: parseFloat(balance) || 0,
    contactType: contactType || 'customer',
    blacklisted: blacklisted || false,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString()
  };

  const storeKey = newContact.contactType === 'supplier' ? 'suppliers' : 'customers';
  const list = readData(storeKey);
  list.push(newContact);
  writeData(storeKey, list);

  res.json({ success: true, data: newContact });
});

// PUT update contact
router.put('/:id', (req, res) => {
  const { name, phone, city, code, balance, blacklisted, notes } = req.body;

  for (const storeKey of ['customers', 'suppliers']) {
    const list = readData(storeKey);
    const idx = list.findIndex(c => c.id === req.params.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        name: name?.trim() || list[idx].name,
        phone: phone?.trim() || list[idx].phone,
        city: city?.trim() ?? list[idx].city,
        code: code?.trim() ?? list[idx].code,
        balance: balance !== undefined ? parseFloat(balance) : list[idx].balance,
        blacklisted: blacklisted !== undefined ? blacklisted : list[idx].blacklisted,
        notes: notes?.trim() ?? list[idx].notes,
        updatedAt: new Date().toISOString()
      };
      writeData(storeKey, list);
      return res.json({ success: true, data: list[idx] });
    }
  }

  res.status(404).json({ success: false, error: 'Contact not found' });
});

// DELETE contact
router.delete('/:id', (req, res) => {
  for (const storeKey of ['customers', 'suppliers']) {
    const list = readData(storeKey);
    const idx = list.findIndex(c => c.id === req.params.id);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeData(storeKey, list);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ success: false, error: 'Contact not found' });
});

// POST bulk import contacts (replaces all of a given type)
router.post('/bulk', (req, res) => {
  const { contacts, replace } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'contacts array is required' });
  }

  const now = new Date().toISOString();
  const customersBulk = [];
  const suppliersBulk = [];

  for (const c of contacts) {
    const record = {
      id: uuidv4(),
      name: (c.name || '').trim(),
      phone: (c.phone || '').trim(),
      city: (c.city || '').trim(),
      code: (c.accountCode || c.code || '').trim(),
      balance: parseFloat(c.balance) || 0,
      contactType: c.type || c.contactType || 'customer',
      blacklisted: c.blacklisted || false,
      notes: (c.notes || '').trim(),
      createdAt: now
    };
    if (record.contactType === 'supplier') suppliersBulk.push(record);
    else customersBulk.push(record);
  }

  if (customersBulk.length > 0) {
    const existing = replace ? [] : readData('customers');
    writeData('customers', [...existing, ...customersBulk]);
  }
  if (suppliersBulk.length > 0) {
    const existing = replace ? [] : readData('suppliers');
    writeData('suppliers', [...existing, ...suppliersBulk]);
  }

  res.json({
    success: true,
    imported: { customers: customersBulk.length, suppliers: suppliersBulk.length },
    total: contacts.length
  });
});

// GET stats
router.get('/meta/stats', (req, res) => {
  const customers = readData('customers');
  const suppliers = readData('suppliers');
  const blacklisted = customers.filter(c => c.blacklisted).length;
  const cities = [...new Set([...customers, ...suppliers].map(c => c.city).filter(Boolean))];

  res.json({
    success: true,
    data: {
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      blacklisted,
      cities: cities.length
    }
  });
});

module.exports = router;
