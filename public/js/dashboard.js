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
      const activeCasesCount = data.totalActiveCases ?? data.activeCases ?? data.summary?.activeCases ?? 0;
      const totalCasesCount = data.totalCases ?? data.summary?.totalCases ?? activeCasesCount;
      document.getElementById('kpiActiveCases').innerText = activeCasesCount;
      document.getElementById('kpiActiveCasesSub').innerText = `${totalCasesCount} total matters in firm`;

      // Today's Hearings
      const todayCount = data.todayHearingsCount ?? data.summary?.todayHearingsCount ?? 0;
      document.getElementById('kpiTodayHearings').innerText = todayCount;
      document.getElementById('kpiTodayHearingsSub').innerText = todayCount > 0 
        ? `${todayCount} cause list appearance${todayCount > 1 ? 's' : ''}`
        : 'All chambers clear today';

      // Pending Tasks
      const pendingCount = data.pendingTasksCount ?? data.summary?.pendingTasksCount ?? 0;
      const urgentCount = data.urgentTasksCount ?? data.summary?.urgentTasksCount ?? 0;
      document.getElementById('kpiPendingTasks').innerText = pendingCount;
      document.getElementById('kpiPendingTasksSub').innerText = `${urgentCount} high priority`;

      // Financials
      const outstandingVal = data.totalOutstanding ?? data.pendingDues ?? data.summary?.totalOutstanding ?? 0;
      const collectedVal = data.totalCollected ?? data.totalRevenue ?? data.summary?.totalCollected ?? 0;
      const billedVal = data.totalBilled ?? data.totalAgreedFee ?? data.summary?.totalBilled ?? (collectedVal + outstandingVal);
      document.getElementById('kpiOutstandingFees').innerText = UI.formatINR(outstandingVal);
      document.getElementById('kpiCollectedFeesSub').innerText = `Collected: ${UI.formatINR(collectedVal)}`;

      // Financial Quick View card
      document.getElementById('finBilled').innerText = UI.formatINR(billedVal);
      document.getElementById('finCollected').innerText = UI.formatINR(collectedVal);
      document.getElementById('finOutstanding').innerText = UI.formatINR(outstandingVal);
    }
  } catch (err) {
    console.error('Failed to load analytics summary:', err);
  }

  // 2. Fetch Today's Cause List (with upcoming fallback so court appearances are never blank)
  try {
    let causeListRes = await API.hearings.getDailyCauseList({ range: 'today' });
    let hearings = (causeListRes && causeListRes.success && causeListRes.data) ? causeListRes.data : [];
    let isUpcoming = false;

    if (hearings.length === 0) {
      const upcomingRes = await API.hearings.getDailyCauseList({ range: 'upcoming' });
      if (upcomingRes && upcomingRes.success && upcomingRes.data && upcomingRes.data.length > 0) {
        hearings = upcomingRes.data.slice(0, 5);
        isUpcoming = true;
      } else {
        const allHearingsRes = await API.hearings.getAll({ limit: 5 });
        if (allHearingsRes && allHearingsRes.success && allHearingsRes.data && allHearingsRes.data.length > 0) {
          hearings = allHearingsRes.data;
          isUpcoming = true;
        }
      }
    }

    const tbody = document.getElementById('todayHearingsTableBody');
    const badgeEl = document.querySelector('.card .badge-warning');
    if (badgeEl && isUpcoming) {
      badgeEl.className = 'badge badge-primary';
      badgeEl.innerText = 'UPCOMING CAUSE LIST';
    }

    if (hearings.length > 0) {
      tbody.innerHTML = hearings.map(h => {
        const itemNo = h.itemNumber ? `<span class="badge badge-warning font-mono" style="font-size: 0.8125rem;">#${h.itemNumber}</span>` : '<span style="color: var(--text-muted);">-</span>';
        const courtRoom = (h.courtroom || h.courtRoom) ? ` (${UI.escapeHTML(h.courtroom || h.courtRoom)})` : '';
        const courtName = (h.court || (h.caseId ? h.caseId.court : 'Court')) + courtRoom;
        const caseTitle = h.caseId ? (h.caseId.title || 'Legal Matter') : (h.title || 'Legal Hearing');
        const caseNum = h.caseId ? (h.caseId.caseNumber || '') : '';
        const caseId = h.caseId ? (h.caseId._id || h.caseId) : '';
        const hDate = h.date ? UI.formatDate(h.date) : 'Scheduled';

        return `
          <tr>
            <td>${itemNo}</td>
            <td>
              <div style="font-weight: 600; color: var(--navy-900);">
                <a href="/case-details.html?id=${caseId}" style="color: inherit; text-decoration: none;">
                  ${UI.escapeHTML(caseTitle)}
                </a>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">
                ${caseNum ? UI.escapeHTML(caseNum) + ' &bull; ' : ''}${hDate}
              </div>
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
            No court hearings scheduled. Use "+ New Hearing" above to calendar a court date.
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error('Failed to load cause list:', err);
  }

  // 3. Fetch Recent Cases
  try {
    const casesRes = await API.cases.getAll({ limit: 5 });
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

  // 4. Fetch Urgent Tasks (with fallback to recent tasks)
  try {
    let tasksRes = await API.tasks.getAll({ status: 'pending', limit: 4 });
    let tasks = (tasksRes && tasksRes.success && tasksRes.data) ? tasksRes.data : [];

    if (tasks.length === 0) {
      const allTasksRes = await API.tasks.getAll({ limit: 4 });
      if (allTasksRes && allTasksRes.success && allTasksRes.data) {
        tasks = allTasksRes.data;
      }
    }

    const container = document.getElementById('urgentTasksList');
    if (tasks.length > 0) {
      container.innerHTML = tasks.map(t => {
        const due = t.dueDate ? UI.formatDate(t.dueDate) : 'No due date';
        const isUrgent = t.priority === 'Urgent' || t.priority === 'High' || t.priority === 'urgent' || t.priority === 'high';
        const badgeClass = isUrgent ? 'badge-danger' : 'badge-neutral';
        return `
          <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); border-left: 3px solid ${isUrgent ? 'var(--danger)' : 'var(--border-medium)'};">
            <div style="min-width: 0; padding-right: 8px;">
              <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(t.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Due: ${due} ${t.caseId ? `&bull; ${UI.escapeHTML(t.caseId.caseNumber || t.caseId.title || '')}` : ''}
              </div>
            </div>
            <span class="badge ${badgeClass}" style="font-size: 0.65rem; text-transform: uppercase;">${UI.escapeHTML(t.priority || 'Medium')}</span>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8125rem;">
          No tasks recorded. Open Tasks & Deadlines to add chamber tasks.
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }

  // 5. Fetch Pinned Notes (with fallback to recent notes)
  try {
    let notesRes = await API.notes.getAll({ pinned: true, limit: 3 });
    let notes = (notesRes && notesRes.success && notesRes.data) ? notesRes.data : [];

    if (notes.length === 0) {
      const allNotesRes = await API.notes.getAll({ limit: 3 });
      if (allNotesRes && allNotesRes.success && allNotesRes.data && allNotesRes.data.length > 0) {
        notes = allNotesRes.data;
      }
    }

    const container = document.getElementById('pinnedNotesList');
    if (notes.length > 0) {
      container.innerHTML = notes.map(n => {
        const snippet = n.content && n.content.length > 100 ? n.content.substring(0, 100) + '...' : (n.content || 'No note details');
        const citation = n.citation || (n.citations && n.citations[0]) || '';
        return `
          <div style="padding: 10px; border-radius: var(--radius-md); background: #FAFBFD; border: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(n.title)}</div>
              <span class="material-symbols-outlined" style="font-size: 14px; color: ${n.pinned ? 'var(--gold-600)' : 'var(--text-muted)'};">${n.pinned ? 'push_pin' : 'description'}</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 6px;">${UI.escapeHTML(snippet)}</p>
            ${citation ? `
              <div style="font-size: 0.7rem; font-weight: 500; color: var(--gold-700); font-family: monospace;">
                ${UI.escapeHTML(citation)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8125rem;">
          No research notes recorded. Open Legal Notebook to add notes.
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
          oppositeParty: document.getElementById('caseOpponent').value.trim() || undefined,
          oppositeCounsel: document.getElementById('caseOpponentAdvocate').value.trim() || undefined,
          currentStage: document.getElementById('caseStage').value.trim() || undefined,
          status: document.getElementById('caseStatus').value,
          agreedFee: Number(document.getElementById('caseAgreedFee').value) || 0,
          lastHearingDate: document.getElementById('caseLastHearing').value || undefined,
          currentHearingDate: document.getElementById('caseCurrentHearing').value || undefined,
          nextHearingDate: document.getElementById('caseNextHearing').value || undefined,
          description: document.getElementById('caseDescription').value.trim() || undefined
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
        if (casesRes.success && casesRes.data && casesRes.data.length > 0) {
          select.innerHTML = '<option value="">Select case matter...</option>' +
            casesRes.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber || 'MATTER')} — ${UI.escapeHTML(c.title || 'Untitled Case')}</option>`).join('');
        } else {
          select.innerHTML = '<option value="">No cases found (Register a case first)</option>';
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
