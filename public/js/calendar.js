/**
 * Advocate DigiDiary — Unified Court Calendar Logic
 * Reads directly from MongoDB (hearings, tasks, reminders). No fake DB.
 */

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let calendarEvents = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupControls();
  await loadMonth();
});

function setupControls() {
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    loadMonth();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    loadMonth();
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    loadMonth();
  });

  document.getElementById('showHearingsCheck').addEventListener('change', renderCalendarGrid);
  document.getElementById('showTasksCheck').addEventListener('change', renderCalendarGrid);
  document.getElementById('showRemindersCheck').addEventListener('change', renderCalendarGrid);
}

async function loadMonth() {
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });
  document.getElementById('calendarMonthTitle').innerText = monthName;

  // Compute start and end dates for the calendar query
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // Extend to cover full grid (Sunday before first day to Saturday after last day)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  try {
    const res = await API.calendar.getEvents({ start: startStr, end: endStr });
    if (res.success && res.data) {
      calendarEvents = res.data;
    } else {
      calendarEvents = [];
    }
  } catch (err) {
    console.error('Failed to load calendar events:', err);
    calendarEvents = [];
  }

  renderCalendarGrid();
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendarDaysGrid');
  grid.innerHTML = '';

  const showHearings = document.getElementById('showHearingsCheck').checked;
  const showTasks = document.getElementById('showTasksCheck').checked;
  const showReminders = document.getElementById('showRemindersCheck').checked;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = String(today.getMonth() + 1).padStart(2, '0');
  const todayD = String(today.getDate()).padStart(2, '0');
  const todayStr = `${todayY}-${todayM}-${todayD}`;

  // We generate up to 42 cells (6 rows)
  let cellDate = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    const y = cellDate.getFullYear();
    const m = String(cellDate.getMonth() + 1).padStart(2, '0');
    const d = String(cellDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const isCurrentMonth = cellDate.getMonth() === currentMonth;
    const isToday = dateStr === todayStr;

    // Filter events for this specific day
    const dayEvents = calendarEvents.filter(ev => {
      const type = (ev.type || '').toLowerCase();
      if (type === 'hearing' && !showHearings) return false;
      if (type === 'task' && !showTasks) return false;
      if (type === 'reminder' && !showReminders) return false;

      const raw = ev.start || ev.date || ev.reminderDate || ev.dueDate;
      if (!raw) return false;

      const isoKey = String(raw).split('T')[0];
      const evObj = new Date(raw);
      let localKey = '';
      if (!isNaN(evObj.getTime())) {
        const ey = evObj.getFullYear();
        const em = String(evObj.getMonth() + 1).padStart(2, '0');
        const ed = String(evObj.getDate()).padStart(2, '0');
        localKey = `${ey}-${em}-${ed}`;
      }

      return isoKey === dateStr || localKey === dateStr;
    });

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;

    let eventsHtml = dayEvents.slice(0, 4).map(ev => {
      const normType = (ev.type || 'hearing').toLowerCase();
      return `
        <div class="event-pill ${normType}" data-id="${ev.id || ev._id}" data-type="${normType}" title="${UI.escapeHTML(ev.title)}">
          <span>${UI.escapeHTML(ev.title)}</span>
        </div>
      `;
    }).join('');

    if (dayEvents.length > 4) {
      eventsHtml += `<div style="font-size: 10px; color: var(--text-muted); font-weight: 600; padding: 2px;">+${dayEvents.length - 4} more</div>`;
    }

    cell.innerHTML = `
      <div class="day-header">
        <span class="day-number">${cellDate.getDate()}</span>
      </div>
      <div class="day-events">
        ${eventsHtml}
      </div>
    `;

    grid.appendChild(cell);

    // Stop after 35 cells if current month is finished and row is complete
    if (i >= 34 && cellDate > lastDay && cellDate.getDay() === 6) {
      break;
    }

    cellDate.setDate(cellDate.getDate() + 1);
  }
}

// Event delegation for calendar pills to prevent CSP inline issues
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('calendarDaysGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const pill = e.target.closest('.event-pill');
      if (pill) {
        const id = pill.getAttribute('data-id');
        const type = pill.getAttribute('data-type');
        if (id) showEventDetails(id, type);
      }
    });
  }
});

window.showEventDetails = (id, type) => {
  const ev = calendarEvents.find(e => String(e.id || e._id) === String(id));
  if (!ev) return;

  const modalTitle = document.getElementById('eventModalTitle');
  const modalBody = document.getElementById('eventModalBody');
  const modalFooter = document.getElementById('eventModalFooter');

  const normType = (type || ev.type || 'hearing').toLowerCase();

  if (normType === 'hearing') {
    modalTitle.innerText = ev.caseTitle || ev.title;

    const lastDateDisplay = ev.lastDate ? UI.formatDate(ev.lastDate) : '<span style="color: var(--text-muted); font-style: italic;">Initial Listing / First Hearing</span>';
    const currentDateDisplay = UI.formatDate(ev.currentDate || ev.date || ev.start);
    const nextDateDisplay = ev.nextDate ? UI.formatDate(ev.nextDate) : '<span style="color: var(--gold-700); font-style: italic;">To be fixed / Not scheduled</span>';
    const caseId = ev.caseId ? (ev.caseId._id || ev.caseId) : null;

    // Format ISO dates for date input defaults
    const curDateIso = (ev.currentDate || ev.date || ev.start) ? new Date(ev.currentDate || ev.date || ev.start).toISOString().split('T')[0] : '';
    const nextDateIso = ev.nextDate ? new Date(ev.nextDate).toISOString().split('T')[0] : '';

    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge badge-primary" style="font-weight: 700; letter-spacing: 0.03em;">Court Hearing</span>
          <span class="badge badge-neutral" style="text-transform: uppercase;">${UI.escapeHTML(ev.status || 'Scheduled')}</span>
        </div>
        ${ev.caseNumber ? `<span style="font-family: monospace; font-size: 0.8125rem; font-weight: 700; color: var(--navy-900);">${UI.escapeHTML(ev.caseNumber)}</span>` : ''}
      </div>

      <!-- Core Hearing Docket Details -->
      <div style="background: #FAFBFD; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
        <div class="hearing-core-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.875rem;">
          <div>
            <span style="font-size: 0.725rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: block;">Case Title</span>
            <strong style="color: var(--navy-900);">${UI.escapeHTML(ev.caseTitle || ev.title)}</strong>
          </div>
          <div>
            <span style="font-size: 0.725rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: block;">Court / Forum</span>
            <strong style="color: var(--navy-900);">${UI.escapeHTML(ev.court || 'District Court')}${ev.courtroom ? ` — ${UI.escapeHTML(ev.courtroom)}` : ''}</strong>
          </div>
          <div>
            <span style="font-size: 0.725rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: block;">Appearing For</span>
            <strong style="color: var(--gold-700);">${UI.escapeHTML(ev.appearingFor || 'Counsel')}</strong>
          </div>
          <div>
            <span style="font-size: 0.725rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: block;">Presiding Bench / Judge</span>
            <strong style="color: var(--navy-900);">${UI.escapeHTML(ev.judge || 'Hon\'ble Bench')}</strong>
          </div>
        </div>

        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-light);">
          <span style="font-size: 0.725rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: block;">Remarks / Bench Notes</span>
          <p style="margin: 4px 0 0; font-size: 0.875rem; color: var(--navy-900); line-height: 1.4;">${UI.escapeHTML(ev.remarks || ev.description || 'Regular Hearing Proceedings')}</p>
        </div>
      </div>

      <!-- Hearing Dates Timeline Details -->
      <div class="hearing-dates-timeline" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center; margin-bottom: 1.25rem;">
        <div style="padding: 0.625rem; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-sm);">
          <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; display: block;">Last Date of Hearing</span>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--text-dark); margin-top: 2px;">${lastDateDisplay}</div>
        </div>
        <div style="padding: 0.625rem; background: rgba(197, 155, 39, 0.08); border: 1px solid var(--gold-500); border-radius: var(--radius-sm);">
          <span style="font-size: 0.7rem; color: var(--gold-700); text-transform: uppercase; font-weight: 700; display: block;">Current Date of Hearing</span>
          <div style="font-size: 0.875rem; font-weight: 700; color: var(--navy-900); margin-top: 2px;">${currentDateDisplay}</div>
        </div>
        <div style="padding: 0.625rem; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-sm);">
          <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; display: block;">Next Date of Hearing</span>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900); margin-top: 2px;">${nextDateDisplay}</div>
        </div>
      </div>

      <!-- Quick Auto-Update Hearing Section -->
      <div style="border: 1px solid rgba(197, 155, 39, 0.3); background: rgba(197, 155, 39, 0.04); border-radius: var(--radius-md); padding: 1rem;">
        <h4 style="font-size: 0.875rem; font-weight: 700; color: var(--navy-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px; color: var(--gold-600);">edit_calendar</span>
          Auto-Update Hearing Dates & Remarks
        </h4>
        <form id="autoUpdateHearingForm">
          <div class="grid grid-cols-2 gap-3" style="margin-bottom: 0.75rem;">
            <div>
              <label class="form-label" style="font-size: 0.75rem;">Current Hearing Date</label>
              <input type="date" id="hearingCurrentDateInput" class="form-control" value="${curDateIso}" style="font-size: 0.8125rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.75rem;">Next Hearing Date (Auto-Syncs Case)</label>
              <input type="date" id="hearingNextDateInput" class="form-control" value="${nextDateIso}" style="font-size: 0.8125rem; padding: 6px 10px;">
            </div>
          </div>
          <div style="margin-bottom: 0.75rem;">
            <label class="form-label" style="font-size: 0.75rem;">Remarks / Bench Directions</label>
            <input type="text" id="hearingRemarksInput" class="form-control" placeholder="Arguments concluded / Notice issued / Judgment reserved" value="${UI.escapeHTML(ev.benchNotes || ev.remarks || '')}" style="font-size: 0.8125rem; padding: 6px 10px;">
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-sm btn-primary" id="btnAutoUpdateSave">
              <span class="material-symbols-outlined" style="font-size: 16px;">sync</span>
              <span>Auto-Update Hearing & Case</span>
            </button>
          </div>
        </form>
      </div>
    `;

    // Footer actions
    modalFooter.innerHTML = `
      ${caseId ? `<a href="/case-details.html?id=${caseId}" class="btn btn-outline btn-sm">Open Case Docket</a>` : ''}
      <button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal('eventModal')">Close</button>
    `;

    // Handle form submit for auto-update
    setTimeout(() => {
      const form = document.getElementById('autoUpdateHearingForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const saveBtn = document.getElementById('btnAutoUpdateSave');
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<span>Saving...</span>';

          const newCurrentDate = document.getElementById('hearingCurrentDateInput').value;
          const newNextDate = document.getElementById('hearingNextDateInput').value;
          const newRemarks = document.getElementById('hearingRemarksInput').value.trim();

          const updatePayload = {};
          if (newCurrentDate) updatePayload.date = newCurrentDate;
          if (newNextDate) updatePayload.nextDate = newNextDate;
          if (newRemarks) {
            updatePayload.benchNotes = newRemarks;
            updatePayload.remarks = newRemarks;
          }

          try {
            await API.hearings.update(ev.id, updatePayload);
            UI.showToast('Hearing dates and remarks updated & synchronized with case docket!', 'success');
            UI.closeModal('eventModal');
            await fetchCalendarEvents();
          } catch (err) {
            UI.showToast(err.message || 'Failed to update hearing', 'danger');
          } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">sync</span><span>Auto-Update Hearing & Case</span>';
          }
        });
      }
    }, 50);

  } else {
    // Tasks or reminders view
    let typeBadge = '';
    if (normType === 'task') typeBadge = '<span class="badge badge-success">Practice Task</span>';
    else if (normType === 'reminder') typeBadge = '<span class="badge badge-warning">Chamber Reminder</span>';

    modalTitle.innerText = ev.title;

    modalBody.innerHTML = `
      <div style="margin-bottom: 1rem;">
        ${typeBadge}
        <span class="badge badge-neutral" style="margin-left: 6px; text-transform: uppercase;">${UI.escapeHTML(ev.status || 'Active')}</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.875rem;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;">
          <span style="color: var(--text-muted);">Scheduled Date:</span>
          <strong style="color: var(--navy-900);">${UI.formatDate(ev.start)}</strong>
        </div>
        ${ev.court ? `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;">
            <span style="color: var(--text-muted);">Court / Forum:</span>
            <strong>${UI.escapeHTML(ev.court)}</strong>
          </div>
        ` : ''}
        ${ev.description ? `
          <div style="padding-top: 6px;">
            <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Details / Note:</span>
            <p style="margin-top: 4px; line-height: 1.5; color: var(--navy-900);">${UI.escapeHTML(ev.description)}</p>
          </div>
        ` : ''}
      </div>
    `;

    if (ev.caseId) {
      const caseId = ev.caseId._id || ev.caseId;
      modalFooter.innerHTML = `
        <a href="/case-details.html?id=${caseId}" class="btn btn-primary btn-sm">Open Case Matter</a>
        <button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal('eventModal')">Close</button>
      `;
    } else {
      modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal('eventModal')">Close</button>
      `;
    }
  }

  UI.openModal('eventModal');
};
