const pdfParse = require('pdf-parse');

// Account type codes from BillX Advanced POS
const ACCOUNT_TYPES = {
  'L-CUS': { type: 'customer', category: 'receivable', sendMessage: true },
  'LC-SUP': { type: 'supplier', category: 'payment', sendMessage: true },
  'TP': { type: 'third_party', category: 'tp', sendMessage: true },
  'EXP-Staff': { type: 'staff', category: 'staff', sendMessage: true },
  'BNK': { type: 'bank', category: 'bank', sendMessage: false },
  'EXP': { type: 'expense', category: 'expense', sendMessage: false }
};

/**
 * Parse a Day Book PDF and extract voucher entries
 * Returns grouped entries by message category
 */
async function parseDayBook(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const entries = [];
  let currentVoucher = null;
  let voucherDate = null;

  // Extract date from header (format: DD-MM-YYYY or similar)
  const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
  if (dateMatch) voucherDate = dateMatch[1];

  // Parse each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect voucher header lines (contain voucher number patterns like V-001, RV-001, PV-001, GV-001)
    const voucherMatch = line.match(/^(RV|PV|GV|SV|TP|JV|CV)-?(\d+)/i);
    if (voucherMatch) {
      currentVoucher = line;
      continue;
    }

    // Detect account entry lines
    // Format: Sr# | Account Code | Account Name | Debit | Credit | Description
    // The key is the account type code at beginning: L-CUS, LC-SUP, TP, EXP-Staff, BNK
    const accountTypes = Object.keys(ACCOUNT_TYPES);
    let matched = false;

    for (const accType of accountTypes) {
      if (line.includes(accType)) {
        const accConfig = ACCOUNT_TYPES[accType];
        if (!accConfig.sendMessage) {
          matched = true;
          break;
        }

        // Try to extract: account name, debit amount, credit amount
        const parts = line.split(/\s{2,}|\t/);
        if (parts.length < 2) continue;

        // Extract numbers (amounts) from line
        const amounts = line.match(/[\d,]+\.?\d*/g) || [];
        const numericAmounts = amounts
          .map(a => parseFloat(a.replace(/,/g, '')))
          .filter(n => n > 0 && n < 100000000);

        // Extract account name - text after account type code, before numbers
        const afterCode = line.substring(line.indexOf(accType) + accType.length);
        const nameMatch = afterCode.match(/([A-Za-z][A-Za-z\s\.\-\']+?)(?=\s+[\d,]|$)/);
        const accountName = nameMatch ? nameMatch[1].trim() : '';

        if (accountName && numericAmounts.length > 0) {
          // For L-CUS: Credit amount = payment received
          // For LC-SUP: Debit amount = payment made
          const amount = numericAmounts[numericAmounts.length - 1]; // usually last number

          entries.push({
            accountType: accType,
            category: accConfig.category,
            accountName,
            amount,
            voucherRef: currentVoucher || 'N/A',
            date: voucherDate,
            rawLine: line
          });
        }

        matched = true;
        break;
      }
    }
  }

  // Group by category and consolidate duplicate names (sum amounts)
  const grouped = {};
  for (const entry of entries) {
    const { category } = entry;
    if (!grouped[category]) grouped[category] = {};

    const key = entry.accountName.toUpperCase();
    if (grouped[category][key]) {
      grouped[category][key].amount += entry.amount;
      grouped[category][key].vouchers.push(entry.voucherRef);
    } else {
      grouped[category][key] = {
        ...entry,
        vouchers: [entry.voucherRef]
      };
    }
  }

  // Convert to arrays
  const result = {};
  for (const [cat, entries] of Object.entries(grouped)) {
    result[cat] = Object.values(entries);
  }

  return {
    date: voucherDate,
    totalEntries: entries.length,
    categories: result,
    rawText: text.substring(0, 500) // First 500 chars for debugging
  };
}

/**
 * Enhanced parser that works with the actual BillX Day Book PDF format
 * Uses regex patterns matched to the real PDF layout
 */
async function parseDayBookEnhanced(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  // Extract date from PDF
  const datePatterns = [
    /Day Book.*?(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    /Date[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/
  ];

  let reportDate = null;
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) { reportDate = match[1]; break; }
  }

  const entries = [];
  const lines = text.split('\n');

  // BillX format: rows have Sr#, then account code, name, debit, credit
  // We look for lines containing known account type prefixes
  const typePatterns = {
    'L-CUS': 'receivable',
    'LC-SUP': 'payment',
    'TP': 'tp',
    'EXP-Staff': 'staff'
  };

  let lastVoucherNo = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect voucher number (pattern: any combination like 5-001, RV-12, etc.)
    const voucherNumMatch = line.match(/^(\d+[-]\d+|[A-Z]{1,3}[-]\d+)\s/);
    if (voucherNumMatch) lastVoucherNo = voucherNumMatch[1];

    // Check each account type
    for (const [accType, category] of Object.entries(typePatterns)) {
      if (!line.includes(accType)) continue;

      // Skip if it's just a header
      if (line.toLowerCase().includes('account type') || line.toLowerCase().includes('code')) continue;

      // Extract amounts: last two numbers in line are typically Debit and Credit
      const allNums = [...line.matchAll(/[\d,]+\.?\d{0,2}/g)]
        .map(m => parseFloat(m[0].replace(/,/g, '')))
        .filter(n => n > 100); // Filter out row numbers, small values

      if (allNums.length === 0) continue;

      // Get account name: text between account type code and first large number
      const codeIdx = line.indexOf(accType);
      const afterCode = line.substring(codeIdx + accType.length).trim();
      // Name is non-numeric text at the start
      const nameMatch = afterCode.match(/^([A-Za-z][A-Za-z0-9\s\.\-\'&\/]+?)(?=\s+[\d]|\s{3,}|$)/);
      if (!nameMatch) continue;

      const accountName = nameMatch[1].trim();
      if (accountName.length < 2) continue;

      // Determine amount based on category
      // For receivable (L-CUS): Credit column (last number)
      // For payment (LC-SUP): Debit column (first number)
      let amount;
      if (category === 'receivable') {
        amount = allNums[allNums.length - 1];
      } else {
        amount = allNums[0];
      }

      if (amount > 0) {
        entries.push({
          accountType: accType,
          category,
          accountName,
          amount,
          voucherRef: lastVoucherNo || `Entry-${i}`,
          date: reportDate
        });
      }
      break;
    }
  }

  // Consolidate duplicates
  const consolidated = {};
  for (const entry of entries) {
    const key = `${entry.category}::${entry.accountName.toUpperCase()}`;
    if (consolidated[key]) {
      consolidated[key].amount += entry.amount;
      consolidated[key].vouchers = consolidated[key].vouchers || [consolidated[key].voucherRef];
      consolidated[key].vouchers.push(entry.voucherRef);
    } else {
      consolidated[key] = { ...entry, vouchers: [entry.voucherRef] };
    }
  }

  // Group by category
  const grouped = {};
  for (const entry of Object.values(consolidated)) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  return {
    date: reportDate,
    totalEntries: Object.keys(consolidated).length,
    categories: grouped
  };
}

module.exports = { parseDayBook, parseDayBookEnhanced };
