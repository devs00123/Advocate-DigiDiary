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

  const todayStr = new Date().toISOString().split('T')[0];

  // We generate up to 42 cells (6 rows)
  let cellDate = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    const dateStr = cellDate.toISOString().split('T')[0];
    const isCurrentMonth = cellDate.getMonth() === currentMonth;
    const isToday = dateStr === todayStr;

    // Filter events for this specific day
    const dayEvents = calendarEvents.filter(ev => {
      const evDate = (ev.start || '').split('T')[0];
      if (evDate !== dateStr) return false;
      if (ev.type === 'hearing' && !showHearings) return false;
      if (ev.type === 'task' && !showTasks) return false;
      if (ev.type === 'reminder' && !showReminders) return false;
      return true;
    });

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;

    let eventsHtml = dayEvents.slice(0, 4).map(ev => {
      let icon = 'balance';
      if (ev.type === 'task') icon = 'check_box';
      if (ev.type === 'reminder') icon = 'notifications';

      return `
        <div class="event-pill ${ev.type}" onclick="showEventDetails('${ev.id}', '${ev.type}')" title="${UI.escapeHTML(ev.title)}">
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

window.showEventDetails = (id, type) => {
  const ev = calendarEvents.find(e => e.id === id);
  if (!ev) return;

  const modalTitle = document.getElementById('eventModalTitle');
  const modalBody = document.getElementById('eventModalBody');
  const modalFooter = document.getElementById('eventModalFooter');

  let typeBadge = '';
  if (type === 'hearing') typeBadge = '<span class="badge badge-primary">Court Hearing</span>';
  else if (type === 'task') typeBadge = '<span class="badge badge-success">Practice Task</span>';
  else if (type === 'reminder') typeBadge = '<span class="badge badge-warning">Chamber Reminder</span>';

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
      ${ev.judge ? `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;">
          <span style="color: var(--text-muted);">Presiding Judge:</span>
          <strong>${UI.escapeHTML(ev.judge)}</strong>
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

  UI.openModal('eventModal');
};
