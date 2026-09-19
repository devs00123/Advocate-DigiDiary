/**
 * Advocate DigiDiary — Chamber Audit Logs Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await fetchAuditLogs();
});

async function fetchAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading audit trail...</td></tr>';

  const entityType = document.getElementById('auditEntityFilter').value;
  const search = document.getElementById('auditSearchInput').value.trim();

  const params = { sort: '-createdAt', limit: 50 };
  if (entityType) params.entityType = entityType;
  if (search) params.search = search;

  try {
    const res = await API.audit.getAll(params);
    if (res.success && res.data && res.data.length > 0) {
      renderAuditLogs(res.data);
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No audit events recorded.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = logs.map(l => {
    let actionBadge = 'badge-neutral';
    if (l.action && l.action.toLowerCase().includes('create')) actionBadge = 'badge-success';
    else if (l.action && l.action.toLowerCase().includes('delete')) actionBadge = 'badge-danger';
    else if (l.action && l.action.toLowerCase().includes('update')) actionBadge = 'badge-warning';

    const userName = l.userId ? (l.userId.name || l.userId.email || 'User') : 'Chamber System';

    return `
      <tr>
        <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">
          ${UI.formatDate(l.createdAt)}
        </td>
        <td><span class="badge ${actionBadge}" style="font-size: 0.7rem; text-transform: uppercase;">${UI.escapeHTML(l.action)}</span></td>
        <td><span style="font-weight: 600; font-size: 0.8125rem; color: var(--navy-900);">${UI.escapeHTML(l.entityType || '-')}</span></td>
        <td style="font-size: 0.8125rem; color: var(--navy-900);">${UI.escapeHTML(l.description || '-')}</td>
        <td><span style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(userName)}</span></td>
        <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(l.ipAddress || '127.0.0.1')}</td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  document.getElementById('applyAuditFilter').addEventListener('click', fetchAuditLogs);
  document.getElementById('auditEntityFilter').addEventListener('change', fetchAuditLogs);
  document.getElementById('auditSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchAuditLogs();
  });
}
