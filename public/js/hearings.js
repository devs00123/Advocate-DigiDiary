/**
 * Advocate DigiDiary — Hearing Diary Logic
 */

let selectedRange = 'today';

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupRangeButtons();
  setupModals();
  await loadCasesDropdown();
  await fetchHearings();

  // Check URL params for auto-opening outcome modal
  const urlParams = new URLSearchParams(window.location.search);
  const hearingId = urlParams.get('hearingId');
  const action = urlParams.get('action');
  if (hearingId && action === 'outcome') {
    openOutcomeModal(hearingId);
  }
});

function setupRangeButtons() {
  const btns = document.querySelectorAll('.range-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      selectedRange = btn.getAttribute('data-range');
      fetchHearings();
    });
  });

  document.getElementById('hearingStatusFilter').addEventListener('change', () => {
    fetchHearings();
  });
}

async function loadCasesDropdown() {
  const select = document.getElementById('hCaseSelect');
  if (!select) return;
  try {
    const res = await API.cases.getAll({ limit: 100 });
    if (res.success && res.data && res.data.length > 0) {
      select.innerHTML = '<option value="">Select case matter...</option>' +
        res.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber || 'MATTER')} — ${UI.escapeHTML(c.title || 'Untitled Case')}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No cases found (Register a case first)</option>';
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
    select.innerHTML = '<option value="">Error loading cases</option>';
  }
}

async function fetchHearings() {
  const tbody = document.getElementById('hearingsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading court hearings...</td></tr>';

  const status = document.getElementById('hearingStatusFilter').value;

  try {
    let res;
    if (selectedRange === 'all') {
      const params = { sort: 'hearingDate' };
      if (status) params.status = status;
      res = await API.hearings.getAll(params);
    } else {
      const params = { range: selectedRange };
      if (status) params.status = status;
      res = await API.hearings.getDailyCauseList(params);
    }

    if (res.success && res.data && res.data.length > 0) {
      renderHearings(res.data);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">event_available</span>
            No hearings found for "${selectedRange}". All chamber schedules clear.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderHearings(hearings) {
  const tbody = document.getElementById('hearingsTableBody');
  tbody.innerHTML = hearings.map(h => {
    const itemNo = h.itemNumber 
      ? `<span class="badge badge-warning font-mono" style="font-size: 0.8125rem;">#${h.itemNumber}</span>`
      : '<span style="color: var(--text-muted);">-</span>';
    
    const caseId = h.caseId ? (h.caseId._id || h.caseId) : '';
    const caseNumber = h.caseId ? (h.caseId.caseNumber || 'Case') : '';
    const caseTitle = h.caseId ? (h.caseId.title || '') : (h.title || 'Legal Matter');
    const clientName = (h.caseId && h.caseId.clientId) ? (h.caseId.clientId.name || '') : '';
    const courtName = h.court || (h.caseId ? h.caseId.court : 'Court');
    const courtRoom = (h.courtroom || h.courtRoom) ? ` (${UI.escapeHTML(h.courtroom || h.courtRoom)})` : '';
    const outcomeText = h.outcome 
      ? `<div style="font-size: 0.8125rem; color: var(--navy-900); font-weight: 500;">${UI.escapeHTML(h.outcome)}</div>`
      : '<span style="font-size: 0.75rem; color: var(--text-muted);">Pending appearance</span>';

    return `
      <tr>
        <td>${itemNo}</td>
        <td>
          <div style="font-weight: 700; color: var(--navy-900); font-size: 0.8125rem;">
            ${UI.formatDate(h.date || h.hearingDate)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(h.time || '10:30 AM')}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900);">
            <a href="/case-details.html?id=${caseId}" style="color: inherit; text-decoration: none;">
              ${UI.escapeHTML(caseTitle)}
            </a>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            <span style="font-family: monospace; font-weight: 600;">${UI.escapeHTML(caseNumber)}</span>
            ${clientName ? ` &bull; ${UI.escapeHTML(clientName)}` : ''}
          </div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(courtName)}${courtRoom}</div>
          ${h.judge ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(h.judge)}</div>` : ''}
        </td>
        <td>
          <span style="font-size: 0.8125rem;">${UI.escapeHTML(h.purpose || 'Hearing')}</span>
        </td>
        <td>${outcomeText}</td>
        <td>${UI.getStatusBadge(h.status)}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn btn-sm btn-outline" onclick="openOutcomeModal('${h._id}')" style="padding: 4px 8px; font-size: 0.75rem;">
              Outcome
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete" onclick="deleteHearing('${h._id}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupModals() {
  // Open Schedule Modal
  const openBtn = document.getElementById('openScheduleHearingModalBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      loadCasesDropdown();
      document.getElementById('hDate').value = new Date().toISOString().split('T')[0];
      UI.openModal('scheduleModal');
    });
  }

  // Handle Schedule Form Submit
  document.getElementById('scheduleHearingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveHearingBtn');
    btn.disabled = true;
    btn.innerText = 'Scheduling...';

    try {
      await API.hearings.create({
        caseId: document.getElementById('hCaseSelect').value,
        hearingDate: document.getElementById('hDate').value,
        time: document.getElementById('hTime').value || undefined,
        itemNumber: Number(document.getElementById('hItem').value) || undefined,
        courtRoom: document.getElementById('hCourtRoom').value.trim() || undefined,
        purpose: document.getElementById('hPurpose').value.trim(),
        judge: document.getElementById('hJudge').value.trim() || undefined
      });

      UI.showToast('Hearing scheduled successfully!', 'success');
      UI.closeModal('scheduleModal');
      document.getElementById('scheduleHearingForm').reset();
      await fetchHearings();
    } catch (err) {
      UI.showToast(err.message || 'Failed to schedule hearing', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Schedule';
    }
  });

  // Handle Outcome Form Submit
  document.getElementById('outcomeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveOutcomeBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const hearingId = document.getElementById('modalOutcomeHearingId').value;
    try {
      await API.hearings.recordOutcome(hearingId, {
        status: document.getElementById('outcomeStatus').value,
        outcome: document.getElementById('outcomeSummary').value.trim(),
        nextHearingDate: document.getElementById('nextDate').value || undefined,
        nextHearingPurpose: document.getElementById('nextPurpose').value.trim() || undefined
      });

      UI.showToast('Hearing outcome recorded!', 'success');
      UI.closeModal('outcomeModal');
      await fetchHearings();
    } catch (err) {
      UI.showToast(err.message || 'Failed to record outcome', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Outcome';
    }
  });
}

window.openOutcomeModal = (hearingId) => {
  document.getElementById('modalOutcomeHearingId').value = hearingId;
  document.getElementById('outcomeForm').reset();
  UI.openModal('outcomeModal');
};

window.deleteHearing = async (hearingId) => {
  const confirmed = await UI.confirm({
    title: 'Remove Hearing',
    message: 'Are you sure you want to remove this scheduled hearing listing from your diary?',
    confirmText: 'Remove Hearing',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.hearings.delete(hearingId);
    UI.showToast('Hearing removed from diary', 'success');
    await fetchHearings();
  } catch (err) {
    UI.showToast(err.message || 'Failed to remove hearing', 'danger');
  }
};
