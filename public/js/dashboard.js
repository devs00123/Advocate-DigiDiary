/**
 * Advocate DigiDiary — Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  await Auth.requireAuth();

  // Set today's date formatted nicely
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const dateEl = document.getElementById('currentDateDisplay');
  if (dateEl) dateEl.innerText = dateStr;

  // Load all dashboard components
  await loadDashboardData();
  setupQuickActionModals();
});

async function loadDashboardData() {
  try {
    // 1. Fetch Analytics Summary (KPIs)
    const summaryRes = await API.analytics.getSummary();
    if (summaryRes && summaryRes.success) {
      const data = summaryRes.data;
      
      // Active Cases
      document.getElementById('kpiActiveCases').innerText = data.totalActiveCases || 0;
      document.getElementById('kpiActiveCasesSub').innerText = `${data.totalCases || 0} total matters in firm`;

      // Today's Hearings
      document.getElementById('kpiTodayHearings').innerText = data.todayHearingsCount || 0;
      document.getElementById('kpiTodayHearingsSub').innerText = `${data.todayHearingsCount || 0} cause list appearances`;

      // Pending Tasks
      document.getElementById('kpiPendingTasks').innerText = data.pendingTasksCount || 0;
      document.getElementById('kpiPendingTasksSub').innerText = `${data.urgentTasksCount || 0} high priority`;

      // Financials
      document.getElementById('kpiOutstandingFees').innerText = UI.formatINR(data.totalOutstanding || 0);
      document.getElementById('kpiCollectedFeesSub').innerText = `Collected: ${UI.formatINR(data.totalCollected || 0)}`;

      // Financial Quick View card
      document.getElementById('finBilled').innerText = UI.formatINR(data.totalBilled || 0);
      document.getElementById('finCollected').innerText = UI.formatINR(data.totalCollected || 0);
      document.getElementById('finOutstanding').innerText = UI.formatINR(data.totalOutstanding || 0);
    }
  } catch (err) {
    console.error('Failed to load analytics summary:', err);
  }

  // 2. Fetch Today's Cause List
  try {
    const causeListRes = await API.hearings.getDailyCauseList({ range: 'today' });
    const tbody = document.getElementById('todayHearingsTableBody');
    
    if (causeListRes && causeListRes.success && causeListRes.data && causeListRes.data.length > 0) {
      const hearings = causeListRes.data;
      tbody.innerHTML = hearings.map(h => {
        const itemNo = h.itemNumber ? `<span class="badge badge-warning font-mono" style="font-size: 0.8125rem;">#${h.itemNumber}</span>` : '<span style="color: var(--text-muted);">-</span>';
        const courtRoom = h.courtRoom ? ` (${UI.escapeHTML(h.courtRoom)})` : '';
        const courtName = (h.court || (h.caseId ? h.caseId.court : 'Court')) + courtRoom;
        const caseTitle = h.caseId ? h.caseId.title : (h.title || 'Legal Hearing');
        const caseNum = h.caseId ? h.caseId.caseNumber : '';
        const caseId = h.caseId ? (h.caseId._id || h.caseId) : '';

        return `
          <tr>
            <td>${itemNo}</td>
            <td>
              <div style="font-weight: 600; color: var(--navy-900);">
                <a href="/case-details.html?id=${caseId}" style="color: inherit; text-decoration: none;">
                  ${UI.escapeHTML(caseTitle)}
                </a>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${UI.escapeHTML(caseNum)}</div>
            </td>
            <td>
              <div style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(courtName)}</div>
              ${h.judge ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(h.judge)}</div>` : ''}
            </td>
            <td>
              <span style="font-size: 0.8125rem;">${UI.escapeHTML(h.purpose || 'Hearing')}</span>
            </td>
            <td>
              ${UI.getStatusBadge(h.status)}
            </td>
            <td style="text-align: right;">
              <button class="btn btn-sm btn-outline" onclick="openRecordOutcomeModal('${h._id}')" style="padding: 4px 8px; font-size: 0.75rem;">
                Outcome
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size: 2rem; opacity: 0.4; display: block; margin-bottom: 0.5rem;">event_available</span>
            No court hearings scheduled for today.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error('Failed to load cause list:', err);
  }

  // 3. Fetch Recent Cases
  try {
    const casesRes = await API.cases.getAll({ limit: 5, sort: '-updatedAt' });
    const tbody = document.getElementById('recentCasesTableBody');

    if (casesRes && casesRes.success && casesRes.data && casesRes.data.length > 0) {
      tbody.innerHTML = casesRes.data.map(c => {
        const nextDate = c.nextHearingDate ? UI.formatDate(c.nextHearingDate) : '<span style="color: var(--text-muted);">Not scheduled</span>';
        return `
          <tr>
            <td style="font-family: monospace; font-size: 0.8125rem; font-weight: 600; color: var(--gold-700);">
              ${UI.escapeHTML(c.caseNumber)}
            </td>
            <td>
              <div style="font-weight: 600; color: var(--navy-900);">
                <a href="/case-details.html?id=${c._id}" style="color: inherit; text-decoration: none;">
                  ${UI.escapeHTML(c.title)}
                </a>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${c.clientId ? UI.escapeHTML(c.clientId.name || '') : ''} &bull; ${UI.escapeHTML(c.partyRole || 'Petitioner')}
              </div>
            </td>
            <td>
              <span style="font-size: 0.8125rem;">${UI.escapeHTML(c.court)}</span>
            </td>
            <td>
              <span style="font-size: 0.8125rem; font-weight: 500;">${nextDate}</span>
            </td>
            <td>
              ${UI.getStatusBadge(c.status)}
            </td>
            <td style="text-align: right;">
              <a href="/case-details.html?id=${c._id}" class="btn btn-sm btn-ghost" style="padding: 4px 8px; font-size: 0.75rem;">
                View &rarr;
              </a>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No active cases found. Use "+ Add Case" to register a matter.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error('Failed to load recent cases:', err);
  }

  // 4. Fetch Urgent Tasks
  try {
    const tasksRes = await API.tasks.getAll({ status: 'pending', limit: 4 });
    const container = document.getElementById('urgentTasksList');

    if (tasksRes && tasksRes.success && tasksRes.data && tasksRes.data.length > 0) {
      container.innerHTML = tasksRes.data.map(t => {
        const due = t.dueDate ? UI.formatDate(t.dueDate) : 'No due date';
        const isUrgent = t.priority === 'urgent' || t.priority === 'high';
        const badgeClass = isUrgent ? 'badge-danger' : 'badge-neutral';
        return `
          <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); border-left: 3px solid ${isUrgent ? 'var(--danger)' : 'var(--border-medium)'};">
            <div style="min-width: 0; padding-right: 8px;">
              <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(t.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Due: ${due} ${t.caseId ? `&bull; ${UI.escapeHTML(t.caseId.caseNumber || '')}` : ''}
              </div>
            </div>
            <span class="badge ${badgeClass}" style="font-size: 0.65rem; text-transform: uppercase;">${t.priority}</span>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8125rem;">
          No pending tasks. Chamber work is up to date!
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }

  // 5. Fetch Pinned Notes
  try {
    const notesRes = await API.notes.getAll({ isPinned: true, limit: 3 });
    const container = document.getElementById('pinnedNotesList');

    if (notesRes && notesRes.success && notesRes.data && notesRes.data.length > 0) {
      container.innerHTML = notesRes.data.map(n => {
        const snippet = n.content.length > 100 ? n.content.substring(0, 100) + '...' : n.content;
        return `
          <div style="padding: 10px; border-radius: var(--radius-md); background: #FAFBFD; border: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(n.title)}</div>
              <span class="material-symbols-outlined" style="font-size: 14px; color: var(--gold-600);">push_pin</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 6px;">${UI.escapeHTML(snippet)}</p>
            ${n.citations && n.citations.length > 0 ? `
              <div style="font-size: 0.7rem; font-weight: 500; color: var(--gold-700); font-family: monospace;">
                ${UI.escapeHTML(n.citations[0])}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8125rem;">
          No pinned notes. Star important research notes in the Legal Notebook.
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load pinned notes:', err);
  }
}

// Setup Quick Add Modals
function setupQuickActionModals() {
  // Quick Add Case
  const addCaseBtn = document.getElementById('quickAddCaseBtn');
  if (addCaseBtn) {
    addCaseBtn.addEventListener('click', async () => {
      // Load clients into dropdown
      try {
        const clientsRes = await API.clients.getAll({ limit: 100 });
        const select = document.getElementById('caseClientSelect');
        if (clientsRes.success && clientsRes.data) {
          select.innerHTML = '<option value="">Select client...</option>' + 
            clientsRes.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.name)} (${UI.escapeHTML(c.clientType)})</option>`).join('');
        }
      } catch (err) {
        console.error(err);
      }
      UI.openModal('caseModal');
    });
  }

  // Handle Case Form Submit
  const caseForm = document.getElementById('quickCaseForm');
  if (caseForm) {
    caseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveCaseBtn');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Creating...';

      try {
        const payload = {
          title: document.getElementById('caseTitle').value.trim(),
          caseNumber: document.getElementById('caseNumber').value.trim(),
          cnrNumber: document.getElementById('caseCnr').value.trim() || undefined,
          court: document.getElementById('caseCourt').value.trim(),
          courtRoom: document.getElementById('caseCourtRoom').value.trim() || undefined,
          caseType: document.getElementById('caseType').value,
          clientId: document.getElementById('caseClientSelect').value,
          partyRole: document.getElementById('casePartyRole').value,
          totalAgreedFee: Number(document.getElementById('caseAgreedFee').value) || 0
        };

        const res = await API.cases.create(payload);
        UI.showToast('Case created successfully!', 'success');
        UI.closeModal('caseModal');
        caseForm.reset();
        await loadDashboardData();
      } catch (err) {
        UI.showToast(err.message || 'Failed to create case', 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Create Case';
      }
    });
  }

  // Quick Add Hearing
  const addHearingBtn = document.getElementById('quickAddHearingBtn');
  if (addHearingBtn) {
    addHearingBtn.addEventListener('click', async () => {
      // Default date to today
      document.getElementById('hearingDate').value = new Date().toISOString().split('T')[0];

      // Load cases into dropdown
      try {
        const casesRes = await API.cases.getAll({ limit: 100, status: 'active' });
        const select = document.getElementById('hearingCaseSelect');
        if (casesRes.success && casesRes.data) {
          select.innerHTML = '<option value="">Select case matter...</option>' +
            casesRes.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');
        }
      } catch (err) {
        console.error(err);
      }
      UI.openModal('hearingModal');
    });
  }

  // Handle Hearing Form Submit
  const hearingForm = document.getElementById('quickHearingForm');
  if (hearingForm) {
    hearingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveHearingBtn');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Scheduling...';

      try {
        const payload = {
          caseId: document.getElementById('hearingCaseSelect').value,
          hearingDate: document.getElementById('hearingDate').value,
          time: document.getElementById('hearingTime').value || undefined,
          itemNumber: Number(document.getElementById('hearingItemNo').value) || undefined,
          courtRoom: document.getElementById('hearingCourtNo').value.trim() || undefined,
          purpose: document.getElementById('hearingPurpose').value.trim(),
          judge: document.getElementById('hearingJudge').value.trim() || undefined
        };

        await API.hearings.create(payload);
        UI.showToast('Hearing scheduled successfully!', 'success');
        UI.closeModal('hearingModal');
        hearingForm.reset();
        await loadDashboardData();
      } catch (err) {
        UI.showToast(err.message || 'Failed to schedule hearing', 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Schedule Hearing';
      }
    });
  }
}

// Global modal trigger for recording outcome
window.openRecordOutcomeModal = (hearingId) => {
  window.location.href = `/hearings.html?hearingId=${hearingId}&action=outcome`;
};
