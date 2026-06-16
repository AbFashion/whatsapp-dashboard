# AB Fashion Jewellery – WhatsApp Dashboard

A cloud-based WhatsApp Business dashboard for sending automated messages via Meta's official WhatsApp Cloud API.

## Features

- **Day Book Automation** – Upload BillX day book PDF → auto-parse entries → send WhatsApp messages to customers/suppliers
- **5 Message Categories** – Receivable Voucher, Payment Voucher, Staff Payment, Third Party, General Voucher
- **Cheque Reminders** – Track Pending/Cleared/Dishonored cheques, send bilingual reminders automatically
- **Contact Directory** – Manage 500+ customers and ~60 suppliers with phone numbers
- **Bilingual Messages** – Every message in English + Urdu (Assalam o Alaikum greeting)
- **Message History** – Full log of all sent messages

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env with your Meta API credentials

# 3. Start the server
npm start

# 4. Open in browser
# http://localhost:3000
```

---

## Deploy to Railway (Free Cloud Hosting)

Railway gives you a live URL so you can access the dashboard from anywhere.

### Step 1 – Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ab-whatsapp-dashboard.git
git push -u origin main
```

### Step 2 – Deploy on Railway
1. Go to **railway.app** → Sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `ab-whatsapp-dashboard` repo
4. Railway auto-detects Node.js and deploys

### Step 3 – Add Environment Variables on Railway
In Railway dashboard → Your project → **Variables** tab, add:
```
WHATSAPP_PHONE_NUMBER_ID = your_phone_number_id
WHATSAPP_ACCESS_TOKEN    = your_permanent_access_token
PORT                     = 3000
COMPANY_NAME             = AB Fashion Jewellery
```

### Step 4 – Get Your Live URL
Railway gives you a URL like `https://ab-whatsapp-dashboard-production.up.railway.app`

---

## Alternative: Deploy to Render (Also Free)

1. Go to **render.com** → New → Web Service
2. Connect your GitHub repo
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables in Render dashboard
5. Deploy

---

## Getting Meta WhatsApp API Credentials

1. Go to **developers.facebook.com**
2. Create an App → Select "Business" type
3. Add **WhatsApp** product
4. Go to WhatsApp → API Setup
5. Copy your **Phone Number ID** and **Temporary Access Token**
6. For a **Permanent Token**: Go to Business Settings → System Users → Create a System User → Generate Token with `whatsapp_business_messaging` permission

---

## Data Storage

All data is stored as JSON files in the `/data` folder:
- `customers.json` – Customer directory
- `suppliers.json` – Supplier directory
- `cheques.json` – Cheque records
- `messages.json` – Message history
- `settings.json` – API credentials

**Important**: The `/data` folder is in `.gitignore` — your credentials and data are never pushed to GitHub.

---

## Importing Your Existing Data

### Import Customers (Debtors Report)
Go to **Contacts** → Add contacts manually, or ask your developer to write a one-time import script using the Debtors PDF.

### Import Cheques (Cheque List Report)
Go to **Cheques** → **Import PDF** → Upload your BillX Cheque List Report PDF.

---

## Message Categories

| Category | Who Gets It | Trigger |
|----------|-------------|---------|
| Receivable Voucher | L-CUS customers | Credit entries in Day Book |
| Payment Voucher | LC-SUP suppliers | Debit entries in Day Book |
| Staff Payment | EXP-Staff entries | Staff wage entries in Day Book |
| Third Party (TP) | TP accounts | TP entries in Day Book |
| Cheque Reminder | Any account with cheque | Manual or daily automatic |

---

## Support

For any issues with the software, check:
- Meta WhatsApp API docs: developers.facebook.com/docs/whatsapp
- Railway docs: docs.railway.app
