/**
 * Advocate DigiDiary — Case Portfolio Management
 */

let currentPage = 1;
const pageLimit = 15;
let clientsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  // Load clients for dropdown
  await loadClients();

  // Load initial cases
  await fetchCases();

  // Setup event listeners
  setupEventListeners();
});

async function loadClients() {
  try {
    const res = await API.clients.getAll({ limit: 100 });
    if (res.success && res.data) {
      clientsList = res.data;
      const select = document.getElementById('caseClientSelect');
      select.innerHTML = '<option value="">Select client...</option>' +
        clientsList.map(c => `<option value="${c._id}">${UI.escapeHTML(c.name)} (${UI.escapeHTML(c.clientType)})</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load clients:', err);
  }
}

async function fetchCases() {
  const tbody = document.getElementById('caseTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        Loading cases...
      </td>
    </tr>
  `;

  const search = document.getElementById('caseSearchInput').value.trim();
  const status = document.getElementById('caseStatusFilter').value;
  const caseType = document.getElementById('caseTypeFilter').value;

  const params = {
    page: currentPage,
    limit: pageLimit,
    sort: '-updatedAt'
  };

  if (search) params.search = search;
  if (status) params.status = status;
  if (caseType) params.caseType = caseType;

  try {
    const res = await API.cases.getAll(params);
    if (res.success && res.data) {
      renderCases(res.data);
      renderPagination(res.pagination);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No cases found.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
          Error loading cases: ${UI.escapeHTML(err.message)}
        </td>
      </tr>
    `;
  }
}

function renderCases(cases) {
  const tbody = document.getElementById('caseTableBody');
  if (!cases || cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">gavel</span>
          No legal cases match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cases.map(c => {
    const clientName = c.clientId ? UI.escapeHTML(c.clientId.name) : '<span style="color: var(--text-muted);">No client</span>';
    const cnr = c.cnrNumber ? `<div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">CNR: ${UI.escapeHTML(c.cnrNumber)}</div>` : '';
    const nextDate = c.nextHearingDate ? UI.formatDate(c.nextHearingDate) : '<span style="color: var(--text-muted); font-size: 0.75rem;">Not scheduled</span>';
    const feeBilled = c.totalAgreedFee || 0;
    const feePaid = c.totalPaidFee || 0;
    const feeDue = Math.max(0, feeBilled - feePaid);

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--navy-900); font-family: monospace; font-size: 0.8125rem;">
            ${UI.escapeHTML(c.caseNumber)}
          </div>
          ${cnr}
          <div style="margin-top: 2px;">
            <span class="badge badge-neutral" style="font-size: 0.65rem;">${UI.escapeHTML(c.caseType || 'Civil')}</span>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900);">
            <a href="/case-details.html?id=${c._id}" style="color: inherit; text-decoration: none;">
              ${UI.escapeHTML(c.title)}
            </a>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Client: ${clientName} &bull; Representing: <strong>${UI.escapeHTML(c.partyRole || 'Petitioner')}</strong>
          </div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(c.court)}</div>
          ${c.courtRoom ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(c.courtRoom)}</div>` : ''}
        </td>
        <td>
          <span style="font-size: 0.8125rem;">${UI.escapeHTML(c.stage || 'Hearing')}</span>
          <div>${UI.getStatusBadge(c.status)}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${nextDate}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.formatINR(feeBilled)}</div>
          ${feeDue > 0 
            ? `<div style="font-size: 0.7rem; color: var(--danger); font-weight: 600;">Due: ${UI.formatINR(feeDue)}</div>` 
            : `<div style="font-size: 0.7rem; color: var(--success); font-weight: 600;">Paid in full</div>`}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <a href="/case-details.html?id=${c._id}" class="btn btn-sm btn-ghost" title="View Details & Timeline" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">visibility</span>
            </a>
            <button class="btn btn-sm btn-ghost" title="Edit Case" onclick="openEditCaseModal('${c._id}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete Case" onclick="deleteCase('${c._id}', '${UI.escapeHTML(c.caseNumber)}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(p) {
  if (!p) return;
  const info = document.getElementById('paginationInfo');
  const prev = document.getElementById('prevPageBtn');
  const next = document.getElementById('nextPageBtn');

  const start = p.total === 0 ? 0 : (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);
  info.innerText = `Showing ${start}-${end} of ${p.total} cases (Page ${p.page} of ${p.totalPages || 1})`;

  prev.disabled = p.page <= 1;
  next.disabled = p.page >= p.totalPages;
}

function setupEventListeners() {
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchCases();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentPage++;
    fetchCases();
  });

  document.getElementById('applyFiltersBtn').addEventListener('click', () => {
    currentPage = 1;
    fetchCases();
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('caseSearchInput').value = '';
    document.getElementById('caseStatusFilter').value = '';
    document.getElementById('caseTypeFilter').value = '';
    currentPage = 1;
    fetchCases();
  });

  document.getElementById('caseSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      fetchCases();
    }
  });

  // Open modal for add
  document.getElementById('openAddCaseBtn').addEventListener('click', () => {
    document.getElementById('editCaseId').value = '';
    document.getElementById('modalCaseTitleText').innerText = 'Register New Matter';
    document.getElementById('caseForm').reset();
    UI.openModal('caseModal');
  });

  // Handle Form Submit
  document.getElementById('caseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveCaseSubmitBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const editId = document.getElementById('editCaseId').value;

    const payload = {
      title: document.getElementById('caseTitleInput').value.trim(),
      caseNumber: document.getElementById('caseNumberInput').value.trim(),
      cnrNumber: document.getElementById('caseCnrInput').value.trim() || undefined,
      court: document.getElementById('caseCourtInput').value.trim(),
      courtRoom: document.getElementById('caseCourtRoomInput').value.trim() || undefined,
      caseType: document.getElementById('caseTypeSelect').value,
      clientId: document.getElementById('caseClientSelect').value,
      partyRole: document.getElementById('casePartyRoleSelect').value,
      opponentParty: document.getElementById('caseOpponent').value.trim() || undefined,
      opponentAdvocate: document.getElementById('caseOpponentAdvocate').value.trim() || undefined,
      stage: document.getElementById('caseStageInput').value.trim() || undefined,
      status: document.getElementById('caseStatusSelect').value,
      totalAgreedFee: Number(document.getElementById('caseAgreedFeeInput').value) || 0,
      description: document.getElementById('caseDescriptionInput').value.trim() || undefined
    };

    try {
      if (editId) {
        await API.cases.update(editId, payload);
        UI.showToast('Case updated successfully!', 'success');
      } else {
        await API.cases.create(payload);
        UI.showToast('Case registered successfully!', 'success');
      }
      UI.closeModal('caseModal');
      await fetchCases();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save case', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Matter';
    }
  });
}

window.openEditCaseModal = async (id) => {
  try {
    const res = await API.cases.getById(id);
    if (res.success && res.data) {
      const c = res.data;
      document.getElementById('editCaseId').value = c._id;
      document.getElementById('modalCaseTitleText').innerText = `Edit Case: ${c.caseNumber}`;
      document.getElementById('caseTitleInput').value = c.title;
      document.getElementById('caseNumberInput').value = c.caseNumber;
      document.getElementById('caseCnrInput').value = c.cnrNumber || '';
      document.getElementById('caseCourtInput').value = c.court;
      document.getElementById('caseCourtRoomInput').value = c.courtRoom || '';
      document.getElementById('caseTypeSelect').value = c.caseType;
      document.getElementById('caseClientSelect').value = c.clientId ? (c.clientId._id || c.clientId) : '';
      document.getElementById('casePartyRoleSelect').value = c.partyRole;
      document.getElementById('caseOpponent').value = c.opponentParty || '';
      document.getElementById('caseOpponentAdvocate').value = c.opponentAdvocate || '';
      document.getElementById('caseStageInput').value = c.stage || '';
      document.getElementById('caseStatusSelect').value = c.status;
      document.getElementById('caseAgreedFeeInput').value = c.totalAgreedFee || 0;
      document.getElementById('caseDescriptionInput').value = c.description || '';

      UI.openModal('caseModal');
    }
  } catch (err) {
    UI.showToast(err.message || 'Could not fetch case details', 'danger');
  }
};

window.deleteCase = async (id, number) => {
  const confirmed = await UI.confirm({
    title: 'Delete Legal Matter',
    message: `Are you sure you want to permanently delete case "${number}"? This will also remove related hearings, deadlines, and chamber records.`,
    confirmText: 'Delete Case',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.cases.delete(id);
    UI.showToast(`Case ${number} deleted.`, 'success');
    await fetchCases();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete case', 'danger');
  }
};
