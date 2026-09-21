/**
 * ADVOCATE DIGIDIARY - COURT CALENDAR & DAILY CAUSE LIST CLIENT
 * Fully synchronized with Case Portfolio & Legal Dockets (17 Practice Fields)
 */

(function() {
  'use strict';

  // State Management
  var currentDate = new Date();
  var selectedDateStr = dateToStr(new Date());
  var currentView = 'month'; // 'month' | 'causelist' | 'agenda'
  var allEvents = [];
  var activeModalEvent = null;

  var filters = {
    search: '',
    court: '',
    caseType: '',
    showHearings: true,
    showTasks: true,
    showReminders: true,
  };

  document.addEventListener('DOMContentLoaded', async function() {
    await Auth.requireAuth();

    parseUrlParameters();
    initNavigation();
    initViewSwitchers();
    initFiltersAndSearch();
    initRescheduleForm();
    initPrintCauseList();

    await loadCalendarData();
  });

  // -------------------------------------------------------------
  // 1. Initialization & URL Parameter Handling
  // -------------------------------------------------------------
  function parseUrlParameters() {
    var params = new URLSearchParams(window.location.search);
    var targetDate = params.get('date');
    var targetView = params.get('view');
    var targetCaseId = params.get('caseId');

    if (targetDate) {
      var d = new Date(targetDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        currentDate = d;
        selectedDateStr = targetDate;
        currentView = 'causelist';
      }
    }

    if (targetView && ['month', 'causelist', 'agenda'].indexOf(targetView.toLowerCase()) !== -1) {
      currentView = targetView.toLowerCase();
    }

    // After loading, if targetCaseId is present, we'll pop open its modal
    if (targetCaseId) {
      window._pendingTargetCaseId = targetCaseId;
    }
  }

  function initNavigation() {
    document.getElementById('calPrevBtn').addEventListener('click', function() {
      if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
      } else if (currentView === 'causelist') {
        currentDate.setDate(currentDate.getDate() - 1);
        selectedDateStr = dateToStr(currentDate);
      } else {
        currentDate.setMonth(currentDate.getMonth() - 1);
      }
      loadCalendarData();
    });

    document.getElementById('calNextBtn').addEventListener('click', function() {
      if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (currentView === 'causelist') {
        currentDate.setDate(currentDate.getDate() + 1);
        selectedDateStr = dateToStr(currentDate);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      loadCalendarData();
    });

    document.getElementById('calTodayBtn').addEventListener('click', function() {
      currentDate = new Date();
      selectedDateStr = dateToStr(new Date());
      loadCalendarData();
    });
  }

  function initViewSwitchers() {
    var monthBtn = document.getElementById('calViewMonthBtn');
    var causeListBtn = document.getElementById('calViewCauseListBtn');
    var agendaBtn = document.getElementById('calViewAgendaBtn');

    function updateActiveButton() {
      monthBtn.classList.toggle('active', currentView === 'month');
      causeListBtn.classList.toggle('active', currentView === 'causelist');
      agendaBtn.classList.toggle('active', currentView === 'agenda');
    }

    monthBtn.addEventListener('click', function() {
      currentView = 'month';
      updateActiveButton();
      updateViewDisplay();
    });

    causeListBtn.addEventListener('click', function() {
      currentView = 'causelist';
      updateActiveButton();
      updateViewDisplay();
    });

    agendaBtn.addEventListener('click', function() {
      currentView = 'agenda';
      updateActiveButton();
      updateViewDisplay();
    });

    updateActiveButton();
  }

  function initFiltersAndSearch() {
    var searchInput = document.getElementById('calSearchInput');
    var courtFilter = document.getElementById('calCourtFilter');
    var typeFilter = document.getElementById('calTypeFilter');
    var catHearings = document.getElementById('calCatHearings');
    var catTasks = document.getElementById('calCatTasks');
    var catReminders = document.getElementById('calCatReminders');

    var debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        filters.search = searchInput.value.trim().toLowerCase();
        updateViewDisplay();
      }, 200);
    });

    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        filters.search = '';
        updateViewDisplay();
      }
    });

    courtFilter.addEventListener('change', function() {
      filters.court = courtFilter.value;
      updateViewDisplay();
    });

    typeFilter.addEventListener('change', function() {
      filters.caseType = typeFilter.value;
      updateViewDisplay();
    });

    catHearings.addEventListener('change', function() {
      filters.showHearings = catHearings.checked;
      updateViewDisplay();
    });

    catTasks.addEventListener('change', function() {
      filters.showTasks = catTasks.checked;
      updateViewDisplay();
    });

    catReminders.addEventListener('change', function() {
      filters.showReminders = catReminders.checked;
      updateViewDisplay();
    });
  }

  function initPrintCauseList() {
    var btn = document.getElementById('printCauseListBtn');
    if (btn) {
      btn.addEventListener('click', function() {
        if (currentView !== 'causelist') {
          currentView = 'causelist';
          document.getElementById('calViewMonthBtn').classList.remove('active');
          document.getElementById('calViewCauseListBtn').classList.add('active');
          document.getElementById('calViewAgendaBtn').classList.remove('active');
          updateViewDisplay();
        }
        setTimeout(function() {
          window.print();
        }, 300);
      });
    }
  }

  // -------------------------------------------------------------
  // 2. Data Loading & Metrics
  // -------------------------------------------------------------
  async function loadCalendarData() {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();

    // Calculate boundary start and end dates
    var firstDayOfMonth = new Date(year, month, 1);
    var lastDayOfMonth = new Date(year, month + 1, 0);

    var gridStartDate = new Date(firstDayOfMonth);
    gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay()); // Sunday start

    var gridEndDate = new Date(lastDayOfMonth);
    gridEndDate.setDate(gridEndDate.getDate() + (6 - gridEndDate.getDay())); // Saturday end

    var startStr = dateToStr(gridStartDate);
    var endStr = dateToStr(gridEndDate);

    try {
      var res = await API.calendar.getEvents({ start: startStr, end: endStr });
      allEvents = (res && res.success && Array.isArray(res.data)) ? res.data : [];
    } catch (err) {
      console.error('Failed to load court calendar events:', err);
      allEvents = [];
    }

    updateMetrics();
    updateViewDisplay();

    // Check pending target case
    if (window._pendingTargetCaseId) {
      var targetId = window._pendingTargetCaseId;
      window._pendingTargetCaseId = null;
      var match = allEvents.find(function(ev) {
        var cid = ev.caseId ? (ev.caseId._id || ev.caseId) : null;
        return String(cid) === String(targetId) || String(ev.id || ev._id) === String(targetId);
      });
      if (match) {
        openEventModal(match);
      }
    }
  }

  function updateMetrics() {
    var todayStr = dateToStr(new Date());
    var curMonth = currentDate.getMonth();
    var curYear = currentDate.getFullYear();

    var monthlyHearings = 0;
    var todayHearings = 0;
    var superiorCourts = 0;
    var subordinateCourts = 0;

    allEvents.forEach(function(ev) {
      var normType = (ev.type || '').toLowerCase();
      if (normType !== 'hearing') return;

      var evDateKey = getDateKey(ev);
      var evDate = new Date(ev.date || ev.start || ev.currentDate);

      // Check if in current viewing month
      if (evDate.getMonth() === curMonth && evDate.getFullYear() === curYear) {
        monthlyHearings++;
      }

      // Check if today
      if (evDateKey === todayStr) {
        todayHearings++;
      }

      var court = (ev.court || '').toLowerCase();
      if (court.includes('supreme court') || court.includes('high court')) {
        superiorCourts++;
      } else {
        subordinateCourts++;
      }
    });

    document.getElementById('calMetricMonthly').textContent = monthlyHearings;
    document.getElementById('calMetricToday').textContent = todayHearings;
    document.getElementById('calMetricSuperior').textContent = superiorCourts;
    document.getElementById('calMetricSubordinate').textContent = subordinateCourts;
  }

  // -------------------------------------------------------------
  // 3. Master View Display Controller
  // -------------------------------------------------------------
  function updateViewDisplay() {
    var monthContainer = document.getElementById('calendarMonthContainer');
    var causeListContainer = document.getElementById('calendarCauseListContainer');
    var agendaContainer = document.getElementById('calendarAgendaContainer');
    var titleEl = document.getElementById('calPeriodTitle');

    if (currentView === 'month') {
      monthContainer.style.display = 'block';
      causeListContainer.style.display = 'none';
      agendaContainer.style.display = 'none';

      titleEl.textContent = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      renderMonthGrid();
    } else if (currentView === 'causelist') {
      monthContainer.style.display = 'none';
      causeListContainer.style.display = 'block';
      agendaContainer.style.display = 'none';

      var d = new Date(selectedDateStr + 'T00:00:00');
      titleEl.textContent = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      renderCauseList();
    } else {
      monthContainer.style.display = 'none';
      causeListContainer.style.display = 'none';
      agendaContainer.style.display = 'block';

      titleEl.textContent = 'Upcoming Listings — ' + currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      renderAgenda();
    }
  }

  // -------------------------------------------------------------
  // 4. View 1: Month Grid Renderer
  // -------------------------------------------------------------
  function renderMonthGrid() {
    var grid = document.getElementById('calendarMonthGrid');
    var dayHeads = grid.querySelectorAll('.cal-head-day');
    grid.innerHTML = '';
    dayHeads.forEach(function(h) { grid.appendChild(h); });

    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    var firstDayOfMonth = new Date(year, month, 1);
    var lastDayOfMonth = new Date(year, month + 1, 0);

    var startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    var todayStr = dateToStr(new Date());

    var filteredEvents = getFilteredEvents();

    if (filters.search) {
      var banner = document.createElement('div');
      banner.style = 'grid-column: 1 / -1; background: #FFF9E6; border: 1px solid #FFE082; border-radius: 8px; padding: 10px 16px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; color: #7F5A00;';
      banner.innerHTML = '<span><span class="material-symbols-outlined" style="font-size: 16px; vertical-align: text-bottom; margin-right: 5px;">search</span>Showing listings matching "<strong>' + UI.escapeHTML(filters.search) + '</strong>": <strong>' + filteredEvents.length + '</strong> result(s) found across this month. Click any highlighted day to open its court board.</span><button type="button" id="gridClearSearchBtn" style="background: #fff; border: 1px solid #FFE082; border-radius: 4px; padding: 2px 8px; font-weight: 700; color: #7F5A00; cursor: pointer; font-size: 0.75rem;">Clear</button>';
      grid.appendChild(banner);
      setTimeout(function() {
        var b = document.getElementById('gridClearSearchBtn');
        if (b) b.onclick = function() {
          var input = document.getElementById('calSearchInput');
          if (input) input.value = '';
          filters.search = '';
          updateViewDisplay();
        };
      }, 0);
    }

    var cellDate = new Date(startDate);
    for (var i = 0; i < 42; i++) {
      var dateKey = dateToStr(cellDate);
      var isCurrentMonth = cellDate.getMonth() === month;
      var isToday = dateKey === todayStr;

      var dayEvents = filteredEvents.filter(function(ev) {
        return getDateKey(ev) === dateKey;
      });

      var cell = document.createElement('div');
      cell.className = 'cal-grid-cell' +
        (!isCurrentMonth ? ' cal-grid-cell--other' : '') +
        (isToday ? ' cal-grid-cell--today' : '');
      cell.setAttribute('data-date', dateKey);

      if (filters.search && dayEvents.length > 0) {
        cell.style.boxShadow = 'inset 0 0 0 2px var(--gold-500)';
        cell.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
      }

      var topHtml =
        '<div class="cal-grid-cell-top">' +
          '<div class="cal-grid-cell-num">' + cellDate.getDate() + '</div>' +
          (dayEvents.length > 0 ? '<div class="cal-grid-cell-badge">' + dayEvents.length + ' listing' + (dayEvents.length > 1 ? 's' : '') + '</div>' : '') +
        '</div>';

      var chipsHtml = '<div class="cal-grid-cell-events">';
      var visibleLimit = 3;
      var displaySlice = dayEvents.slice(0, visibleLimit);

      displaySlice.forEach(function(ev) {
        var normType = (ev.type || 'hearing').toLowerCase();
        var timeLabel = ev.time || (normType === 'hearing' ? '10:00 AM' : '');
        var courtTag = getCourtAcronym(ev.court || '');
        var titleText = ev.caseTitle || ev.title || 'Legal Matter';
        var caseNum = ev.caseNumber ? '[' + ev.caseNumber + '] ' : '';

        chipsHtml +=
          '<div class="cal-chip cal-chip--' + normType + '" data-id="' + (ev.id || ev._id) + '" title="' + UI.escapeHTML(titleText) + '">' +
            (timeLabel ? '<span class="cal-chip-time">' + UI.escapeHTML(timeLabel) + '</span>' : '') +
            (courtTag ? '<strong style="margin-right: 3px;">' + UI.escapeHTML(courtTag) + '</strong> ' : '') +
            UI.escapeHTML(caseNum + titleText) +
          '</div>';
      });

      if (dayEvents.length > visibleLimit) {
        chipsHtml += '<div class="cal-chip-more" data-date="' + dateKey + '">+' + (dayEvents.length - visibleLimit) + ' more listings...</div>';
      }
      chipsHtml += '</div>';

      cell.innerHTML = topHtml + chipsHtml;

      // Click to view day cause list or event
      cell.addEventListener('click', function(e) {
        var chip = e.target.closest('.cal-chip');
        if (chip) {
          e.stopPropagation();
          var eventId = chip.getAttribute('data-id');
          var found = allEvents.find(function(item) { return String(item.id || item._id) === String(eventId); });
          if (found) openEventModal(found);
          return;
        }

        var clickedDate = this.getAttribute('data-date');
        if (clickedDate) {
          selectedDateStr = clickedDate;
          currentDate = new Date(clickedDate + 'T00:00:00');
          currentView = 'causelist';
          document.getElementById('calViewMonthBtn').classList.remove('active');
          document.getElementById('calViewCauseListBtn').classList.add('active');
          updateViewDisplay();
        }
      });

      grid.appendChild(cell);

      if (i >= 34 && cellDate > lastDayOfMonth && cellDate.getDay() === 6) {
        break;
      }
      cellDate.setDate(cellDate.getDate() + 1);
    }
  }

  // ------------------------------------------------------------  // 5. View 2: Daily Cause List (Court Board) Renderer
  // -------------------------------------------------------------
  function renderCauseList() {
    var container = document.getElementById('causeListContent');
    var targetDateObj = new Date(selectedDateStr + 'T00:00:00');
    var dayFormatted = targetDateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    var isSearching = !!(filters.search && filters.search.trim());
    var allFiltered = getFilteredEvents();

    var filtered = isSearching
      ? allFiltered
      : allFiltered.filter(function(ev) { return getDateKey(ev) === selectedDateStr; });

    var hearings = filtered.filter(function(ev) { return (ev.type || '').toLowerCase() === 'hearing'; });
    var otherEvents = filtered.filter(function(ev) { return (ev.type || '').toLowerCase() !== 'hearing'; });

    var bannerTitle = isSearching
      ? 'SEARCH RESULTS: COURT HEARINGS &amp; BOARD'
      : 'DAILY CAUSE LIST &amp; COURT BOARD';

    var bannerSub = isSearching
      ? '<span class="material-symbols-outlined" style="font-size: 18px;">search</span>' +
        '<span>SEARCH FOR: "' + UI.escapeHTML(filters.search).toUpperCase() + '"</span>' +
        '<span style="opacity: 0.5;">|</span>' +
        '<span>' + hearings.length + ' Matching Brief' + (hearings.length === 1 ? '' : 's') + ' Found</span>'
      : '<span class="material-symbols-outlined" style="font-size: 18px;">event</span>' +
        '<span>' + dayFormatted.toUpperCase() + '</span>' +
        '<span style="opacity: 0.5;">|</span>' +
        '<span>' + hearings.length + ' Brief' + (hearings.length === 1 ? '' : 's') + ' Listed</span>';

    var bannerActions = isSearching
      ? '<button type="button" class="btn btn-sm btn-outline" id="calClearSearchBtn" style="background: #FFFFFF; color: var(--navy-900);">' +
          '<span class="material-symbols-outlined icon-sm">close</span><span>Clear Search</span>' +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-outline" id="causeListPrintTrigger" style="background: #FFFFFF; color: var(--navy-900);">' +
          '<span class="material-symbols-outlined icon-sm">print</span><span>Print</span>' +
        '</button>'
      : '<input type="date" id="causeListDatePicker" class="form-control" value="' + selectedDateStr + '" style="background: #FFFFFF; color: var(--navy-900); padding: 6px 12px; font-weight: 600; width: auto;">' +
        '<button type="button" class="btn btn-sm btn-outline" id="causeListPrintTrigger" style="background: #FFFFFF; color: var(--navy-900);">' +
          '<span class="material-symbols-outlined icon-sm">print</span><span>Print Board</span>' +
        '</button>';

    var html =
      '<div class="causelist-banner">' +
        '<div>' +
          '<h2 class="causelist-banner-title">' + bannerTitle + '</h2>' +
          '<div class="causelist-banner-sub">' + bannerSub + '</div>' +
        '</div>' +
        '<div class="causelist-banner-actions">' + bannerActions + '</div>' +
      '</div>';

    if (hearings.length === 0 && otherEvents.length === 0) {
      if (isSearching) {
        html +=
          '<div class="card" style="text-align: center; padding: 4rem 2rem; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 10px;">' +
            '<div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(10,17,40,0.06); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">' +
              '<span class="material-symbols-outlined" style="font-size: 32px; color: var(--navy-900);">search_off</span>' +
            '</div>' +
            '<h3 style="font-family: var(--font-headline); font-size: 1.375rem; color: var(--navy-900); margin-bottom: 0.5rem;">No Court Listings Matched "' + UI.escapeHTML(filters.search) + '"</h3>' +
            '<p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem; font-size: 0.875rem;">' +
              'No hearings or court board items match your search across this period. Check the spelling or try searching by case title, CNR, client, or courtroom.' +
            '</p>' +
            '<button type="button" class="btn btn-primary btn-sm" id="calClearSearchBtnEmpty">' +
              '<span class="material-symbols-outlined icon-sm">restart_alt</span><span>Clear Search Filter</span>' +
            '</button>' +
          '</div>';
      } else {
        html +=
          '<div class="card" style="text-align: center; padding: 4rem 2rem; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 10px;">' +
            '<div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(10,17,40,0.06); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">' +
              '<span class="material-symbols-outlined" style="font-size: 32px; color: var(--navy-900);">event_busy</span>' +
            '</div>' +
            '<h3 style="font-family: var(--font-headline); font-size: 1.375rem; color: var(--navy-900); margin-bottom: 0.5rem;">No Court Listings Scheduled</h3>' +
            '<p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem; font-size: 0.875rem;">' +
              'No hearings or court board items are scheduled for ' + dayFormatted + '. You can register a new matter or schedule a hearing from the Case Portfolio.' +
            '</p>' +
            '<a href="/cases.html" class="btn btn-primary btn-sm">' +
              '<span class="material-symbols-outlined icon-sm">gavel</span><span>Go to Case Portfolio</span>' +
            '</a>' +
          '</div>';
      }
      container.innerHTML = html;
      attachCauseListListeners();
      return;
    }

    // Group hearings by Court & Court Room/Bench
    var courtGroups = {};
    hearings.forEach(function(h) {
      var courtKey = (h.court || 'District Court') + (h.courtroom ? ' — ' + h.courtroom : '');
      if (!courtGroups[courtKey]) courtGroups[courtKey] = [];
      courtGroups[courtKey].push(h);
    });

    // Render Court Groups
    var groupKeys = Object.keys(courtGroups);
    var itemCounter = 1;

    groupKeys.forEach(function(courtKey) {
      var items = courtGroups[courtKey];
      html +=
        '<div class="causelist-court-group">' +
          '<div class="causelist-court-header">' +
            '<div class="causelist-court-title">' +
              '<span class="material-symbols-outlined">account_balance</span>' +
              '<span>' + UI.escapeHTML(courtKey) + '</span>' +
            '</div>' +
            '<span class="causelist-court-badge">' + items.length + ' Item' + (items.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="causelist-table-wrap">' +
            '<table class="causelist-table">' +
              '<thead>' +
                '<tr>' +
                  '<th style="width: 55px; text-align: center;">Item #</th>' +
                  '<th style="min-width: 220px;">Cause Title &amp; Particulars</th>' +
                  '<th style="min-width: 170px;">Petition &amp; CNR No.</th>' +
                  '<th style="min-width: 170px;">Client &amp; Representation</th>' +
                  '<th style="min-width: 160px;">Opposite Party &amp; Counsel</th>' +
                  '<th style="min-width: 140px;">Stage / Purpose</th>' +
                  '<th style="min-width: 90px;">Time</th>' +
                  '<th style="width: 100px; text-align: right;">Action</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>';

      items.forEach(function(item) {
        var caseId = item.caseId ? (item.caseId._id || item.caseId) : null;
        var cnrHtml = item.cnrNumber
          ? '<div class="causelist-cnr-pill" onclick="copyCNR(event, \'' + item.cnrNumber + '\')" title="Click to Copy 16-Digit CNR">' +
              '<span class="material-symbols-outlined">content_copy</span>' +
              '<span>' + UI.escapeHTML(item.cnrNumber) + '</span>' +
            '</div>'
          : '<span style="color: var(--text-muted); font-size: 0.6875rem; font-style: italic;">No CNR</span>';

        html +=
          '<tr>' +
            '<td><span class="causelist-item-no">' + itemCounter++ + '</span></td>' +
            '<td>' +
              '<div class="causelist-cause-title">' + UI.escapeHTML(item.caseTitle || item.title) + '</div>' +
              '<div style="font-size: 0.75rem; color: var(--gold-700); font-weight: 600;">' + UI.escapeHTML(item.caseType || 'Civil Suit') + '</div>' +
              (isSearching ? '<div style="margin-top: 4px;"><span class="badge badge-gold" style="font-size: 0.6875rem; font-weight: 700;">📅 ' + formatDDMMYYYY(item.date || item.start || item.currentDate) + '</span></div>' : '') +
              (item.caseSynopsis ? '<div class="causelist-synopsis">' + UI.escapeHTML(item.caseSynopsis.substring(0, 100)) + (item.caseSynopsis.length > 100 ? '...' : '') + '</div>' : '') +
            '</td>' +
            '<td>' +
              '<div style="font-family: var(--font-mono); font-weight: 600; color: var(--navy-900);">' + UI.escapeHTML(item.caseNumber || 'MATTER-' + item.id.substring(item.id.length - 6)) + '</div>' +
              cnrHtml +
            '</td>' +
            '<td>' +
              '<div style="font-weight: 600; color: var(--navy-900);">' + UI.escapeHTML(item.clientName || 'Private Client') + '</div>' +
              '<span class="badge badge-primary" style="font-size: 0.6875rem; margin-top: 3px;">' + UI.escapeHTML(item.clientRepresentation || 'Counsel') + '</span>' +
            '</td>' +
            '<td>' +
              '<div style="font-weight: 500; color: var(--navy-900);">' + UI.escapeHTML(item.oppositeParty || 'Opposite Party') + '</div>' +
              (item.oppositeCounsel ? '<div style="font-size: 0.75rem; color: var(--text-muted);">Adv. ' + UI.escapeHTML(item.oppositeCounsel) + '</div>' : '') +
            '</td>' +
            '<td>' +
              '<span class="badge badge-neutral" style="font-weight: 600;">' + UI.escapeHTML(item.currentStage || item.purpose || 'Hearing') + '</span>' +
              (item.benchNotes ? '<div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 2px;">' + UI.escapeHTML(item.benchNotes) + '</div>' : '') +
            '</td>' +
            '<td>' +
              '<span class="causelist-time-badge">' +
                '<span class="material-symbols-outlined">schedule</span>' +
                '<span>' + UI.escapeHTML(item.time || '10:00 AM') + '</span>' +
              '</span>' +
            '</td>' +
            '<td style="text-align: right;">' +
              '<button type="button" class="btn btn-sm btn-outline btn-cause-details" data-id="' + (item.id || item._id) + '" style="padding: 4px 8px;" title="View 17 Practice Fields & Directions">' +
                '<span class="material-symbols-outlined" style="font-size: 16px;">visibility</span>' +
              '</button>' +
              (caseId ? '<a href="/cases.html?caseId=' + caseId + '" class="btn btn-sm btn-primary" style="padding: 4px 8px; margin-left: 4px;" title="View in Case Portfolio">' +
                '<span class="material-symbols-outlined" style="font-size: 16px;">gavel</span>' +
              '</a>' : '') +
            '</td>' +
          '</tr>';
      });

      html +=
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    });

    // Practice Tasks & Chamber Reminders Section (if any on this date)
    if (otherEvents.length > 0) {
      html +=
        '<div class="card" style="margin-top: 1.5rem; border: 1px solid var(--border-light); border-radius: 10px; padding: 1.5rem; background: #FFFFFF;">' +
          '<h3 style="font-family: var(--font-headline); font-size: 1.125rem; color: var(--navy-900); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">' +
            '<span class="material-symbols-outlined" style="color: #059669;">checklist</span>' +
            '<span>Chamber Tasks &amp; Procedural Reminders for Today</span>' +
          '</h3>' +
          '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';

      otherEvents.forEach(function(o) {
        var normType = (o.type || 'task').toLowerCase();
        var badgeClass = normType === 'task' ? 'badge-success' : 'badge-warning';
        html +=
          '<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--surface-low); border-radius: 6px; border: 1px solid var(--border-light);">' +
            '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
              '<span class="badge ' + badgeClass + '">' + (normType === 'task' ? 'Practice Task' : 'Chamber Reminder') + '</span>' +
              '<strong style="color: var(--navy-900); font-size: 0.875rem;">' + UI.escapeHTML(o.title) + '</strong>' +
              (o.caseNumber ? '<span style="color: var(--text-muted); font-size: 0.75rem;">[' + UI.escapeHTML(o.caseNumber) + ']</span>' : '') +
            '</div>' +
            '<button type="button" class="btn btn-sm btn-outline btn-cause-details" data-id="' + (o.id || o._id) + '">Details</button>' +
          '</div>';
      });

      html +=
          '</div>' +
        '</div>';
    }

    container.innerHTML = html;
    attachCauseListListeners();
  }

  function attachCauseListListeners() {
    function clearSearchAction() {
      var searchInput = document.getElementById('calSearchInput');
      if (searchInput) searchInput.value = '';
      filters.search = '';
      updateViewDisplay();
    }

    var clearSearchBtn = document.getElementById('calClearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearchAction);

    var clearSearchBtnEmpty = document.getElementById('calClearSearchBtnEmpty');
    if (clearSearchBtnEmpty) clearSearchBtnEmpty.addEventListener('click', clearSearchAction);

    var datePicker = document.getElementById('causeListDatePicker');
    if (datePicker) {
      datePicker.addEventListener('change', function() {
        selectedDateStr = this.value;
        currentDate = new Date(this.value + 'T00:00:00');
        updateViewDisplay();
      });
    }

    var printTrigger = document.getElementById('causeListPrintTrigger');
    if (printTrigger) {
      printTrigger.addEventListener('click', function() {
        window.print();
      });
    }

    var detailBtns = document.querySelectorAll('.btn-cause-details');
    detailBtns.forEach(function(b) {
      b.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        var found = allEvents.find(function(ev) { return String(ev.id || ev._id) === String(id); });
        if (found) openEventModal(found);
      });
    });
  }

  // -------------------------------------------------------------
  // 6. View 3: Upcoming Agenda Renderer
  // -------------------------------------------------------------
  function renderAgenda() {
    var container = document.getElementById('agendaContent');
    var filtered = getFilteredEvents();

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="card" style="text-align: center; padding: 4rem 2rem; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 10px;">' +
          '<div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(10,17,40,0.06); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">' +
            '<span class="material-symbols-outlined" style="font-size: 32px; color: var(--navy-900);">calendar_today</span>' +
          '</div>' +
          '<h3 style="font-family: var(--font-headline); font-size: 1.375rem; color: var(--navy-900); margin-bottom: 0.5rem;">No Upcoming Court Appearances</h3>' +
          '<p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem; font-size: 0.875rem;">' +
            'No matching hearings or tasks found for the current filters.' +
          '</p>' +
        '</div>';
      return;
    }

    // Group events by dateKey
    var dateGroups = {};
    filtered.forEach(function(ev) {
      var dk = getDateKey(ev);
      if (!dateGroups[dk]) dateGroups[dk] = [];
      dateGroups[dk].push(ev);
    });

    var sortedKeys = Object.keys(dateGroups).sort();
    var html = '';

    sortedKeys.forEach(function(dk) {
      var evList = dateGroups[dk];
      var d = new Date(dk + 'T00:00:00');
      var dayTitle = d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      html +=
        '<div class="agenda-day-card">' +
          '<div class="agenda-day-header">' +
            '<div class="agenda-day-title">' + dayTitle + '</div>' +
            '<span class="badge badge-primary">' + evList.length + ' listing' + (evList.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="agenda-items-list">';

      evList.forEach(function(ev) {
        var normType = (ev.type || 'hearing').toLowerCase();
        var caseId = ev.caseId ? (ev.caseId._id || ev.caseId) : null;
        html +=
          '<div class="agenda-item-row" data-id="' + (ev.id || ev._id) + '">' +
            '<div class="agenda-item-time">' +
              '<span>' + UI.escapeHTML(ev.time || '10:00 AM') + '</span>' +
              '<span class="badge badge-' + (normType === 'hearing' ? 'neutral' : (normType === 'task' ? 'success' : 'warning')) + '" style="font-size: 0.6875rem; text-transform: uppercase;">' + normType + '</span>' +
            '</div>' +
            '<div class="agenda-item-body">' +
              '<div style="font-family: var(--font-headline); font-size: 1.0625rem; font-weight: 700; color: var(--navy-900);">' + UI.escapeHTML(ev.caseTitle || ev.title) + '</div>' +
              '<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 4px; font-size: 0.8125rem; color: var(--text-muted);">' +
                (ev.caseNumber ? '<span>Petition: <strong style="color: var(--navy-900);">' + UI.escapeHTML(ev.caseNumber) + '</strong></span>' : '') +
                (ev.court ? '<span>Court: <strong style="color: var(--navy-900);">' + UI.escapeHTML(ev.court) + '</strong></span>' : '') +
                (ev.clientRepresentation ? '<span>Appearing For: <strong style="color: var(--gold-700);">' + UI.escapeHTML(ev.clientRepresentation) + '</strong></span>' : '') +
              '</div>' +
              (ev.caseSynopsis ? '<p style="margin: 6px 0 0; font-size: 0.75rem; color: var(--text-muted); font-style: italic;">' + UI.escapeHTML(ev.caseSynopsis.substring(0, 120)) + '...</p>' : '') +
            '</div>' +
            '<div style="display: flex; gap: 0.5rem; align-items: center;">' +
              (caseId ? '<a href="/cases.html?caseId=' + caseId + '" class="btn btn-sm btn-outline" style="padding: 4px 8px;" title="View in Case Portfolio"><span class="material-symbols-outlined" style="font-size: 16px;">gavel</span></a>' : '') +
              '<button type="button" class="btn btn-sm btn-primary btn-agenda-modal" data-id="' + (ev.id || ev._id) + '">Details</button>' +
            '</div>' +
          '</div>';
      });

      html +=
          '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-agenda-modal').forEach(function(b) {
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        var found = allEvents.find(function(ev) { return String(ev.id || ev._id) === String(id); });
        if (found) openEventModal(found);
      });
    });

    container.querySelectorAll('.agenda-item-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        var found = allEvents.find(function(ev) { return String(ev.id || ev._id) === String(id); });
        if (found) openEventModal(found);
      });
    });
  }

  // -------------------------------------------------------------
  // 7. Comprehensive 17-Field Legal Docket Modal
  // -------------------------------------------------------------
  window.openEventModal = function(ev) {
    activeModalEvent = ev;
    var normType = (ev.type || 'hearing').toLowerCase();
    var caseId = ev.caseId ? (ev.caseId._id || ev.caseId) : null;

    // Header & Title
    document.getElementById('calModalTitle').textContent = ev.caseTitle || ev.title || 'Legal Matter';

    // Banner Meta Bar (Case No, CNR, Status, Type)
    var metaBar = document.getElementById('calModalMetaBar');
    var metaHtml =
      '<span class="badge badge-primary" style="font-weight: 700; text-transform: uppercase;">' + (normType === 'hearing' ? 'Court Hearing' : (normType === 'task' ? 'Practice Task' : 'Chamber Reminder')) + '</span>' +
      '<span class="badge badge-neutral" style="text-transform: uppercase;">' + UI.escapeHTML(ev.caseStatus || ev.status || 'Active') + '</span>' +
      (ev.caseNumber ? '<span style="font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 600; color: #FFFFFF; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px;">' + UI.escapeHTML(ev.caseNumber) + '</span>' : '');

    if (ev.cnrNumber) {
      metaHtml +=
        '<div class="causelist-cnr-pill" style="background: rgba(255,255,255,0.15); color: #FFFFFF; border-color: rgba(255,255,255,0.3);" onclick="copyCNR(event, \'' + ev.cnrNumber + '\')" title="Click to Copy 16-Digit CNR">' +
          '<span class="material-symbols-outlined" style="font-size: 13px;">content_copy</span>' +
          '<span>CNR: ' + UI.escapeHTML(ev.cnrNumber) + '</span>' +
        '</div>';
    }

    metaBar.innerHTML = metaHtml;

    // Section 1: Court Particulars
    document.getElementById('calModalCourt').textContent = ev.court || 'District Court';
    document.getElementById('calModalCourtroom').textContent = ev.courtroom || 'Bench / Chamber';
    document.getElementById('calModalJudge').textContent = ev.judge || "Hon'ble Presiding Bench";
    document.getElementById('calModalCaseType').textContent = ev.caseType || 'Civil Suit';

    // Section 2: Parties & Representation
    document.getElementById('calModalClient').textContent = ev.clientName || 'Chamber Client';
    document.getElementById('calModalRepresenting').textContent = ev.clientRepresentation || ev.appearingFor || 'Plaintiff / Counsel';
    document.getElementById('calModalOppParty').textContent = ev.oppositeParty || 'Opposite Party';
    document.getElementById('calModalOppCounsel').textContent = ev.oppositeCounsel ? 'Adv. ' + ev.oppositeCounsel : 'Not Disclosed / In Person';

    // Section 3: Schedule & Agreed Fee
    var lastDateFormatted = ev.lastDate ? formatDDMMYYYY(ev.lastDate) : 'Initial Listing';
    var curDateFormatted = formatDDMMYYYY(ev.currentDate || ev.date || ev.start) + ' at ' + (ev.time || '10:00 AM');
    document.getElementById('calModalLastHearing').textContent = lastDateFormatted;
    document.getElementById('calModalCurrentHearing').textContent = curDateFormatted;
    document.getElementById('calModalFee').textContent = formatINR(ev.agreedFee || 0);

    // Section 4: Matter Synopsis / Chamber Notes
    var synopsisText = ev.caseSynopsis || ev.benchNotes || ev.remarks || ev.description || 'No chamber notes recorded.';
    document.getElementById('calModalSynopsis').textContent = synopsisText;

    // Section 5: Auto-Update Hearing Schedule Form
    var rescheduleSec = document.getElementById('calModalRescheduleSection');
    if (normType === 'hearing') {
      rescheduleSec.style.display = 'block';
      document.getElementById('calFormNextDate').value = ev.nextDate ? dateToStr(new Date(ev.nextDate)) : '';
      document.getElementById('calFormNextTime').value = ev.time || '10:00 AM';
      document.getElementById('calFormNextStage').value = ev.currentStage || 'Final Arguments';
      document.getElementById('calFormHearingStatus').value = ev.status || 'Completed';
      document.getElementById('calFormRemarks').value = ev.benchNotes || ev.remarks || '';
    } else {
      rescheduleSec.style.display = 'none';
    }

    // Modal Footer Links
    var portfolioLink = document.getElementById('calModalCasePortfolioLink');
    var docketLink = document.getElementById('calModalCaseDocketLink');

    if (caseId) {
      portfolioLink.style.display = 'inline-flex';
      portfolioLink.href = '/cases.html?caseId=' + caseId;
      docketLink.style.display = 'inline-flex';
      docketLink.href = '/case-details.html?id=' + caseId;
    } else {
      portfolioLink.style.display = 'none';
      docketLink.style.display = 'none';
    }

    UI.openModal('calendarEventModal');
  };

  function initRescheduleForm() {
    var form = document.getElementById('calRescheduleForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!activeModalEvent) return;

      var btn = document.getElementById('calSaveRescheduleBtn');
      btn.disabled = true;
      btn.innerHTML = '<span>Saving...</span>';

      var nextDate = document.getElementById('calFormNextDate').value;
      var nextTime = document.getElementById('calFormNextTime').value.trim();
      var nextStage = document.getElementById('calFormNextStage').value;
      var hearingStatus = document.getElementById('calFormHearingStatus').value;
      var remarks = document.getElementById('calFormRemarks').value.trim();

      var payload = {
        status: hearingStatus,
      };

      if (nextDate) payload.nextDate = nextDate;
      if (nextTime) payload.time = nextTime;
      if (nextStage) payload.nextStage = nextStage;
      if (remarks) {
        payload.benchNotes = remarks;
        payload.remarks = remarks;
      }

      try {
        await API.hearings.update(activeModalEvent.id || activeModalEvent._id, payload);
        UI.showToast('Court directions recorded & case advanced!', 'success');
        UI.closeModal('calendarEventModal');
        await loadCalendarData();
      } catch (err) {
        UI.showToast(err.message || 'Failed to update hearing schedule', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">sync</span><span>Save Court Directions &amp; Advance Case</span>';
      }
    });
  }

  // -------------------------------------------------------------
  // 8. Filters & Search Evaluation
  // -------------------------------------------------------------
  function getFilteredEvents() {
    return allEvents.filter(function(ev) {
      var normType = (ev.type || 'hearing').toLowerCase();

      // Category filter
      if (normType === 'hearing' && !filters.showHearings) return false;
      if (normType === 'task' && !filters.showTasks) return false;
      if (normType === 'reminder' && !filters.showReminders) return false;

      // Court filter
      if (filters.court) {
        var evCourt = (ev.court || '').toLowerCase();
        if (evCourt.indexOf(filters.court.toLowerCase()) === -1) return false;
      }

      // Case Type filter
      if (filters.caseType) {
        var evType = (ev.caseType || '').toLowerCase();
        if (evType.indexOf(filters.caseType.toLowerCase()) === -1) return false;
      }

      // Search keyword filter
      if (filters.search) {
        var s = filters.search;
        var blob = [
          ev.caseTitle || '',
          ev.title || '',
          ev.caseNumber || '',
          ev.cnrNumber || '',
          ev.clientName || '',
          ev.oppositeParty || '',
          ev.oppositeCounsel || '',
          ev.court || '',
          ev.courtroom || '',
          ev.currentStage || '',
        ].join(' ').toLowerCase();

        if (blob.indexOf(s) === -1) return false;
      }

      return true;
    });
  }

  // -------------------------------------------------------------
  // 9. Helpers & Utility Functions
  // -------------------------------------------------------------
  function getDateKey(ev) {
    if (ev.dateKey) return ev.dateKey;
    var raw = ev.currentDate || ev.date || ev.start || ev.reminderDate || ev.dueDate;
    if (!raw) return '';
    if (typeof raw === 'string') {
      var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[0];
    }
    var d = new Date(raw);
    if (!isNaN(d.getTime())) {
      var iso = d.toISOString();
      var m2 = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m2) return m2[0];
    }
    return String(raw).split('T')[0];
  }

  function dateToStr(d) {
    if (!d) return '';
    if (typeof d === 'string') {
      var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[0];
    }
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    var y = dt.getFullYear();
    var m2 = String(dt.getMonth() + 1).padStart(2, '0');
    var day = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m2 + '-' + day;
  }

  function formatDDMMYYYY(val) {
    if (!val) return 'dd-mm-yyyy';
    var iso = '';
    if (typeof val === 'string') {
      var m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) iso = m[0];
    }
    if (!iso) {
      var d = new Date(val);
      if (!isNaN(d.getTime())) {
        var isoMatch = d.toISOString().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) iso = isoMatch[0];
      }
    }
    if (iso) {
      var parts = iso.split('-');
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return 'dd-mm-yyyy';
  }

  function formatINR(amount) {
    var num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN');
  }

  function getCourtAcronym(courtStr) {
    if (!courtStr) return '';
    var c = courtStr.toLowerCase();
    if (c.includes('supreme court')) return 'SC';
    if (c.includes('high court')) return 'HC';
    if (c.includes('nclt')) return 'NCLT';
    if (c.includes('drt')) return 'DRT';
    if (c.includes('tis hazari')) return 'THC';
    if (c.includes('saket')) return 'SAKET';
    if (c.includes('rohini')) return 'ROHINI';
    if (c.includes('patiala house')) return 'PHC';
    if (c.includes('karkardooma')) return 'KKD';
    if (c.includes('dwarka')) return 'DWARKA';
    return '';
  }

  window.copyCNR = function(e, cnr) {
    if (e) e.stopPropagation();
    if (!cnr) return;
    navigator.clipboard.writeText(cnr).then(function() {
      UI.showToast('16-Digit CNR Copied: ' + cnr, 'success');
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = cnr;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      UI.showToast('16-Digit CNR Copied: ' + cnr, 'success');
    });
  };

})();
