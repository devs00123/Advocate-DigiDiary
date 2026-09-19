/**
 * Advocate DigiDiary — Fees & Ledger Logic
 * Server-side financial calculations only. No fake math.
 */

let activeCasesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupModals();
  await loadCasesForPayment();
  await loadLedgerOverview();
  await fetchPayments();

  // Check URL params for quick payment action
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'record') {
    openRecordPaymentModal();
  }
});

async function loadCasesForPayment() {
  try {
    const res = await API.cases.getAll({ limit: 100 });
    if (res.success && res.data) {
      activeCasesList = res.data;
      const select = document.getElementById('payCaseSelect');
      select.innerHTML = '<option value="">Select case...</option>' +
        activeCasesList.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');

      select.addEventListener('change', () => {
        const c = activeCasesList.find(x => x._id === select.value);
        const hint = document.getElementById('caseBalanceHint');
        if (c) {
          const agreed = c.totalAgreedFee || 0;
          const paid = c.totalPaidFee || 0;
          const due = Math.max(0, agreed - paid);
          hint.innerText = `Agreed Fee: ${UI.formatINR(agreed)} | Paid: ${UI.formatINR(paid)} | Outstanding Due: ${UI.formatINR(due)}`;
        } else {
          hint.innerText = '';
        }
      });
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
  }
}

async function loadLedgerOverview() {
  try {
    const res = await API.financial.getOverview();
    if (res.success && res.data) {
      const data = res.data;
      document.getElementById('kpiBilledFees').innerText = UI.formatINR(data.totalBilled || 0);
      document.getElementById('kpiCollectedFees').innerText = UI.formatINR(data.totalCollected || 0);
      document.getElementById('kpiOutstandingFees').innerText = UI.formatINR(data.totalOutstanding || 0);
    }
  } catch (err) {
    console.error('Failed to load financial overview:', err);
  }
}

async function fetchPayments() {
  const tbody = document.getElementById('ledgerTableBody');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading ledger...</td></tr>';

  const method = document.getElementById('paymentMethodFilter').value;
  const search = document.getElementById('ledgerSearchInput').value.trim();

  const params = { sort: '-paymentDate' };
  if (method) params.paymentMethod = method;
  if (search) params.search = search;

  try {
    const res = await API.financial.getPayments(params);
    if (res.success && res.data && res.data.length > 0) {
      renderLedger(res.data);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">payments</span>
            No fee payments found matching your filter.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderLedger(payments) {
  const tbody = document.getElementById('ledgerTableBody');
  tbody.innerHTML = payments.map(p => {
    const caseTitle = p.caseId ? p.caseId.title : 'General Retainer';
    const caseNum = p.caseId ? p.caseId.caseNumber : '';
    const clientName = p.clientId ? p.clientId.name : (p.caseId && p.caseId.clientId ? p.caseId.clientId.name : '-');

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: var(--gold-700); font-size: 0.8125rem;">
          ${UI.escapeHTML(p.receiptNumber || 'RCP-' + p._id.substr(-6))}
        </td>
        <td>${UI.formatDate(p.paymentDate)}</td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900);">
            ${p.caseId ? `<a href="/case-details.html?id=${p.caseId._id || p.caseId}" style="color: inherit; text-decoration: none;">${UI.escapeHTML(caseTitle)}</a>` : UI.escapeHTML(caseTitle)}
          </div>
          ${caseNum ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${UI.escapeHTML(caseNum)}</div>` : ''}
        </td>
        <td>${UI.escapeHTML(clientName)}</td>
        <td><span class="badge badge-neutral">${UI.escapeHTML(p.paymentMethod)}</span></td>
        <td style="font-weight: 700; color: var(--success); font-size: 0.875rem;">${UI.formatINR(p.amount)}</td>
        <td style="font-family: monospace; font-size: 0.8125rem;">${UI.escapeHTML(p.referenceNumber || '-')}</td>
        <td style="font-size: 0.8125rem; color: var(--text-muted);">${UI.escapeHTML(p.notes || '-')}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost text-danger" title="Delete Payment" onclick="deletePaymentRecord('${p._id}', '${UI.escapeHTML(p.receiptNumber || '')}')" style="padding: 4px 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupModals() {
  document.getElementById('openRecordPaymentBtn').addEventListener('click', openRecordPaymentModal);

  document.getElementById('applyLedgerFilters').addEventListener('click', fetchPayments);
  document.getElementById('resetLedgerFilters').addEventListener('click', () => {
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('ledgerSearchInput').value = '';
    fetchPayments();
  });

  document.getElementById('recordPaymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('savePaymentBtn');
    btn.disabled = true;
    btn.innerText = 'Recording...';

    const caseId = document.getElementById('payCaseSelect').value;
    const selectedCase = activeCasesList.find(c => c._id === caseId);

    const payload = {
      caseId: caseId,
      clientId: selectedCase && selectedCase.clientId ? (selectedCase.clientId._id || selectedCase.clientId) : undefined,
      amount: Number(document.getElementById('payAmountInput').value),
      paymentDate: document.getElementById('payDateInput').value,
      paymentMethod: document.getElementById('payMethodSelect').value,
      referenceNumber: document.getElementById('payRefInput').value.trim() || undefined,
      notes: document.getElementById('payNotesInput').value.trim() || undefined
    };

    try {
      await API.financial.createPayment(payload);
      UI.showToast('Payment recorded successfully!', 'success');
      UI.closeModal('paymentModal');
      document.getElementById('recordPaymentForm').reset();
      document.getElementById('caseBalanceHint').innerText = '';
      await loadLedgerOverview();
      await fetchPayments();
    } catch (err) {
      UI.showToast(err.message || 'Failed to record payment', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Record Receipt';
    }
  });
}

function openRecordPaymentModal() {
  document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('caseBalanceHint').innerText = '';
  UI.openModal('paymentModal');
}

window.deletePaymentRecord = async (id, receiptNo) => {
  const confirmed = await UI.confirm({
    title: 'Delete Fee Payment Receipt',
    message: `Are you sure you want to delete payment receipt ${receiptNo}? This will adjust the client ledger balance.`,
    confirmText: 'Delete Receipt',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.financial.deletePayment(id);
    UI.showToast('Payment deleted', 'success');
    await loadLedgerOverview();
    await fetchPayments();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete payment', 'danger');
  }
};
