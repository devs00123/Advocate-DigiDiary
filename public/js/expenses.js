/**
 * Advocate DigiDiary — Chamber Expenses Logic
 */

let expensesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await loadCasesDropdown();
  await fetchExpenses();
});

async function loadCasesDropdown() {
  try {
    const res = await API.cases.getAll({ limit: 100, status: 'active' });
    const select = document.getElementById('expCaseSelect');
    if (res.success && res.data) {
      select.innerHTML = '<option value="">General Chamber Overhead</option>' +
        res.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
  }
}

async function fetchExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading expenses...</td></tr>';

  const category = document.getElementById('expenseCategoryFilter').value;
  const search = document.getElementById('expenseSearchInput').value.trim();

  const params = { sort: '-expenseDate' };
  if (category) params.category = category;
  if (search) params.search = search;

  try {
    const res = await API.financial.getExpenses(params);
    if (res.success && res.data) {
      expensesList = res.data;
      renderExpenses(expensesList);
      updateKpis(expensesList);
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No expenses recorded.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function updateKpis(expenses) {
  let total = 0;
  let courtFees = 0;
  let billable = 0;

  expenses.forEach(e => {
    const amt = e.amount || 0;
    total += amt;
    if (e.category === 'Court Fee') courtFees += amt;
    if (e.isBillable) billable += amt;
  });

  document.getElementById('totalExpensesVal').innerText = UI.formatINR(total);
  document.getElementById('courtFeesVal').innerText = UI.formatINR(courtFees);
  document.getElementById('billableExpensesVal').innerText = UI.formatINR(billable);
}

function renderExpenses(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">receipt_long</span>
          No expenses match the filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = expenses.map(e => {
    const caseTitle = e.caseId ? e.caseId.title : 'General Practice';
    const caseNum = e.caseId ? e.caseId.caseNumber : '';
    const billableBadge = e.isBillable 
      ? '<span class="badge badge-success" style="font-size: 0.65rem;">Billable</span>' 
      : '<span class="badge badge-neutral" style="font-size: 0.65rem;">Chamber</span>';

    return `
      <tr>
        <td>${UI.formatDate(e.expenseDate)}</td>
        <td><span class="badge badge-warning">${UI.escapeHTML(e.category)}</span></td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900); font-size: 0.8125rem;">
            ${UI.escapeHTML(e.description)}
          </div>
        </td>
        <td>
          ${e.caseId ? `
            <a href="/case-details.html?id=${e.caseId._id || e.caseId}" style="color: var(--gold-700); font-weight: 600; text-decoration: none; font-size: 0.8125rem;">
              ${UI.escapeHTML(caseNum)}
            </a>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(caseTitle)}</div>
          ` : '<span style="color: var(--text-muted); font-size: 0.8125rem;">General Practice</span>'}
        </td>
        <td style="font-weight: 700; color: var(--navy-900); font-size: 0.875rem;">
          ${UI.formatINR(e.amount)}
        </td>
        <td>${billableBadge}</td>
        <td style="font-family: monospace; font-size: 0.8125rem;">${UI.escapeHTML(e.receiptNumber || '-')}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost text-danger" title="Delete Expense" onclick="deleteExpenseRecord('${e._id}')" style="padding: 4px 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  document.getElementById('applyExpenseFilter').addEventListener('click', fetchExpenses);
  document.getElementById('resetExpenseFilter').addEventListener('click', () => {
    document.getElementById('expenseCategoryFilter').value = '';
    document.getElementById('expenseSearchInput').value = '';
    fetchExpenses();
  });

  document.getElementById('openAddExpenseBtn').addEventListener('click', () => {
    loadCasesDropdown();
    document.getElementById('expenseForm').reset();
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    UI.openModal('expenseModal');
  });

  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveExpenseBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const payload = {
      amount: Number(document.getElementById('expAmount').value),
      expenseDate: document.getElementById('expDate').value,
      category: document.getElementById('expCategory').value,
      isBillable: document.getElementById('expBillable').value === 'true',
      caseId: document.getElementById('expCaseSelect').value || undefined,
      description: document.getElementById('expDesc').value.trim(),
      receiptNumber: document.getElementById('expReceipt').value.trim() || undefined
    };

    try {
      await API.financial.createExpense(payload);
      UI.showToast('Expense recorded successfully!', 'success');
      UI.closeModal('expenseModal');
      await fetchExpenses();
    } catch (err) {
      UI.showToast(err.message || 'Failed to record expense', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Expense';
    }
  });
}

window.deleteExpenseRecord = async (id) => {
  const confirmed = await UI.confirm({
    title: 'Delete Expense Entry',
    message: 'Are you sure you want to remove this chamber expense disbursement record?',
    confirmText: 'Delete Expense',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.financial.deleteExpense(id);
    UI.showToast('Expense removed', 'success');
    await fetchExpenses();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete expense', 'danger');
  }
};
