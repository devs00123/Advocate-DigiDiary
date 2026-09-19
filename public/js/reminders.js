/**
 * Advocate DigiDiary — Reminders Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await loadCasesDropdown();
  await fetchReminders();
});

async function loadCasesDropdown() {
  try {
    const res = await API.cases.getAll({ limit: 100, status: 'active' });
    const select = document.getElementById('rCaseSelect');
    if (res.success && res.data) {
      select.innerHTML = '<option value="">General Chamber Reminder</option>' +
        res.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
  }
}

async function fetchReminders() {
  const tbody = document.getElementById('remindersTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading reminders...</td></tr>';

  try {
    const res = await API.reminders.getAll({ sort: 'remindAt' });
    if (res.success && res.data && res.data.length > 0) {
      renderReminders(res.data);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">notifications_active</span>
            No reminders scheduled.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderReminders(reminders) {
  const tbody = document.getElementById('remindersTableBody');
  tbody.innerHTML = reminders.map(r => {
    const isDone = r.isDismissed || r.status === 'dismissed';
    const caseNum = r.caseId ? r.caseId.caseNumber : '';
    const caseTitle = r.caseId ? r.caseId.title : '';

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleReminder('${r._id}', this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900); ${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
            ${UI.escapeHTML(r.title)}
          </div>
          ${r.message ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(r.message)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.8125rem; color: var(--navy-900);">${UI.formatDate(r.remindAt)}</div>
        </td>
        <td>
          ${r.caseId ? `
            <a href="/case-details.html?id=${r.caseId._id || r.caseId}" style="color: var(--gold-700); font-weight: 600; text-decoration: none; font-size: 0.8125rem;">
              ${UI.escapeHTML(caseNum)}
            </a>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(caseTitle)}</div>
          ` : '<span style="color: var(--text-muted); font-size: 0.8125rem;">General</span>'}
        </td>
        <td><span class="badge badge-neutral">${UI.escapeHTML(r.type || 'in-app')}</span></td>
        <td>${isDone ? '<span class="badge badge-neutral">Dismissed</span>' : '<span class="badge badge-warning">Active</span>'}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost text-danger" title="Delete Reminder" onclick="deleteReminder('${r._id}')" style="padding: 4px 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  document.getElementById('openAddReminderBtn').addEventListener('click', () => {
    document.getElementById('reminderForm').reset();
    document.getElementById('rDate').value = new Date().toISOString().split('T')[0];
    UI.openModal('reminderModal');
  });

  document.getElementById('reminderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveReminderBtn');
    btn.disabled = true;
    btn.innerText = 'Setting...';

    const dateVal = document.getElementById('rDate').value;
    const timeVal = document.getElementById('rTime').value || '09:00';
    const remindAt = new Date(`${dateVal}T${timeVal}:00`);

    const payload = {
      title: document.getElementById('rTitle').value.trim(),
      caseId: document.getElementById('rCaseSelect').value || undefined,
      remindAt: remindAt.toISOString(),
      type: document.getElementById('rChannel').value,
      message: document.getElementById('rMessage').value.trim() || undefined
    };

    try {
      await API.reminders.create(payload);
      UI.showToast('Reminder scheduled!', 'success');
      UI.closeModal('reminderModal');
      await fetchReminders();
    } catch (err) {
      UI.showToast(err.message || 'Failed to set reminder', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Set Reminder';
    }
  });
}

window.toggleReminder = async (id, isDismissed) => {
  try {
    if (isDismissed) {
      await API.reminders.dismiss(id);
    } else {
      await API.reminders.update(id, { isDismissed: false, status: 'pending' });
    }
    await fetchReminders();
  } catch (err) {
    UI.showToast('Failed to update reminder', 'danger');
  }
};

window.deleteReminder = async (id) => {
  const confirmed = await UI.confirm({
    title: 'Delete Chamber Reminder',
    message: 'Are you sure you want to dismiss and delete this chamber reminder alert?',
    confirmText: 'Delete Reminder',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.reminders.delete(id);
    UI.showToast('Reminder deleted', 'success');
    await fetchReminders();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete reminder', 'danger');
  }
};
