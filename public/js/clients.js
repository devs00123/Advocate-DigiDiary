/**
 * Advocate DigiDiary — Clients Management Logic
 */

let clientsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await fetchClients();
});

async function fetchClients() {
  const tbody = document.getElementById('clientsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading clients...</td></tr>';

  const search = document.getElementById('clientSearchInput').value.trim();
  const type = document.getElementById('clientTypeFilter').value;

  const params = { sort: 'name' };
  if (search) params.search = search;
  if (type) params.clientType = type;

  try {
    const res = await API.clients.getAll(params);
    if (res.success && res.data) {
      clientsList = res.data;
      renderClients(clientsList);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No clients found.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderClients(clients) {
  const tbody = document.getElementById('clientsTableBody');
  if (clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">group</span>
          No clients match the filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clients.map(c => {
    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--navy-900); font-size: 0.875rem;">
            ${UI.escapeHTML(c.name)}
          </div>
          ${c.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(c.notes)}</div>` : ''}
        </td>
        <td><span class="badge badge-neutral">${UI.escapeHTML(c.clientType || 'Individual')}</span></td>
        <td>
          ${c.email ? `<a href="mailto:${encodeURIComponent(c.email)}" style="color: var(--gold-700); text-decoration: none;">${UI.escapeHTML(c.email)}</a>` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td style="font-family: monospace; font-size: 0.8125rem;">${UI.escapeHTML(c.phone || '-')}</td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(c.companyName || '-')}</div>
          ${c.gstin ? `<div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">GST: ${UI.escapeHTML(c.gstin)}</div>` : ''}
        </td>
        <td style="font-size: 0.8125rem;">${UI.escapeHTML(c.address || '-')}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn btn-sm btn-ghost" title="Edit Client" onclick="openEditClientModal('${c._id}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete Client" onclick="deleteClient('${c._id}', '${UI.escapeHTML(c.name)}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  document.getElementById('applyClientFilter').addEventListener('click', fetchClients);
  document.getElementById('resetClientFilter').addEventListener('click', () => {
    document.getElementById('clientSearchInput').value = '';
    document.getElementById('clientTypeFilter').value = '';
    fetchClients();
  });

  document.getElementById('openAddClientBtn').addEventListener('click', () => {
    document.getElementById('editClientId').value = '';
    document.getElementById('clientModalTitle').innerText = 'Add Client';
    document.getElementById('clientForm').reset();
    UI.openModal('clientModal');
  });

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveClientBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const editId = document.getElementById('editClientId').value;
    const payload = {
      name: document.getElementById('clientNameInput').value.trim(),
      clientType: document.getElementById('clientTypeSelect').value,
      email: document.getElementById('clientEmailInput').value.trim() || undefined,
      phone: document.getElementById('clientPhoneInput').value.trim() || undefined,
      companyName: document.getElementById('clientOrgInput').value.trim() || undefined,
      gstin: document.getElementById('clientGstinInput').value.trim() || undefined,
      address: document.getElementById('clientAddressInput').value.trim() || undefined,
      notes: document.getElementById('clientNotesInput').value.trim() || undefined
    };

    try {
      if (editId) {
        await API.clients.update(editId, payload);
        UI.showToast('Client updated!', 'success');
      } else {
        await API.clients.create(payload);
        UI.showToast('Client registered successfully!', 'success');
      }
      UI.closeModal('clientModal');
      await fetchClients();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save client', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Client';
    }
  });
}

window.openEditClientModal = (id) => {
  const c = clientsList.find(x => x._id === id);
  if (!c) return;

  document.getElementById('editClientId').value = c._id;
  document.getElementById('clientModalTitle').innerText = `Edit: ${c.name}`;
  document.getElementById('clientNameInput').value = c.name;
  document.getElementById('clientTypeSelect').value = c.clientType || 'Individual';
  document.getElementById('clientEmailInput').value = c.email || '';
  document.getElementById('clientPhoneInput').value = c.phone || '';
  document.getElementById('clientOrgInput').value = c.companyName || '';
  document.getElementById('clientGstinInput').value = c.gstin || '';
  document.getElementById('clientAddressInput').value = c.address || '';
  document.getElementById('clientNotesInput').value = c.notes || '';

  UI.openModal('clientModal');
};

window.deleteClient = async (id, name) => {
  const confirmed = await UI.confirm({
    title: 'Delete Client Record',
    message: `Are you sure you want to remove client "${name}" from your chamber registry?`,
    confirmText: 'Delete Client',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.clients.delete(id);
    UI.showToast('Client deleted', 'success');
    await fetchClients();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete client', 'danger');
  }
};
