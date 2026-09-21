/**
 * Advocate DigiDiary — Case Details & 7 Sections Controller
 * Strictly NO document storage.
 */

let currentCaseId = null;
let currentCase = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  const urlParams = new URLSearchParams(window.location.search);
  currentCaseId = urlParams.get('id');

  if (!currentCaseId) {
    UI.showToast('No case ID specified', 'danger');
    setTimeout(() => window.location.href = '/cases.html', 1500);
    return;
  }

  setupTabs();
  setupActionModals();
  await loadCaseData();
});

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }

      // Lazy load tab data if needed
      if (targetId === 'tabTimeline') loadTimeline();
      else if (targetId === 'tabHearings') loadHearings();
      else if (targetId === 'tabTasks') loadTasks();
      else if (targetId === 'tabNotes') loadNotes();
      else if (targetId === 'tabFinancials') loadFinancials();
      else if (targetId === 'tabActivity') loadActivity();
    });
  });
}

async function loadCaseData() {
  try {
    const res = await API.cases.getById(currentCaseId);
    if (!res.success || !res.data) {
      UI.showToast('Case not found', 'danger');
      return;
    }

    currentCase = res.data;
    renderCaseHeader(currentCase);
    renderOverview(currentCase);
  } catch (err) {
    console.error(err);
    UI.showToast('Failed to load case: ' + err.message, 'danger');
  }
}

function renderCaseHeader(c) {
  document.getElementById('caseTitleDisplay').innerText = c.title;
  document.getElementById('caseNumberBadge').innerText = c.caseNumber;
  
  if (c.cnrNumber) {
    const cnrBadge = document.getElementById('caseCnrBadge');
    cnrBadge.style.display = 'inline-block';
    cnrBadge.innerText = `CNR: ${c.cnrNumber}`;
  }

  document.getElementById('caseTypeBadge').innerText = c.caseType || 'Civil';
  document.getElementById('caseStatusBadge').innerHTML = UI.getStatusBadge(c.status);

  document.getElementById('caseCourtDisplay').innerText = c.court;
  document.getElementById('caseCourtRoomDisplay').innerText = c.courtroom || c.courtRoom || 'Main Bench';
  document.getElementById('caseClientDisplay').innerText = c.clientId ? c.clientId.name : 'Unknown';
  document.getElementById('caseRoleDisplay').innerText = c.clientRepresentation || c.partyRole || 'Petitioner';
  document.getElementById('caseStageDisplay').innerText = c.currentStage || c.stage || 'Hearing';

  const nextDateEl = document.getElementById('caseNextHearingDisplay');
  const nextSubEl = document.getElementById('caseNextHearingSub');

  if (c.currentHearingDate) {
    nextDateEl.innerText = UI.formatDate(c.currentHearingDate);
    nextSubEl.innerText = 'Listed on Cause List';
  } else {
    nextDateEl.innerText = 'Not scheduled';
    nextSubEl.innerText = 'Awaiting court listing';
  }
}

function renderOverview(c) {
  document.getElementById('caseDescriptionText').innerText = c.description || 'No description provided for this matter.';
  document.getElementById('overviewClientName').innerText = c.clientId ? c.clientId.name : '-';
  document.getElementById('overviewClientRole').innerText = `Represented Side: ${c.clientRepresentation || c.partyRole || 'Petitioner'}`;
  document.getElementById('overviewOpponentName').innerText = c.oppositeParty || c.opponentParty || 'Not recorded';
  document.getElementById('overviewOpponentCounsel').innerText = (c.oppositeCounsel || c.opponentAdvocate) ? `Counsel: ${c.oppositeCounsel || c.opponentAdvocate}` : 'Counsel not recorded';

  document.getElementById('overviewCourt').innerText = c.court;
  document.getElementById('overviewCourtRoom').innerText = c.courtroom || c.courtRoom || '-';
  document.getElementById('overviewCnr').innerText = c.cnrNumber || 'N/A';
  document.getElementById('overviewFilingDate').innerText = c.filingDate ? UI.formatDate(c.filingDate) : 'Not specified';

  // Hearing dates
  const lastHearingEl = document.getElementById('overviewLastHearing');
  const currentHearingEl = document.getElementById('overviewCurrentHearing');
  const nextHearingEl = document.getElementById('overviewNextHearing');
  if (lastHearingEl) lastHearingEl.innerText = c.lastHearingDate ? UI.formatDate(c.lastHearingDate) : 'Not recorded';
  if (currentHearingEl) currentHearingEl.innerText = c.currentHearingDate ? UI.formatDate(c.currentHearingDate) : 'Not recorded';
  if (nextHearingEl) nextHearingEl.innerText = c.currentHearingDate ? UI.formatDate(c.currentHearingDate) : 'Not scheduled';
}

// 2. Timeline
async function loadTimeline() {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '<p style="color: var(--text-muted);">Loading procedural history...</p>';

  try {
    const res = await API.cases.getTimeline(currentCaseId);
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = res.data.map((item, idx) => {
        let icon = 'event';
        let color = 'var(--gold-600)';

        if (item.type === 'hearing') {
          icon = 'balance';
          color = 'var(--primary)';
        } else if (item.type === 'task') {
          icon = 'check_circle';
          color = 'var(--success)';
        } else if (item.type === 'note') {
          icon = 'edit_note';
          color = 'var(--gold-700)';
        } else if (item.type === 'payment') {
          icon = 'payments';
          color = 'var(--success)';
        }

        return `
          <div style="position: relative; padding-bottom: 1.5rem; padding-left: 1.5rem; border-left: 2px solid var(--border-light);">
            <div style="position: absolute; left: -11px; top: 0; width: 20px; height: 20px; border-radius: 50%; background: white; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 11px; color: ${color};">${icon}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(item.title || item.action || 'Procedural Event')}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${UI.formatDate(item.date || item.createdAt)}</span>
            </div>
            <p style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">${UI.escapeHTML(item.description || item.purpose || '')}</p>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 1.5rem 0;">No timeline events recorded yet.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Failed to load timeline: ${UI.escapeHTML(err.message)}</p>`;
  }
}

// 3. Hearings
async function loadHearings() {
  const tbody = document.getElementById('caseHearingsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading hearings...</td></tr>';

  try {
    const res = await API.hearings.getAll({ caseId: currentCaseId, sort: '-hearingDate' });
    if (res.success && res.data && res.data.length > 0) {
      tbody.innerHTML = res.data.map(h => {
        const itemNo = h.itemNumber ? `<span class="badge badge-warning font-mono">#${h.itemNumber}</span>` : '-';
        const courtRoom = h.courtRoom ? ` (${UI.escapeHTML(h.courtRoom)})` : '';
        const outcomeDisplay = h.outcome 
          ? `<div style="font-size: 0.8125rem; font-weight: 500; color: var(--navy-900);">${UI.escapeHTML(h.outcome)}</div>`
          : '<span style="color: var(--text-muted); font-size: 0.75rem;">Pending appearance</span>';

        return `
          <tr>
            <td>${itemNo}</td>
            <td>
              <div style="font-weight: 600; color: var(--navy-900);">${UI.formatDate(h.date || h.hearingDate)}</div>
              ${h.time ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${h.time}</div>` : ''}
            </td>
            <td>
              <div style="font-size: 0.8125rem;">${UI.escapeHTML(h.court || currentCase.court)}${courtRoom}</div>
              ${h.judge ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(h.judge)}</div>` : ''}
            </td>
            <td>
              <span style="font-size: 0.8125rem;">${UI.escapeHTML(h.purpose || 'Hearing')}</span>
            </td>
            <td>${outcomeDisplay}</td>
            <td>${UI.getStatusBadge(h.status)}</td>
            <td style="text-align: right;">
              <button class="btn btn-sm btn-outline" onclick="openRecordOutcomeModal('${h._id}')" style="padding: 4px 8px; font-size: 0.75rem;">
                Outcome
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hearings scheduled yet for this case.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 1.5rem;">${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

// 4. Tasks
async function loadTasks() {
  const container = document.getElementById('caseTasksContainer');
  container.innerHTML = '<p style="color: var(--text-muted);">Loading tasks...</p>';

  try {
    const res = await API.tasks.getAll({ caseId: currentCaseId, sort: 'dueDate' });
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = res.data.map(t => {
        const isDone = String(t.status).toLowerCase() === 'completed';
        const isUrgent = String(t.priority).toLowerCase() === 'urgent' || String(t.priority).toLowerCase() === 'high';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); background: ${isDone ? 'rgba(5, 150, 105, 0.04)' : 'var(--surface-low)'}; border-left: 3px solid ${isDone ? 'var(--success)' : (isUrgent ? 'var(--danger)' : 'var(--border-medium)')}; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskStatus('${t._id}', this.checked)" title="Mark as ${isDone ? 'To Do' : 'Completed'}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--secondary);">
              <div>
                <div style="font-size: 0.875rem; font-weight: 600; color: var(--navy-900); ${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                  ${UI.escapeHTML(t.title)}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  Due: ${UI.formatDate(t.dueDate)} &bull; Assigned to: ${t.assignedTo ? UI.escapeHTML(t.assignedTo.name) : 'Chamber Team'}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${isDone ? 'badge-success' : (isUrgent ? 'badge-danger' : 'badge-neutral')}" style="font-size: 0.65rem; text-transform: uppercase;">
                ${isDone ? 'COMPLETED' : UI.escapeHTML(t.priority || t.status)}
              </span>
              <button class="btn btn-sm btn-ghost text-danger" title="Delete Task" onclick="deleteCaseTask('${t._id}')" style="padding: 2px 6px;">
                <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem 0;">No tasks created for this case.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">${UI.escapeHTML(err.message)}</p>`;
  }
}

window.toggleTaskStatus = async (taskId, isChecked) => {
  try {
    const res = await API.tasks.update(taskId, { status: isChecked ? 'Completed' : 'To Do' });
    if (res && res.success) {
      UI.showToast(isChecked ? 'Task marked as Completed' : 'Task marked as To Do', 'success');
    }
    await loadTasks();
  } catch (err) {
    UI.showToast(err.message || 'Failed to update task', 'danger');
    await loadTasks();
  }
};

window.deleteCaseTask = async (taskId) => {
  const confirmed = await UI.confirm({
    title: 'Delete Chamber Task',
    message: 'Are you sure you want to remove this task from this matter?',
    confirmText: 'Delete Task',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    const res = await API.tasks.delete(taskId);
    if (res && res.success) {
      UI.showToast('Task removed from case', 'success');
    }
    await loadTasks();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete task', 'danger');
  }
};

// 5. Notes (Text Only)
async function loadNotes() {
  const container = document.getElementById('caseNotesContainer');
  container.innerHTML = '<p style="color: var(--text-muted);">Loading notes...</p>';

  try {
    const res = await API.notes.getAll({ caseId: currentCaseId, sort: '-createdAt' });
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = res.data.map(n => {
        const citationsHtml = n.citations && n.citations.length > 0
          ? `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
              ${n.citations.map(c => `<span class="badge badge-warning font-mono" style="font-size: 0.7rem;">${UI.escapeHTML(c)}</span>`).join('')}
             </div>`
          : '';

        return `
          <div style="padding: 1.25rem; border-radius: var(--radius-md); background: #FAFBFD; border: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <h4 style="font-family: var(--font-headline); font-size: 1rem; color: var(--navy-900); font-weight: 700;">
                ${UI.escapeHTML(n.title)}
              </h4>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${UI.formatDate(n.createdAt)}</span>
            </div>
            <p style="font-size: 0.875rem; color: var(--text-color); line-height: 1.6; white-space: pre-wrap;">
              ${UI.escapeHTML(n.content)}
            </p>
            ${citationsHtml}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem 0;">No legal research notes recorded for this matter.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">${UI.escapeHTML(err.message)}</p>`;
  }
}

// 6. Financials
async function loadFinancials() {
  const tbody = document.getElementById('casePaymentsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading payments...</td></tr>';

  try {
    const res = await API.financial.getPayments({ caseId: currentCaseId, sort: '-paymentDate' });
    
    // Compute real balance
    const agreedFee = currentCase.totalAgreedFee || 0;
    let totalPaid = 0;
    if (res.success && res.data) {
      totalPaid = res.data.reduce((sum, p) => sum + (p.amount || 0), 0);
    }
    const balanceDue = Math.max(0, agreedFee - totalPaid);

    document.getElementById('finTotalAgreed').innerText = UI.formatINR(agreedFee);
    document.getElementById('finTotalPaid').innerText = UI.formatINR(totalPaid);
    document.getElementById('finBalanceDue').innerText = UI.formatINR(balanceDue);

    if (res.success && res.data && res.data.length > 0) {
      tbody.innerHTML = res.data.map(p => `
        <tr>
          <td style="font-family: monospace; font-weight: 600; color: var(--gold-700);">${UI.escapeHTML(p.receiptNumber || 'RCP-' + p._id.substr(-6))}</td>
          <td>${UI.formatDate(p.paymentDate)}</td>
          <td><span class="badge badge-neutral">${UI.escapeHTML(p.paymentMethod || 'Bank Transfer')}</span></td>
          <td style="font-weight: 700; color: var(--success);">${UI.formatINR(p.amount)}</td>
          <td style="font-family: monospace; font-size: 0.8125rem;">${UI.escapeHTML(p.referenceNumber || '-')}</td>
          <td style="font-size: 0.8125rem; color: var(--text-muted);">${UI.escapeHTML(p.notes || '-')}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No fee payments recorded yet.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 1.5rem;">${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

// 7. Activity
async function loadActivity() {
  const container = document.getElementById('caseActivityContainer');
  container.innerHTML = '<p style="color: var(--text-muted);">Loading activity...</p>';

  try {
    const res = await API.audit.getAll({ entityId: currentCaseId, limit: 20 });
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = res.data.map(log => `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 8px 12px; border-radius: var(--radius-md); background: var(--surface-low); border-left: 2px solid var(--gold-500);">
          <div>
            <span style="font-weight: 600; color: var(--navy-900); font-size: 0.8125rem;">${UI.escapeHTML(log.action)}:</span>
            <span style="font-size: 0.8125rem; color: var(--text-color); margin-left: 4px;">${UI.escapeHTML(log.description || '')}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">by ${log.userId ? UI.escapeHTML(log.userId.name || 'User') : 'Chamber'}</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${UI.formatDate(log.createdAt)}</span>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem 0;">No logged activity yet.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">${UI.escapeHTML(err.message)}</p>`;
  }
}

// Action Modals setup
function setupActionModals() {
  // Schedule Hearing Trigger
  const scheduleHearingBtn = document.getElementById('scheduleHearingActionBtn');
  const addHearingTabBtn = document.getElementById('addHearingTabBtn');
  const openHearingModal = () => {
    document.getElementById('cHearingDate').value = new Date().toISOString().split('T')[0];
    UI.openModal('caseHearingModal');
  };
  if (scheduleHearingBtn) scheduleHearingBtn.addEventListener('click', openHearingModal);
  if (addHearingTabBtn) addHearingTabBtn.addEventListener('click', openHearingModal);

  // Hearing Form Submit
  document.getElementById('caseHearingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveHearingBtn');
    btn.disabled = true;
    btn.innerText = 'Scheduling...';

    try {
      await API.hearings.create({
        caseId: currentCaseId,
        hearingDate: document.getElementById('cHearingDate').value,
        time: document.getElementById('cHearingTime').value || undefined,
        itemNumber: Number(document.getElementById('cHearingItemNo').value) || undefined,
        courtRoom: document.getElementById('cHearingCourtNo').value.trim() || undefined,
        purpose: document.getElementById('cHearingPurpose').value.trim(),
        judge: document.getElementById('cHearingJudge').value.trim() || undefined
      });

      UI.showToast('Hearing scheduled successfully!', 'success');
      UI.closeModal('caseHearingModal');
      document.getElementById('caseHearingForm').reset();
      await loadCaseData();
      await loadHearings();
    } catch (err) {
      UI.showToast(err.message || 'Failed to schedule hearing', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Schedule Hearing';
    }
  });

  // Record Outcome Modal
  window.openRecordOutcomeModal = (hearingId) => {
    document.getElementById('outcomeHearingId').value = hearingId;
    document.getElementById('hearingOutcomeForm').reset();
    UI.openModal('hearingOutcomeModal');
  };

  document.getElementById('hearingOutcomeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveOutcomeBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const hearingId = document.getElementById('outcomeHearingId').value;
    try {
      await API.hearings.recordOutcome(hearingId, {
        status: document.getElementById('outcomeStatusSelect').value,
        outcome: document.getElementById('outcomeText').value.trim(),
        nextDate: document.getElementById('outcomeNextDate').value || undefined,
        nextStage: document.getElementById('outcomeNextPurpose').value.trim() || undefined
      });

      UI.showToast('Outcome recorded successfully!', 'success');
      UI.closeModal('hearingOutcomeModal');
      await loadCaseData();
      await loadHearings();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save outcome', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Outcome';
    }
  });

  // Add Task Trigger & Form
  const addTaskTabBtn = document.getElementById('addTaskTabBtn');
  if (addTaskTabBtn) {
    addTaskTabBtn.addEventListener('click', () => {
      document.getElementById('taskDueDate').value = new Date().toISOString().split('T')[0];
      UI.openModal('caseTaskModal');
    });
  }

  document.getElementById('caseTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.tasks.create({
        caseId: currentCaseId,
        title: document.getElementById('taskTitle').value.trim(),
        dueDate: document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value
      });

      UI.showToast('Task added!', 'success');
      UI.closeModal('caseTaskModal');
      document.getElementById('caseTaskForm').reset();
      await loadTasks();
    } catch (err) {
      UI.showToast(err.message || 'Failed to add task', 'danger');
    }
  });

  window.toggleTaskStatus = async (taskId, isChecked) => {
    try {
      await API.tasks.update(taskId, { status: isChecked ? 'completed' : 'pending' });
      await loadTasks();
    } catch (err) {
      UI.showToast('Failed to update task', 'danger');
    }
  };

  // Add Note Trigger & Form (Text Only)
  const addNoteTabBtn = document.getElementById('addNoteTabBtn');
  if (addNoteTabBtn) {
    addNoteTabBtn.addEventListener('click', () => {
      UI.openModal('caseNoteModal');
    });
  }

  document.getElementById('caseNoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const citationsRaw = document.getElementById('noteCitations').value.trim();
    const citations = citationsRaw ? citationsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];

    try {
      await API.notes.create({
        caseId: currentCaseId,
        title: document.getElementById('noteTitle').value.trim(),
        content: document.getElementById('noteContent').value.trim(),
        citations: citations
      });

      UI.showToast('Note added!', 'success');
      UI.closeModal('caseNoteModal');
      document.getElementById('caseNoteForm').reset();
      await loadNotes();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save note', 'danger');
    }
  });

  // Record Payment Trigger & Form
  const recordPayBtn = document.getElementById('recordPaymentActionBtn');
  const addPaymentTabBtn = document.getElementById('addPaymentTabBtn');
  const openPayModal = () => {
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    UI.openModal('casePaymentModal');
  };
  if (recordPayBtn) recordPayBtn.addEventListener('click', openPayModal);
  if (addPaymentTabBtn) addPaymentTabBtn.addEventListener('click', openPayModal);

  document.getElementById('casePaymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('savePaymentBtn');
    btn.disabled = true;
    btn.innerText = 'Recording...';

    try {
      await API.financial.createPayment({
        caseId: currentCaseId,
        clientId: currentCase.clientId ? (currentCase.clientId._id || currentCase.clientId) : undefined,
        amount: Number(document.getElementById('payAmount').value),
        paymentDate: document.getElementById('payDate').value,
        paymentMethod: document.getElementById('payMethod').value,
        referenceNumber: document.getElementById('payTxnId').value.trim() || undefined,
        notes: document.getElementById('payNotes').value.trim() || undefined
      });

      UI.showToast('Payment recorded successfully!', 'success');
      UI.closeModal('casePaymentModal');
      document.getElementById('casePaymentForm').reset();
      await loadCaseData();
      await loadFinancials();
    } catch (err) {
      UI.showToast(err.message || 'Failed to record payment', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Record Payment';
    }
  });
}
