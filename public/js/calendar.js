(function() {
  'use strict';

  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth();
  var calendarEvents = [];

  document.addEventListener('DOMContentLoaded', async function() {
    await Auth.requireAuth();
    initNavigation();
    initFilters();
    initEventDelegation();
    await loadMonth();
  });

  function initNavigation() {
    document.getElementById('prevMonthBtn').addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      loadMonth();
    });
    document.getElementById('nextMonthBtn').addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      loadMonth();
    });
    document.getElementById('todayBtn').addEventListener('click', function() {
      var now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      loadMonth();
    });
  }

  function initFilters() {
    document.getElementById('showHearingsCheck').addEventListener('change', renderGrid);
    document.getElementById('showTasksCheck').addEventListener('change', renderGrid);
    document.getElementById('showRemindersCheck').addEventListener('change', renderGrid);
  }

  function initEventDelegation() {
    var grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.addEventListener('click', function(e) {
      var pill = e.target.closest('.cal-event');
      if (pill) {
        e.stopPropagation();
        var id = pill.getAttribute('data-id');
        var type = pill.getAttribute('data-type');
        if (id) showEventDetails(id, type);
        return;
      }
      var more = e.target.closest('.cal-more');
      if (more) {
        e.stopPropagation();
        var dateStr = more.getAttribute('data-date');
        var dayEvents = calendarEvents.filter(function(ev) { return getDateKey(ev) === dateStr; });
        if (dayEvents.length > 0) showDayModal(dateStr, dayEvents);
        return;
      }
      var cell = e.target.closest('.cal-day');
      if (cell && !cell.classList.contains('cal-day--other')) {
        var ds = cell.getAttribute('data-date');
        if (ds) {
          var evts = calendarEvents.filter(function(ev) { return getDateKey(ev) === ds; });
          if (evts.length === 1) {
            showEventDetails(String(evts[0].id || evts[0]._id), (evts[0].type || 'hearing').toLowerCase());
          } else if (evts.length > 1) {
            showDayModal(ds, evts);
          }
        }
      }
    });
  }

  async function loadMonth() {
    var monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    document.getElementById('calendarMonthTitle').textContent = monthName;

    var firstDay = new Date(currentYear, currentMonth, 1);
    var lastDay = new Date(currentYear, currentMonth + 1, 0);
    var startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    var endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    var startStr = startDate.toISOString().split('T')[0];
    var endStr = endDate.toISOString().split('T')[0];

    try {
      var res = await API.calendar.getEvents({ start: startStr, end: endStr });
      calendarEvents = (res && res.success && res.data) ? res.data : [];
    } catch (err) {
      console.error('Failed to load calendar events:', err);
      calendarEvents = [];
    }
    renderGrid();
  }

  function renderGrid() {
    var grid = document.getElementById('calendarGrid');
    var heads = grid.querySelectorAll('.cal-head');
    grid.innerHTML = '';
    heads.forEach(function(h) { grid.appendChild(h); });

    var showHearings = document.getElementById('showHearingsCheck').checked;
    var showTasks = document.getElementById('showTasksCheck').checked;
    var showReminders = document.getElementById('showRemindersCheck').checked;

    var firstDay = new Date(currentYear, currentMonth, 1);
    var lastDay = new Date(currentYear, currentMonth + 1, 0);
    var startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    var today = new Date();
    var todayStr = dateToStr(today);

    var cellDate = new Date(startDate);
    for (var i = 0; i < 42; i++) {
      var dateStr = dateToStr(cellDate);
      var isCurrentMonth = cellDate.getMonth() === currentMonth;
      var isToday = dateStr === todayStr;

      var dayEvents = calendarEvents.filter(function(ev) {
        var t = (ev.type || '').toLowerCase();
        if (t === 'hearing' && !showHearings) return false;
        if (t === 'task' && !showTasks) return false;
        if (t === 'reminder' && !showReminders) return false;
        return getDateKey(ev) === dateStr;
      });

      var cell = document.createElement('div');
      cell.className = 'cal-day' + (!isCurrentMonth ? ' cal-day--other' : '') + (isToday ? ' cal-day--today' : '');
      cell.setAttribute('data-date', dateStr);

      var eventsHtml = dayEvents.slice(0, 4).map(function(ev) {
        var normType = (ev.type || 'hearing').toLowerCase();
        return '<div class="cal-event cal-event--' + normType + '" data-id="' + (ev.id || ev._id) + '" data-type="' + normType + '" title="' + UI.escapeHTML(ev.title) + '">' + UI.escapeHTML(ev.title) + '</div>';
      }).join('');

      if (dayEvents.length > 4) {
        eventsHtml += '<div class="cal-more" data-date="' + dateStr + '">+' + (dayEvents.length - 4) + ' more</div>';
      }

      cell.innerHTML = '<div class="cal-day__num">' + cellDate.getDate() + '</div><div class="cal-day__events">' + eventsHtml + '</div>';
      grid.appendChild(cell);

      if (i >= 34 && cellDate > lastDay && cellDate.getDay() === 6) break;
      cellDate.setDate(cellDate.getDate() + 1);
    }
  }

  function showDayModal(dateStr, events) {
    var d = new Date(dateStr + 'T00:00:00');
    var dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
    var dateDisplay = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('dayModalTitle').textContent = dayName + ', ' + dateDisplay;

    var html = '<div class="cal-day-list">';
    events.forEach(function(ev) {
      var normType = (ev.type || 'hearing').toLowerCase();
      var meta = '';
      if (normType === 'hearing') {
        meta = (ev.time || '10:00 AM') + (ev.court ? ' - ' + UI.escapeHTML(ev.court) : '');
      } else if (normType === 'task') {
        meta = ev.priority ? UI.escapeHTML(ev.priority) + ' Priority' : '';
      } else {
        meta = ev.time || '';
      }
      html += '<div class="cal-day-item" data-id="' + (ev.id || ev._id) + '" data-type="' + normType + '">' +
        '<div class="cal-day-item__dot cal-day-item__dot--' + normType + '"></div>' +
        '<div class="cal-day-item__info">' +
          '<div class="cal-day-item__title">' + UI.escapeHTML(ev.title) + '</div>' +
          '<div class="cal-day-item__meta">' + meta + '</div>' +
        '</div>' +
        '<div class="cal-day-item__arrow"><span class="material-symbols-outlined">chevron_right</span></div>' +
      '</div>';
    });
    html += '</div>';

    document.getElementById('dayModalBody').innerHTML = html;

    var modal = document.getElementById('dayModal');
    modal.querySelector('.cal-day-list').addEventListener('click', function(e) {
      var item = e.target.closest('.cal-day-item');
      if (item) {
        var id = item.getAttribute('data-id');
        var type = item.getAttribute('data-type');
        UI.closeModal('dayModal');
        setTimeout(function() { showEventDetails(id, type); }, 200);
      }
    });

    UI.openModal('dayModal');
  }

  window.showEventDetails = function(id, type) {
    var ev = calendarEvents.find(function(e) { return String(e.id || e._id) === String(id); });
    if (!ev) return;

    var modalTitle = document.getElementById('eventModalTitle');
    var modalBody = document.getElementById('eventModalBody');
    var modalFooter = document.getElementById('eventModalFooter');
    var normType = (type || ev.type || 'hearing').toLowerCase();

    if (normType === 'hearing') {
      renderHearingModal(ev, modalTitle, modalBody, modalFooter);
    } else {
      renderTaskReminderModal(ev, normType, modalTitle, modalBody, modalFooter);
    }
    UI.openModal('eventModal');
  };

  function renderHearingModal(ev, titleEl, bodyEl, footerEl) {
    titleEl.textContent = ev.caseTitle || ev.title;

    var lastDateDisplay = ev.lastDate ? UI.formatDate(ev.lastDate) : '<span style="color: var(--text-muted); font-style: italic;">Initial Listing</span>';
    var currentDateDisplay = UI.formatDate(ev.currentDate || ev.date || ev.start);
    var nextDateDisplay = ev.nextDate ? UI.formatDate(ev.nextDate) : '<span style="color: var(--gold-700); font-style: italic;">To be fixed</span>';
    var caseId = ev.caseId ? (ev.caseId._id || ev.caseId) : null;
    var curDateIso = (ev.currentDate || ev.date || ev.start) ? new Date(ev.currentDate || ev.date || ev.start).toISOString().split('T')[0] : '';
    var nextDateIso = ev.nextDate ? new Date(ev.nextDate).toISOString().split('T')[0] : '';

    bodyEl.innerHTML =
      '<div class="cal-detail__badges">' +
        '<span class="badge badge-primary" style="font-weight: 700;">Court Hearing</span>' +
        '<span class="badge badge-neutral" style="text-transform: uppercase;">' + UI.escapeHTML(ev.status || 'Scheduled') + '</span>' +
        (ev.caseNumber ? '<span class="cal-detail__case-num">' + UI.escapeHTML(ev.caseNumber) + '</span>' : '') +
      '</div>' +
      '<div class="cal-detail__core">' +
        '<div class="cal-detail__grid">' +
          '<div><span class="cal-detail__label">Case Title</span><strong class="cal-detail__value">' + UI.escapeHTML(ev.caseTitle || ev.title) + '</strong></div>' +
          '<div><span class="cal-detail__label">Court / Forum</span><strong class="cal-detail__value">' + UI.escapeHTML(ev.court || 'District Court') + (ev.courtroom ? ' - ' + UI.escapeHTML(ev.courtroom) : '') + '</strong></div>' +
          '<div><span class="cal-detail__label">Appearing For</span><strong class="cal-detail__value cal-detail__value--gold">' + UI.escapeHTML(ev.appearingFor || 'Counsel') + '</strong></div>' +
          '<div><span class="cal-detail__label">Presiding Bench / Judge</span><strong class="cal-detail__value">' + UI.escapeHTML(ev.judge || "Hon'ble Bench") + '</strong></div>' +
        '</div>' +
        '<div class="cal-detail__remarks">' +
          '<span class="cal-detail__label">Remarks / Bench Notes</span>' +
          '<p style="margin: 4px 0 0; font-size: 0.875rem; color: var(--navy-900); line-height: 1.4;">' + UI.escapeHTML(ev.remarks || ev.description || 'Regular Hearing Proceedings') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="cal-detail__timeline">' +
        '<div class="cal-detail__tl-cell"><span class="cal-detail__tl-label">Last Hearing</span><div class="cal-detail__tl-value">' + lastDateDisplay + '</div></div>' +
        '<div class="cal-detail__tl-cell cal-detail__tl-cell--current"><span class="cal-detail__tl-label">Current Hearing</span><div class="cal-detail__tl-value">' + currentDateDisplay + '</div></div>' +
      '</div>' +
      '<div class="cal-detail__update">' +
        '<h4><span class="material-symbols-outlined">edit_calendar</span> Auto-Update Hearing Dates & Remarks</h4>' +
        '<form id="autoUpdateHearingForm">' +
          '<div class="cal-detail__form-grid">' +
            '<div><label class="form-label" style="font-size: 0.75rem;">Current Hearing Date</label><input type="date" id="hearingCurrentDateInput" class="form-control" value="' + curDateIso + '" style="font-size: 0.8125rem; padding: 6px 10px;"></div>' +
            '<div><label class="form-label" style="font-size: 0.75rem;">Next Hearing Date</label><input type="date" id="hearingNextDateInput" class="form-control" value="' + nextDateIso + '" style="font-size: 0.8125rem; padding: 6px 10px;"></div>' +
          '</div>' +
          '<div style="margin-bottom: 0.75rem;"><label class="form-label" style="font-size: 0.75rem;">Remarks / Bench Directions</label><input type="text" id="hearingRemarksInput" class="form-control" placeholder="Arguments concluded / Notice issued" value="' + UI.escapeHTML(ev.benchNotes || ev.remarks || '') + '" style="font-size: 0.8125rem; padding: 6px 10px;"></div>' +
          '<div class="cal-detail__form-actions"><button type="submit" class="btn btn-sm btn-primary" id="btnAutoUpdateSave"><span class="material-symbols-outlined" style="font-size: 16px;">sync</span><span>Auto-Update Hearing & Case</span></button></div>' +
        '</form>' +
      '</div>';

    footerEl.innerHTML =
      (caseId ? '<a href="/case-details.html?id=' + caseId + '" class="btn btn-outline btn-sm">Open Case Docket</a>' : '') +
      '<button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal(\'eventModal\')">Close</button>';

    setTimeout(function() {
      var form = document.getElementById('autoUpdateHearingForm');
      if (!form) return;
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('btnAutoUpdateSave');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>Saving...</span>';

        var payload = {};
        var newCurrentDate = document.getElementById('hearingCurrentDateInput').value;
        var newNextDate = document.getElementById('hearingNextDateInput').value;
        var newRemarks = document.getElementById('hearingRemarksInput').value.trim();
        if (newCurrentDate) payload.date = newCurrentDate;
        if (newNextDate) payload.nextDate = newNextDate;
        if (newRemarks) { payload.benchNotes = newRemarks; payload.remarks = newRemarks; }

        try {
          await API.hearings.update(ev.id || ev._id, payload);
          UI.showToast('Hearing dates and remarks updated!', 'success');
          UI.closeModal('eventModal');
          await loadMonth();
        } catch (err) {
          UI.showToast(err.message || 'Failed to update hearing', 'danger');
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">sync</span><span>Auto-Update Hearing & Case</span>';
        }
      });
    }, 50);
  }

  function renderTaskReminderModal(ev, normType, titleEl, bodyEl, footerEl) {
    var typeBadge = normType === 'task' ? '<span class="badge badge-success">Practice Task</span>' : '<span class="badge badge-warning">Chamber Reminder</span>';
    titleEl.textContent = ev.title;

    bodyEl.innerHTML =
      '<div style="margin-bottom: 1rem;">' + typeBadge +
      '<span class="badge badge-neutral" style="margin-left: 6px; text-transform: uppercase;">' + UI.escapeHTML(ev.status || 'Active') + '</span></div>' +
      '<div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.875rem;">' +
        '<div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;"><span style="color: var(--text-muted);">Scheduled Date:</span><strong style="color: var(--navy-900);">' + UI.formatDate(ev.start) + '</strong></div>' +
        (ev.court ? '<div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;"><span style="color: var(--text-muted);">Court / Forum:</span><strong>' + UI.escapeHTML(ev.court) + '</strong></div>' : '') +
        (ev.description ? '<div style="padding-top: 6px;"><span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Details / Note:</span><p style="margin-top: 4px; line-height: 1.5; color: var(--navy-900);">' + UI.escapeHTML(ev.description) + '</p></div>' : '') +
      '</div>';

    if (ev.caseId) {
      var caseId = ev.caseId._id || ev.caseId;
      footerEl.innerHTML = '<a href="/case-details.html?id=' + caseId + '" class="btn btn-primary btn-sm">Open Case Matter</a><button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal(\'eventModal\')">Close</button>';
    } else {
      footerEl.innerHTML = '<button type="button" class="btn btn-outline btn-sm" onclick="UI.closeModal(\'eventModal\')">Close</button>';
    }
  }

  function getDateKey(ev) {
    var raw = ev.start || ev.date || ev.reminderDate || ev.dueDate;
    if (!raw) return '';
    var isoKey = String(raw).split('T')[0];
    var d = new Date(raw);
    if (!isNaN(d.getTime())) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
    return isoKey;
  }

  function dateToStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

})();
