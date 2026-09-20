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
    const res = await API.reminders.getAll({});
    if (res.success && res.data && res.data.length > 0) {
      renderReminders(res.data);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">notifications_active</span>
            No reminders scheduled. Use "+ New Reminder" above to set a chamber alert.
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
    const isDone = Boolean(r.completed || r.isDismissed || r.status === 'dismissed');
    const relCase = r.relatedCase || r.caseId;
    const caseNum = relCase ? (relCase.caseNumber || '') : '';
    const caseTitle = relCase ? (relCase.title || '') : '';
    const dateVal = r.reminderDate || r.remindAt;
    const timeVal = r.reminderTime || '09:00 AM';

    return `
      <tr class="${isDone ? 'row-completed' : ''}" style="${isDone ? 'background: #FAFBFD;' : ''}">
        <td style="text-align: center;">
          <input type="checkbox" class="reminder-toggle-check" data-id="${r._id}" ${isDone ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--gold-600);" title="${isDone ? 'Mark as active' : 'Mark as done'}">
        </td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900); ${isDone ? 'text-decoration: line-through; opacity: 0.55;' : ''}">
            ${UI.escapeHTML(r.title)}
          </div>
          ${r.description || r.message ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${UI.escapeHTML(r.description || r.message)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.8125rem; color: var(--navy-900);">${UI.formatDate(dateVal)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(timeVal)}</div>
        </td>
        <td>
          ${relCase ? `
            <a href="/case-details.html?id=${relCase._id || relCase}" style="color: var(--gold-700); font-weight: 600; text-decoration: none; font-size: 0.8125rem;">
              ${UI.escapeHTML(caseNum || 'Case')}
            </a>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(caseTitle)}</div>
          ` : '<span style="color: var(--text-muted); font-size: 0.8125rem;">General Chamber</span>'}
        </td>
        <td>
          <span class="badge badge-neutral" style="text-transform: capitalize;">${UI.escapeHTML(r.type || 'General')}</span>
        </td>
        <td>
          ${isDone ? '<span class="badge badge-neutral">Completed</span>' : '<span class="badge badge-warning">Pending</span>'}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-sm ${isDone ? 'btn-outline' : 'btn-primary'}" data-action="toggle-done" data-id="${r._id}" style="padding: 4px 10px; font-size: 0.75rem; margin-right: 4px;">
            ${isDone ? '<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">undo</span> Reopen' : '<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">check</span> Done'}
          </button>
          <button type="button" class="btn btn-sm btn-ghost text-danger" data-action="delete" data-id="${r._id}" title="Delete Reminder" style="padding: 4px 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  // Modal open
  const openBtn = document.getElementById('openAddReminderBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      loadCasesDropdown();
      document.getElementById('reminderForm').reset();
      document.getElementById('rDate').value = new Date().toISOString().split('T')[0];
      UI.openModal('reminderModal');
    });
  }

  // Event delegation on table body for checkboxes and action buttons (zero inline CSP violations)
  const tbody = document.getElementById('remindersTableBody');
  if (tbody) {
    // Checkbox toggle
    tbody.addEventListener('change', async (e) => {
      const check = e.target.closest('.reminder-toggle-check');
      if (check) {
        const id = check.getAttribute('data-id');
        await handleToggleReminder(id, check.checked);
      }
    });

    // Button clicks (Done button and Delete button)
    tbody.addEventListener('click', async (e) => {
      const toggleBtn = e.target.closest('[data-action="toggle-done"]');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        await handleToggleReminder(id);
        return;
      }

      const delBtn = e.target.closest('[data-action="delete"]');
      if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        await handleDeleteReminder(id);
        return;
      }
    });
  }

  // Create Reminder form submit
  const form = document.getElementById('reminderForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveReminderBtn');
      btn.disabled = true;
      btn.innerText = 'Setting...';

      const dateVal = document.getElementById('rDate').value;
      const timeVal = document.getElementById('rTime').value || '09:00';
      const remindAt = dateVal ? new Date(`${dateVal}T${timeVal}:00`) : new Date();

      const selectedCase = document.getElementById('rCaseSelect').value;

      const payload = {
        title: document.getElementById('rTitle').value.trim(),
        relatedCase: selectedCase || null,
        caseId: selectedCase || undefined,
        reminderDate: remindAt,
        remindAt: remindAt.toISOString(),
        reminderTime: timeVal,
        type: document.getElementById('rChannel').value,
        message: document.getElementById('rMessage').value.trim() || undefined,
        description: document.getElementById('rMessage').value.trim() || undefined
      };

      try {
        await API.reminders.create(payload);
        UI.showToast('Chamber reminder set successfully!', 'success');
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
}

async function handleToggleReminder(id, explicitStatus) {
  try {
    const payload = explicitStatus !== undefined ? { completed: explicitStatus } : undefined;
    const res = await API.reminders.toggle(id, payload);
    if (res && res.success) {
      const isCompleted = res.data ? res.data.completed : true;
      UI.showToast(isCompleted ? 'Reminder marked as completed!' : 'Reminder reopened and active!', 'success');
      await fetchReminders();
    }
  } catch (err) {
    UI.showToast(err.message || 'Failed to update reminder status', 'danger');
  }
}

async function handleDeleteReminder(id) {
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
    UI.showToast('Reminder removed successfully', 'success');
    await fetchReminders();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete reminder', 'danger');
  }
}

window.toggleReminder = handleToggleReminder;
window.deleteReminder = handleDeleteReminder;
