// ââ AB Fashion Jewellery â WhatsApp Dashboard ââ
// Frontend JavaScript

let currentPage = 'overview';
let parsedSession = null;
let contactTypeFilter = '';
let chequeStatusFilter = '';
let historyCategory = '';
let _chequeDateFilter = null; // client-side date filter (DD-MM-YYYY)

// ââ Init ââ
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      goTo(link.dataset.page);
    });
  });

  // Filter tabs - contacts
  document.querySelectorAll('.filter-tab[data-type]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab[data-type]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contactTypeFilter = tab.dataset.type;
      loadContacts();
    });
  });

  // Filter tabs - cheques
  document.querySelectorAll('.filter-tab[data-status]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab[data-status]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      chequeStatusFilter = tab.dataset.status;
      loadCheques();
    });
  });

  // Filter tabs - history
  document.querySelectorAll('.filter-tab[data-cat2]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab[data-cat2]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      historyCategory = tab.dataset.cat2;
      loadHistory();
    });
  });

  // Category tabs (day book)
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderEntries(tab.dataset.cat);
    });
  });

  // File upload
  const daybookInput = document.getElementById('daybookFile');
  daybookInput?.addEventListener('change', e => {
    if (e.target.files[0]) uploadDayBook(e.target.files[0]);
  });

  // Drag and drop
  const zone = document.getElementById('uploadZone');
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') uploadDayBook(file);
    else showToast('Please drop a PDF file', 'error');
  });

  // Load initial data
  loadDashboard();
  checkAPIStatus();
  loadSettings();
});

// ââ Navigation ââ
function goTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');

  // Load page data
  if (page === 'overview') loadDashboard();
  if (page === 'contacts') loadContacts();
  if (page === 'cheques') loadCheques();
  if (page === 'history') loadHistory();
  if (page === 'settings') loadSettings();
}

function goToChequesFiltered(status, search) {
  _chequeDateFilter = null;
  if (search === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    _chequeDateFilter = `${dd}-${mm}-${yyyy}`;
    search = '';
  }
  chequeStatusFilter = status;
  currentPage = 'cheques';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-cheques')?.classList.add('active');
  document.querySelector('.nav-link[data-page="cheques"]')?.classList.add('active');
  document.querySelectorAll('.filter-tab[data-status]').forEach(t =>
    t.classList.toggle('active', t.dataset.status === status)
  );
  const searchEl = document.getElementById('chequeSearch');
  if (searchEl) searchEl.value = search || '';
  loadCheques();
}

// ââ Dashboard ââ
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (!data.success) return;
    const d = data.data;

    document.getElementById('statTodaySent').textContent = d.messages.todaySent;
    document.getElementById('statCustomers').textContent = d.contacts.customers + d.contacts.suppliers;
    document.getElementById('statChequesTomorrow').textContent = d.cheques.dueTomorrow;
    document.getElementById('statDishonored').textContent = d.cheques.dishonored;
    document.getElementById('ovChqPending').textContent = d.cheques.pending;
    document.getElementById('ovChqCleared').textContent = d.cheques.cleared;
    document.getElementById('ovChqDishonored').textContent = d.cheques.dishonored;

    loadRecentMessages();
  } catch (e) { console.error('Dashboard load error:', e); }
}

async function loadRecentMessages() {
  const res = await fetch('/api/messages?limit=6');
  const data = await res.json();
  const el = document.getElementById('recentMessages');

  if (!data.data?.length) {
    el.innerHTML = '<div class="empty">No messages sent yet</div>';
    return;
  }

  el.innerHTML = data.data.map(m => `
    <div class="msg-item">
      <span class="result-icon">${m.status === 'sent' ? 'â' : 'â'}</span>
      <span class="msg-name">${esc(m.contactName)}</span>
      <span class="badge ${catBadge(m.category)}">${m.category}</span>
      <span class="msg-time">${timeAgo(m.sentAt)}</span>
    </div>
  `).join('');
}

// ââ API Status ââ
async function checkAPIStatus() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (data.data?.accessTokenSet) {
      dot.className = 'status-dot connected';
      text.textContent = 'API Connected';
    } else {
      dot.className = 'status-dot error';
      text.textContent = 'API Not Set';
    }
  } catch { }
}

// ââ Day Book ââ
async function uploadDayBook(file) {
  const zone = document.getElementById('uploadZone');
  zone.innerHTML = '<div class="upload-icon">â³</div><div class="upload-text">Parsing PDF...</div>';

  const formData = new FormData();
  formData.append('daybook', file);

  try {
    const res = await fetch('/api/daybook/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error, 'error');
      resetUploadZone();
      return;
    }

    parsedSession = data;
    document.getElementById('parsedDate').textContent = data.date || 'Today';
    renderEntries('all');
    document.getElementById('parseResult').style.display = 'block';
    document.getElementById('sendResult').style.display = 'none';

    const total = data.summary;
    document.getElementById('sendSummary').textContent =
      `Found: ${total.receivable || 0} Receivable | ${total.payment || 0} Payment | ${total.staff || 0} Staff | ${total.tp || 0} TP`;

    showToast(`Parsed ${data.totalEntries} entries from ${file.name}`);
  } catch (e) {
    showToast('Failed to parse PDF: ' + e.message, 'error');
    resetUploadZone();
  }
}

function resetUploadZone() {
  document.getElementById('uploadZone').innerHTML = `
    <div class="upload-icon">ð</div>
    <div class="upload-text">Drop your Day Book PDF here</div>
    <div class="upload-sub">or</div>
    <label class="btn btn-primary">
      Choose PDF File
      <input type="file" id="daybookFile" accept=".pdf" hidden>
    </label>
  `;
  document.getElementById('daybookFile')?.addEventListener('change', e => {
    if (e.target.files[0]) uploadDayBook(e.target.files[0]);
  });
}

function renderEntries(filterCat) {
  if (!parsedSession) return;
  const container = document.getElementById('parsedEntriesContainer');
  const categories = parsedSession.categories || {};

  const catLabels = { receivable: 'ð Receivable Voucher', payment: 'ð¡ Payment Voucher', staff: 'ð¤ Staff Payment', tp: 'ð Third Party' };

  let html = '';
  let totalEntries = 0;

  for (const [cat, entries] of Object.entries(categories)) {
    if (filterCat !== 'all' && cat !== filterCat) continue;
    if (!entries?.length) continue;

    totalEntries += entries.length;
    html += `<div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#6b7280;margin-bottom:8px">${catLabels[cat] || cat}</div>`;

    for (const e of entries) {
      const hasPhone = !!e.phone;
      const isBlacklisted = e.blacklisted;
      html += `<div class="entry-item">
        <span class="entry-status">${isBlacklisted ? 'ð«' : hasPhone ? 'â' : 'â ï¸'}</span>
        <span class="entry-name">${esc(e.accountName)}</span>
        <span class="entry-phone">${e.phone || '<span style="color:#ef4444">No phone</span>'}</span>
        <span class="entry-amount">PKR ${fmt(e.amount)}</span>
      </div>`;
    }
    html += '</div>';
  }

  if (!html) html = '<div class="empty">No entries in this category</div>';
  container.innerHTML = html;
}

async function sendDaybookMessages() {
  if (!parsedSession?.sessionId) return showToast('Please upload a PDF first', 'error');

  const btn = document.getElementById('sendAllBtn');
  btn.disabled = true;
  btn.textContent = 'â³ Sending...';

  try {
    const res = await fetch(`/api/daybook/send/${parsedSession.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'ð¨ Send All Messages';
      return;
    }

    const s = data.summary;
    let html = `<div style="margin-bottom:12px;font-weight:600">
      â Sent: ${s.sent} | â Failed: ${s.failed} | â­ï¸ Skipped: ${s.skipped}
    </div>`;

    html += data.results.map(r => `
      <div class="result-row">
        <span class="result-icon">${r.status === 'sent' ? 'â' : r.status === 'failed' ? 'â' : 'â­ï¸'}</span>
        <span class="result-name">${esc(r.name)}</span>
        <span class="result-reason">${r.error || r.reason || ''}</span>
      </div>
    `).join('');

    document.getElementById('sendResultContent').innerHTML = html;
    document.getElementById('sendResult').style.display = 'block';
    showToast(`Done! Sent: ${s.sent}, Failed: ${s.failed}`, s.failed > 0 ? '' : 'success');
    loadDashboard();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ð¨ Send All Messages';
  }
}

// ââ Cheques ââ
function missingBadge(val, label) {
  return val?.trim() ? esc(val) : `<span class="badge badge-red" title="Missing ${label}">â  Missing</span>`;
}

async function updateMissingBanner() {
  try {
    const res = await fetch('/api/cheques?limit=99999');
    const data = await res.json();
    const all = data.data || [];
    const missingNo   = all.filter(c => !c.chequeNo?.trim()).length;
    const missingBank = all.filter(c => !c.bankName?.trim()).length;
    const total = all.filter(c => !c.chequeNo?.trim() || !c.bankName?.trim()).length;
    const banner = document.getElementById('missingInfoBanner');
    if (!banner) return;
    if (total === 0) { banner.innerHTML = ''; return; }
    const parts = [];
    if (missingNo)   parts.push(`${missingNo} missing cheque number${missingNo > 1 ? 's' : ''}`);
    if (missingBank) parts.push(`${missingBank} missing bank name${missingBank > 1 ? 's' : ''}`);
    banner.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#991b1b;display:flex;align-items:center;gap:8px">
      <span style="font-size:16px">â ï¸</span>
      <strong>${total} cheque${total > 1 ? 's' : ''} with incomplete info:</strong> ${parts.join(' Â· ')}
      <span style="margin-left:auto;opacity:0.7">Edit each row to fill in details</span>
    </div>`;
  } catch(e) { /* silently ignore */ }
}

async function loadCheques() {
  const search = document.getElementById('chequeSearch')?.value || '';
  const params = new URLSearchParams({ limit: 99999 });
  if (chequeStatusFilter) params.set('status', chequeStatusFilter);
  if (search) params.set('search', search);

  const res = await fetch('/api/cheques?' + params);
  const data = await res.json();
  const el = document.getElementById('chequesTable');

  updateMissingBanner();

  let rows = data.data || [];

  // Client-side date filter
  const dateFilter = _chequeDateFilter;
  if (dateFilter) {
    rows = rows.filter(c => c.chequeDate === dateFilter);
    document.getElementById('dateBanner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'dateBanner';
    banner.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#92400e;display:flex;align-items:center;gap:8px';
    banner.innerHTML = `ð Showing cheques for <strong>${dateFilter}</strong> (${rows.length} found) <button onclick="_chequeDateFilter=null;loadCheques()" style="margin-left:auto;background:none;border:1px solid #f59e0b;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px">â Clear filter</button>`;
    el.parentNode?.insertBefore(banner, el);
  } else {
    document.getElementById('dateBanner')?.remove();
  }

  if (!rows.length) {
    el.innerHTML = '<div class="empty">No cheques found. Import your Cheque List PDF to get started.</div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Name</th><th>Cheque No</th><th>Bank</th><th>Date</th>
      <th>Amount</th><th>Balance</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${rows.map(c => `<tr>
        <td>${esc(c.accountName)}</td>
        <td>${missingBadge(c.chequeNo, 'Cheque No')}</td>
        <td>${missingBadge(c.bankName, 'Bank Name')}</td>
        <td>${esc(c.chequeDate || 'â')}</td>
        <td>PKR ${fmt(c.amount)}</td>
        <td>${c.status === 'Cleared' ? 'â' : 'PKR ' + fmt(c.balance || c.amount)}</td>
        <td><span class="badge ${chequeStatusBadge(c.status)}">${c.status}</span></td>
        <td><div class="table-actions">
          ${c.status === 'Pending' ? `<button class="btn btn-sm btn-amber" onclick="sendChequeReminder('${c.id}','upcoming')">â° Remind</button>` : ''}
          ${c.status === 'Cleared' ? `<button class="btn btn-sm btn-outline" onclick="sendChequeReminder('${c.id}','cleared')">â Notify</button>` : ''}
          ${c.status === 'Dishonored' ? `<button class="btn btn-sm btn-red" onclick="sendChequeReminder('${c.id}','dishonored')">â Alert</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="updateChequeStatus('${c.id}', '${c.status}')">Edit</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function sendChequeReminder(id, type) {
  try {
    const res = await fetch(`/api/cheques/${id}/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderType: type })
    });
    const data = await res.json();
    if (data.success) showToast('Reminder sent!', 'success');
    else showToast(data.error, 'error');
  } catch (e) { showToast(e.message, 'error'); }
}

async function sendUpcomingReminders() {
  showToast('Sending tomorrow\'s cheque reminders...');
  try {
    const res = await fetch('/api/cheques/bulk/send-upcoming', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Sent ${data.summary.sent} reminders, ${data.summary.failed} failed`, data.summary.failed > 0 ? '' : 'success');
    } else {
      showToast(data.error, 'error');
    }
    loadDashboard();
  } catch (e) { showToast(e.message, 'error'); }
}

function showAddChequeModal() {
  document.getElementById('chqName').value = '';
  document.getElementById('chqPhone').value = '';
  document.getElementById('chqNo').value = '';
  document.getElementById('chqBank').value = '';
  document.getElementById('chqAmount').value = '';
  document.getElementById('chqDate').value = '';
  document.getElementById('chqStatus').value = 'Pending';
  openModal('chequeModal');
}

async function saveCheque() {
  const payload = {
    accountName: document.getElementById('chqName').value.trim(),
    phone: document.getElementById('chqPhone').value.trim(),
    chequeNo: document.getElementById('chqNo').value.trim(),
    bankName: document.getElementById('chqBank').value.trim(),
    amount: document.getElementById('chqAmount').value,
    chequeDate: document.getElementById('chqDate').value,
    status: document.getElementById('chqStatus').value
  };

  if (!payload.accountName || !payload.amount) return showToast('Name and amount required', 'error');

  const res = await fetch('/api/cheques', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.success) { closeModal(); loadCheques(); showToast('Cheque added', 'success'); }
  else showToast(data.error, 'error');
}

async function updateChequeStatus(id, currentStatus) {
  const statuses = ['Pending', 'Cleared', 'Dishonored'];
  const next = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];
  if (!confirm(`Change status to "${next}"?`)) return;

  const res = await fetch(`/api/cheques/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: next, balance: next === 'Cleared' ? 0 : undefined })
  });
  const data = await res.json();
  if (data.success) { loadCheques(); showToast(`Status changed to ${next}`, 'success'); }
  else showToast(data.error, 'error');
}

function showImportChequeModal() {
  document.getElementById('importProgress').innerHTML = '';
  document.getElementById('chequePdfFile').value = '';
  openModal('importChequeModal');
}

async function importChequesPDF() {
  const file = document.getElementById('chequePdfFile').files[0];
  if (!file) return showToast('Please select a PDF file', 'error');

  document.getElementById('importProgress').innerHTML = '<div class="loading">Importing... this may take a moment for large files.</div>';

  const formData = new FormData();
  formData.append('cheques', file);

  try {
    const res = await fetch('/api/cheques/import-pdf', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      document.getElementById('importProgress').innerHTML = `<div style="color:#065f46;background:#d1fae5;padding:10px;border-radius:8px">â Imported ${data.imported} new cheques (Total: ${data.total})</div>`;
      setTimeout(() => { closeModal(); loadCheques(); }, 1500);
    } else {
      document.getElementById('importProgress').innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:10px;border-radius:8px">â ${data.error}</div>`;
    }
  } catch (e) {
    document.getElementById('importProgress').innerHTML = `<div style="color:#991b1b">Error: ${e.message}</div>`;
  }
}

// ââ Contacts ââ
async function loadContacts() {
  const search = document.getElementById('contactSearch')?.value || '';
  const params = new URLSearchParams();
  if (contactTypeFilter) params.set('type', contactTypeFilter);
  if (search) params.set('search', search);

  const res = await fetch('/api/contacts?' + params);
  const data = await res.json();
  const el = document.getElementById('contactsTable');

  if (!data.data?.length) {
    el.innerHTML = '<div class="empty">No contacts found. Add contacts or import from your Debtors/Creditors report.</div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Name</th><th>Type</th><th>Phone</th><th>City</th><th>Balance</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${data.data.map(c => `<tr class="${c.blacklisted ? 'blacklisted-row' : ''}">
        <td>${esc(c.name)}${c.blacklisted ? ' <span class="badge badge-red">Blacklisted</span>' : ''}</td>
        <td><span class="badge ${c.contactType === 'supplier' ? 'badge-purple' : 'badge-blue'}">${c.contactType}</span></td>
        <td>${esc(c.phone || 'â')}</td>
        <td>${esc(c.city || 'â')}</td>
        <td>PKR ${fmt(c.balance || 0)}</td>
        <td><div class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="editContact('${c.id}')">Edit</button>
          <button class="btn btn-sm btn-red" onclick="deleteContact('${c.id}')">Delete</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function showAddContactModal(prefill) {
  document.getElementById('contactModalTitle').textContent = 'Add Contact';
  document.getElementById('contactId').value = '';
  document.getElementById('contactName').value = prefill?.name || '';
  document.getElementById('contactPhone').value = prefill?.phone || '';
  document.getElementById('contactCity').value = prefill?.city || '';
  document.getElementById('contactCode').value = prefill?.code || '';
  document.getElementById('contactBalance').value = prefill?.balance || '';
  document.getElementById('contactNotes').value = '';
  document.getElementById('contactBlacklisted').checked = false;
  document.getElementById('contactTypeField').value = prefill?.contactType || 'customer';
  openModal('contactModal');
}

async function editContact(id) {
  const res = await fetch(`/api/contacts/${id}`);
  const data = await res.json();
  if (!data.success) return showToast('Contact not found', 'error');
  const c = data.data;

  document.getElementById('contactModalTitle').textContent = 'Edit Contact';
  document.getElementById('contactId').value = c.id;
  document.getElementById('contactName').value = c.name || '';
  document.getElementById('contactPhone').value = c.phone || '';
  document.getElementById('contactCity').value = c.city || '';
  document.getElementById('contactCode').value = c.code || '';
  document.getElementById('contactBalance').value = c.balance || '';
  document.getElementById('contactNotes').value = c.notes || '';
  document.getElementById('contactBlacklisted').checked = !!c.blacklisted;
  document.getElementById('contactTypeField').value = c.contactType || 'customer';
  openModal('contactModal');
}

async function saveContact() {
  const id = document.getElementById('contactId').value;
  const payload = {
    name: document.getElementById('contactName').value.trim(),
    phone: document.getElementById('contactPhone').value.trim(),
    city: document.getElementById('contactCity').value.trim(),
    code: document.getElementById('contactCode').value.trim(),
    balance: document.getElementById('contactBalance').value,
    notes: document.getElementById('contactNotes').value.trim(),
    blacklisted: document.getElementById('contactBlacklisted').checked,
    contactType: document.getElementById('contactTypeField').value
  };

  if (!payload.name || !payload.phone) return showToast('Name and phone are required', 'error');

  const url = id ? `/api/contacts/${id}` : '/api/contacts';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (data.success) {
    closeModal();
    loadContacts();
    showToast(id ? 'Contact updated' : 'Contact added', 'success');
  } else {
    showToast(data.error, 'error');
  }
}

async function deleteContact(id) {
  if (!confirm('Delete this contact?')) return;
  const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) { loadContacts(); showToast('Contact deleted'); }
  else showToast(data.error, 'error');
}

// ââ Message History ââ
async function loadHistory() {
  const search = document.getElementById('historySearch')?.value || '';
  const params = new URLSearchParams({ limit: 100 });
  if (historyCategory) params.set('category', historyCategory);
  if (search) params.set('search', search);

  const res = await fetch('/api/messages?' + params);
  const data = await res.json();
  const el = document.getElementById('historyTable');

  if (!data.data?.length) {
    el.innerHTML = '<div class="empty">No messages sent yet</div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Name</th><th>Phone</th><th>Category</th><th>Amount</th><th>Status</th><th>Sent At</th><th></th>
    </tr></thead>
    <tbody>
      ${data.data.map(m => `<tr>
        <td>${esc(m.contactName)}</td>
        <td>${esc(m.phone || 'â')}</td>
        <td><span class="badge ${catBadge(m.category)}">${m.category || 'â'}</span></td>
        <td>${m.amount ? 'PKR ' + fmt(m.amount) : 'â'}</td>
        <td><span class="badge ${m.status === 'sent' ? 'badge-green' : 'badge-red'}">${m.status}</span></td>
        <td>${m.sentAt ? new Date(m.sentAt).toLocaleString('en-PK') : 'â'}</td>
        <td>${m.messageText ? `<button class="btn btn-sm btn-outline" onclick="previewMessage(${JSON.stringify(m.messageText).replace(/"/g, '&quot;')})">ð</button>` : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function previewMessage(text) {
  document.getElementById('messagePreviewText').textContent = text;
  openModal('messageModal');
}

// ââ Settings ââ
async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  if (!data.success) return;
  const s = data.data;

  document.getElementById('settingPhoneId').value = s.phoneNumberId || '';
  document.getElementById('settingWabaId').value = s.businessAccountId || '';
  document.getElementById('settingCompany').value = s.companyName || 'AB Fashion Jewellery';

  const tokenStatus = document.getElementById('settingTokenStatus');
  if (s.accessTokenSet) {
    tokenStatus.textContent = `â Token is set (${s.accessTokenPreview}) â Leave blank to keep current`;
    tokenStatus.style.color = '#065f46';
  } else {
    tokenStatus.textContent = 'No token set yet';
    tokenStatus.style.color = '#dc2626';
  }
}

async function saveSettings() {
  const payload = {
    phoneNumberId: document.getElementById('settingPhoneId').value.trim(),
    accessToken: document.getElementById('settingToken').value.trim(),
    businessAccountId: document.getElementById('settingWabaId').value.trim(),
    companyName: document.getElementById('settingCompany').value.trim()
  };

  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 
