// Bilingual message templates (English + Urdu)
// All messages start with Assalam o Alaikum

const templates = {

  receivableVoucher: (data) => {
    const { name, voucherNo, amount, date, balance } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
📋 *Payment Received Confirmation*

Voucher No: *${voucherNo}*
Amount Received: *PKR ${formatAmount(amount)}*
Date: *${date}*
${balance !== undefined ? `Outstanding Balance: *PKR ${formatAmount(balance)}*` : ''}

Thank you for your payment. We truly value your trust and continued business.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
📋 *ادائیگی وصولی کی تصدیق*

وائوچر نمبر: *${voucherNo}*
وصول شدہ رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${date}*
${balance !== undefined ? `باقی بقایہ: *PKR ${formatAmount(balance)}*` : ''}

آپ کی ادائیگی کا شکریہ۔ آپ کے اعتماد اور کاروباری تعلق کی ہم قدر کرتے ہیں۔ 🤝`;
  },

  paymentVoucher: (data) => {
    const { name, voucherNo, amount, date, bankName } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
💸 *Payment Sent Confirmation*

Voucher No: *${voucherNo}*
Amount Paid: *PKR ${formatAmount(amount)}*
${bankName ? `Bank: *${bankName}*` : ''}
Date: *${date}*

Your payment has been processed successfully. Please confirm receipt.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
💸 *ادائیگی بھیجنے کی تصدیق*

وائوچر نمبر: *${voucherNo}*
ادا کی گئی رقم: *PKR ${formatAmount(amount)}*
${bankName ? `بینک: *${bankName}*` : ''}
تاریخ: *${date}*

آپ کی ادائیگی کامیابی سے مکمل ہو گئی ہے۔ براہ کرم وصولی کی تصدیق فرمائیں۔ ✅`;
  },

  staffPayment: (data) => {
    const { name, voucherNo, amount, date } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
👤 *Salary / Payment Confirmation*

Voucher No: *${voucherNo}*
Amount: *PKR ${formatAmount(amount)}*
Date: *${date}*

Your payment has been processed. JazakAllah Khair for your hard work and dedication.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
👤 *تنخواہ / ادائیگی کی تصدیق*

وائوچر نمبر: *${voucherNo}*
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${date}*

آپ کی ادائیگی مکمل ہو گئی ہے۔ آپ کی محنت اور لگن کا جزاک اللہ خیر۔ 🤲`;
  },

  generalVoucher: (data) => {
    const { name, voucherNo, amount, date, description } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
📄 *General Voucher*

Voucher No: *${voucherNo}*
${description ? `Details: *${description}*` : ''}
Amount: *PKR ${formatAmount(amount)}*
Date: *${date}*

Please keep this as your record. For any queries, feel free to contact us.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
📄 *جنرل وائوچر*

وائوچر نمبر: *${voucherNo}*
${description ? `تفصیل: *${description}*` : ''}
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${date}*

براہ کرم اسے اپنے ریکارڈ کے لیے محفوظ کریں۔ کسی بھی سوال کے لیے ہم سے رابطہ کریں۔ 📞`;
  },

  thirdParty: (data) => {
    const { name, voucherNo, amount, date } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
🔄 *Transaction Confirmation*

Voucher No: *${voucherNo}*
Amount: *PKR ${formatAmount(amount)}*
Date: *${date}*

Your transaction has been recorded. Thank you for your cooperation.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
🔄 *لین دین کی تصدیق*

وائوچر نمبر: *${voucherNo}*
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${date}*

آپ کا لین دین ریکارڈ کر لیا گیا ہے۔ آپ کے تعاون کا شکریہ۔ 🤝`;
  },

  chequeUpcoming: (data) => {
    const { name, chequeNo, bankName, amount, chequeDate } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
⏰ *Cheque Due Tomorrow – Reminder*

Cheque No: *${chequeNo}*
Bank: *${bankName}*
Amount: *PKR ${formatAmount(amount)}*
Due Date: *${chequeDate}*

Kindly ensure sufficient funds are available in your account to avoid any inconvenience.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
⏰ *چیک کل پیش ہوگا – یاددہانی*

چیک نمبر: *${chequeNo}*
بینک: *${bankName}*
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${chequeDate}*

براہ کرم یقینی بنائیں کہ آپ کے اکاؤنٹ میں کافی بیلنس موجود ہو تاکہ کسی تکلیف سے بچا جا سکے۔ 🙏`;
  },

  chequeCleared: (data) => {
    const { name, chequeNo, bankName, amount, chequeDate } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
✅ *Cheque Cleared Successfully*

Cheque No: *${chequeNo}*
Bank: *${bankName}*
Amount: *PKR ${formatAmount(amount)}*
Date: *${chequeDate}*

Your cheque has been cleared. Thank you for your payment. JazakAllah Khair!

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
✅ *چیک کامیابی سے کلیئر ہو گیا*

چیک نمبر: *${chequeNo}*
بینک: *${bankName}*
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${chequeDate}*

آپ کا چیک کلیئر ہو گیا ہے۔ آپ کی ادائیگی کا شکریہ۔ جزاک اللہ خیر! 🤲`;
  },

  chequeDishonored: (data) => {
    const { name, chequeNo, bankName, amount, chequeDate, balance } = data;
    return `Assalam o Alaikum, *${name}*! 🙏

*AB Fashion Jewellery*
❌ *Cheque Dishonored – Urgent Notice*

Cheque No: *${chequeNo}*
Bank: *${bankName}*
Amount: *PKR ${formatAmount(amount)}*
Date: *${chequeDate}*
Outstanding Balance: *PKR ${formatAmount(balance || amount)}*

Your cheque has been returned/dishonored. Please arrange payment as soon as possible. For queries, contact us immediately.

---

السلام علیکم، *${name}*! 🙏

*اے بی فیشن جیولری*
❌ *چیک واپس آ گیا – فوری اطلاع*

چیک نمبر: *${chequeNo}*
بینک: *${bankName}*
رقم: *PKR ${formatAmount(amount)}*
تاریخ: *${chequeDate}*
باقی رقم: *PKR ${formatAmount(balance || amount)}*

آپ کا چیک واپس / ڈیس آنر ہو گیا ہے۔ براہ کرم جلد از جلد ادائیگی کا بندوبست فرمائیں۔ فوری رابطہ کریں۔ 📞`;
  }

};

function formatAmount(amount) {
  if (!amount) return '0';
  return Number(amount).toLocaleString('en-PK');
}

module.exports = templates;
