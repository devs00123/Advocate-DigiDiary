/**
 * Advocate DigiDiary — Chamber Team & RBAC Controller
 */

let teamList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await fetchTeamMembers();
});

async function fetchTeamMembers() {
  const tbody = document.getElementById('teamTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading chamber members...</td></tr>';

  try {
    const res = await API.team.getAll();
    if (res.success && res.data) {
      teamList = res.data;
      renderTeam(teamList);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No team members found.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderTeam(members) {
  const tbody = document.getElementById('teamTableBody');
  tbody.innerHTML = members.map(m => {
    let roleBadgeClass = 'badge-neutral';
    if (m.role === 'admin') roleBadgeClass = 'badge-primary';
    else if (m.role === 'advocate') roleBadgeClass = 'badge-warning';
    else if (m.role === 'junior') roleBadgeClass = 'badge-success';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--navy-900); font-size: 0.875rem;">
            ${UI.escapeHTML(m.name)}
          </div>
          ${m.barEnrollmentNumber ? `<div style="font-size: 0.75rem; color: var(--gold-700); font-family: monospace;">${UI.escapeHTML(m.barEnrollmentNumber)}</div>` : ''}
        </td>
        <td>
          <a href="mailto:${encodeURIComponent(m.email)}" style="color: var(--navy-900); text-decoration: none; font-size: 0.8125rem;">
            ${UI.escapeHTML(m.email)}
          </a>
        </td>
        <td>
          <span style="font-size: 0.8125rem; font-weight: 500; text-transform: capitalize;">${UI.escapeHTML(m.role)}</span>
        </td>
        <td style="font-family: monospace; font-size: 0.8125rem;">${UI.escapeHTML(m.phone || '-')}</td>
        <td><span class="badge ${roleBadgeClass}" style="text-transform: uppercase;">${UI.escapeHTML(m.role)}</span></td>
        <td><span class="badge badge-success">Active</span></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost text-danger" title="Remove Member" onclick="deleteMember('${m._id}', '${UI.escapeHTML(m.name)}')" style="padding: 4px 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  document.getElementById('openAddMemberBtn').addEventListener('click', () => {
    document.getElementById('memberForm').reset();
    UI.openModal('memberModal');
  });

  document.getElementById('memberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveMemberBtn');
    btn.disabled = true;
    btn.innerText = 'Adding...';

    const payload = {
      name: document.getElementById('memName').value.trim(),
      email: document.getElementById('memEmail').value.trim(),
      password: document.getElementById('memPassword').value,
      role: document.getElementById('memRole').value,
      phone: document.getElementById('memPhone').value.trim() || undefined,
      barEnrollmentNumber: document.getElementById('memBarNo').value.trim() || undefined
    };

    try {
      await API.team.create(payload);
      UI.showToast('Team member added successfully!', 'success');
      UI.closeModal('memberModal');
      await fetchTeamMembers();
    } catch (err) {
      UI.showToast(err.message || 'Failed to add member', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Add Member';
    }
  });
}

window.deleteMember = async (id, name) => {
  const confirmed = await UI.confirm({
    title: 'Remove Chamber Member',
    message: `Are you sure you want to remove ${name} from your chamber roster? They will lose access to chamber cases.`,
    confirmText: 'Remove Member',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.team.delete(id);
    UI.showToast('Member removed', 'success');
    await fetchTeamMembers();
  } catch (err) {
    UI.showToast(err.message || 'Failed to remove member', 'danger');
  }
};
