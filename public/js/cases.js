/**
 * Advocate DigiDiary — Case Portfolio Management
 * Complete Rebuild with 17 Core Legal Practice Fields, Cards & Table Views,
 * Strict dd-mm-yyyy Formatting, and Court Calendar Integration.
 */

let currentPage = 1;
const pageLimit = 18;
let clientsList = [];
let currentCasesData = [];
let currentView = localStorage.getItem('casePortfolioView') || 'cards';

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  // Load clients for form dropdown
  await loadClients();

  // Setup UI event listeners
  setupEventListeners();

  // Apply initial view mode
  applyViewMode(currentView);

  // Load initial cases list
  await fetchCases();

  // Handle URL query parameters (e.g., from Court Calendar or Quick Add)
  handleUrlParams();
});

/**
 * Strict dd-mm-yyyy date formatter (Timezone-immune)
 * Example: 2026-09-21 -> "21-09-2026"
 */
function toIsoDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const iso = d.toISOString();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

function formatDDMMYYYY(dateInput) {
  if (!dateInput) return '—';
  const iso = toIsoDateStr(dateInput);
  if (iso) {
    const parts = iso.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return '—';
}

/**
 * Load clients roster for selection in Register/Edit modal
 */
async function loadClients() {
  try {
    const res = await API.clients.getAll({ limit: 200 });
    if (res.success && res.data) {
      clientsList = res.data;
      const select = document.getElementById('caseClientSelect');
      select.innerHTML = '<option value="">Select client...</option>' +
        clientsList.map(c => `<option value="${c._id}">${UI.escapeHTML(c.name)} (${UI.escapeHTML(c.clientType || 'Client')})</option>`).join('');
    }
  } catch (err) {
    console.error('[Case Portfolio] Failed to load clients:', err);
  }
}

/**
 * Fetch cases from backend with search, status, and matter type filters
 */
async function fetchCases() {
  const grid = document.getElementById('caseGridBody');
  const tbody = document.getElementById('caseTableBody');

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
      <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; animation: spin 1s infinite linear; display: block; margin: 0 auto 0.5rem;">refresh</span>
      Loading cases portfolio...
    </div>
  `;
  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        Loading cases portfolio...
      </td>
    </tr>
  `;

  const search = document.getElementById('caseSearchInput').value.trim();
  const status = document.getElementById('caseStatusFilter').value;
  const caseType = document.getElementById('caseTypeFilter').value;

  const params = {
    page: currentPage,
    limit: pageLimit,
    sort: 'currentHearingDate',
    order: 'asc'
  };

  if (search) params.search = search;
  if (status) params.status = status;
  if (caseType) params.caseType = caseType;

  try {
    const res = await API.cases.getAll(params);
    if (res.success && res.data) {
      currentCasesData = res.data;
      renderPortfolio(res.data);
      renderPagination(res.pagination);
      updateMetrics(res.data, res.pagination ? res.pagination.total : res.data.length);
    } else {
      renderEmptyState();
    }
  } catch (err) {
    console.error('[Case Portfolio] Fetch error:', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--danger);">
        Error loading cases: ${UI.escapeHTML(err.message)}
      </div>
    `;
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--danger);">
          Error loading cases: ${UI.escapeHTML(err.message)}
        </td>
      </tr>
    `;
  }
}

/**
 * Update summary metric tiles
 */
function updateMetrics(cases, totalCount) {
  const totalCasesEl = document.getElementById('metricTotalCases');
  const activeCasesEl = document.getElementById('metricActiveCases');
  const upcomingEl = document.getElementById('metricUpcomingHearings');
  const totalFeesEl = document.getElementById('metricTotalFees');

  if (totalCasesEl) totalCasesEl.innerText = totalCount || cases.length;

  const activeCount = cases.filter(c => !['Disposed', 'Closed'].includes(c.status)).length;
  if (activeCasesEl) activeCasesEl.innerText = activeCount;

  const scheduledCount = cases.filter(c => c.currentHearingDate).length;
  if (upcomingEl) upcomingEl.innerText = scheduledCount;

  const totalFees = cases.reduce((sum, c) => sum + (Number(c.agreedFee) || Number(c.totalAgreedFee) || 0), 0);
  if (totalFeesEl) totalFeesEl.innerText = UI.formatINR(totalFees);
}

/**
 * Main render function delegating to Cards View or Table View
 */
function renderPortfolio(cases) {
  if (!cases || cases.length === 0) {
    renderEmptyState();
    return;
  }

  renderCardsView(cases);
  renderTableView(cases);
}

function renderEmptyState() {
  const emptyHtml = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: #FFFFFF; border: 1px dashed var(--border-light); border-radius: var(--radius-lg);">
      <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--gold-500); opacity: 0.8; margin-bottom: 0.75rem; display: block;">gavel</span>
      <h3 style="font-family: var(--font-headline); font-size: 1.25rem; color: var(--navy-900); margin-bottom: 0.5rem;">No Legal Briefs Found</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; max-width: 440px; margin: 0 auto 1.25rem;">
        No legal cases match your current filters. Register a new court matter or clear the search filters to view your chamber's dockets.
      </p>
      <button class="btn btn-sm btn-primary" onclick="openRegisterCaseModal()">
        <span class="material-symbols-outlined icon-sm">add</span>
        <span>Register New Matter</span>
      </button>
    </div>
  `;
  document.getElementById('caseGridBody').innerHTML = emptyHtml;
  document.getElementById('caseTableBody').innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">
        No legal cases match the selected filters.
      </td>
    </tr>
  `;
}

/**
 * Render Cards View with all 17 Core Details
 */
function renderCardsView(cases) {
  const grid = document.getElementById('caseGridBody');

  grid.innerHTML = cases.map(c => {
    const caseId = c._id;
    const title = c.title || 'General Legal Matter';
    const caseNumber = c.caseNumber || 'MATTER-000';
    const cnr = c.cnrNumber ? c.cnrNumber.toUpperCase() : '';
    const court = c.court || 'District Court';
    const bench = c.courtroom || c.courtRoom || 'Regular Bench';
    const matterType = c.caseType || 'Civil Suit';
    const clientName = c.clientId ? (c.clientId.name || 'Client') : 'General Client';
    const representing = c.clientRepresentation || c.partyRole || 'Plaintiff';
    const oppositeParty = c.oppositeParty || c.opponentParty || 'Opposite Party';
    const oppositeCounsel = c.oppositeCounsel || c.opponentAdvocate || 'Opposite Counsel';
    const stage = c.currentStage || c.stage || 'Preliminary Hearing';
    const status = c.status || 'Active';
    const agreedFee = Number(c.agreedFee !== undefined ? c.agreedFee : (c.totalAgreedFee || 0));
    const lastDate = formatDDMMYYYY(c.lastHearingDate);
    const currentDate = formatDDMMYYYY(c.currentHearingDate);
    const hearingTime = c.hearingTime || '10:00 AM';
    const synopsis = c.description || 'No chamber notes recorded for this matter.';

    const calIso = toIsoDateStr(c.currentHearingDate);
    const calLink = calIso ? `/calendar.html?date=${calIso}` : '/calendar.html';

    return `
      <div class="case-card" id="case-card-${caseId}" data-case-id="${caseId}">
        <!-- Header: Title, Petition No, Type & Status -->
        <div class="case-card__header">
          <div style="flex: 1; min-width: 0;">
            <a href="/case-details.html?id=${caseId}" class="case-card__title" title="Open Case Docket">
              ${UI.escapeHTML(title)}
            </a>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
              <span class="case-card__case-num">${UI.escapeHTML(caseNumber)}</span>
              <span class="badge badge-neutral" style="font-size: 0.6875rem;">${UI.escapeHTML(matterType)}</span>
              ${UI.getStatusBadge(status)}
            </div>
          </div>
        </div>

        <!-- 16-Digit CNR Number Bar with 1-Click Copy -->
        <div class="case-card__cnr-row">
          <div>
            <span style="color: var(--text-muted); font-size: 0.6875rem; text-transform: uppercase;">CNR (16-Digit):</span>
            <span class="case-card__cnr-code">${cnr ? UI.escapeHTML(cnr) : '<span style="color: #94A3B8; font-style: italic;">Not Assigned</span>'}</span>
          </div>
          ${cnr ? `
            <button type="button" class="case-card__copy-btn" onclick="copyCNR('${UI.escapeHTML(cnr)}', this)" title="Copy 16-Digit CNR">
              <span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span>
              <span>Copy</span>
            </button>
          ` : ''}
        </div>

        <!-- Meta Grid: Court, Bench, Client, Representing, Opponents, Stage -->
        <div class="case-card__meta-grid">
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Court / Forum</span>
            <span class="case-card__meta-val">${UI.escapeHTML(court)}</span>
          </div>
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Court Room / Bench</span>
            <span class="case-card__meta-val">${UI.escapeHTML(bench)}</span>
          </div>
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Client</span>
            <span class="case-card__meta-val" style="color: var(--navy-900); font-weight: 700;">${UI.escapeHTML(clientName)}</span>
          </div>
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Representing</span>
            <span class="case-card__meta-val" style="color: var(--gold-800); font-weight: 700;">${UI.escapeHTML(representing)}</span>
          </div>
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Opposite Party</span>
            <span class="case-card__meta-val">${UI.escapeHTML(oppositeParty)}</span>
          </div>
          <div class="case-card__meta-item">
            <span class="case-card__meta-label">Opposite Counsel</span>
            <span class="case-card__meta-val">${UI.escapeHTML(oppositeCounsel)}</span>
          </div>
          <div class="case-card__meta-item" style="grid-column: span 2;">
            <span class="case-card__meta-label">Current Stage</span>
            <span class="case-card__meta-val" style="color: var(--navy-900);">${UI.escapeHTML(stage)}</span>
          </div>
        </div>

        <!-- Hearing Schedule Box (dd-mm-yyyy) with Time & Calendar Connection -->
        <div class="case-card__hearing-box">
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <div class="case-card__hearing-col">
              <span class="case-card__hearing-tag">
                <span class="material-symbols-outlined" style="font-size: 13px;">history</span>
                Last Hearing Date
              </span>
              <span class="case-card__hearing-date" style="font-size: 0.8125rem; color: var(--text-muted);">
                ${lastDate}
              </span>
            </div>

            <div class="case-card__hearing-col" style="border-left: 2px solid rgba(197, 155, 39, 0.25); padding-left: 0.75rem;">
              <span class="case-card__hearing-tag" style="color: var(--gold-800);">
                <span class="material-symbols-outlined" style="font-size: 13px;">event</span>
                Current Hearing Date
              </span>
              <div style="display: flex; align-items: baseline; gap: 6px;">
                <span class="case-card__hearing-date">${currentDate}</span>
                <span class="case-card__hearing-time"><span style="color: var(--text-muted); font-size: 0.6875rem;">Time:</span> ${UI.escapeHTML(hearingTime)}</span>
              </div>
            </div>
          </div>

          <a href="${calLink}" class="case-card__cal-jump-btn" title="View Schedule on Court Calendar">
            <span class="material-symbols-outlined" style="font-size: 15px;">calendar_month</span>
            <span>Calendar</span>
          </a>
        </div>

        <!-- Matter Synopsis / Chamber Notes -->
        <div class="case-card__synopsis" title="${UI.escapeHTML(synopsis)}">
          <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: var(--gold-800); display: block; margin-bottom: 2px;">
            Matter Synopsis / Chamber Notes:
          </span>
          ${UI.escapeHTML(synopsis)}
        </div>

        <!-- Card Footer Actions & Financials -->
        <div class="case-card__footer">
          <div>
            <span style="font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; display: block;">Agreed Professional Fee</span>
            <span class="case-card__fee">${UI.formatINR(agreedFee)}</span>
          </div>

          <div class="case-card__action-btns">
            <a href="/case-details.html?id=${caseId}" class="btn btn-sm btn-ghost" title="Open Full Case Docket" style="padding: 4px 8px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">visibility</span>
            </a>
            <button class="btn btn-sm btn-ghost" title="Edit Case Details" onclick="openEditCaseModal('${caseId}')" style="padding: 4px 8px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete Case" onclick="deleteCase('${caseId}', '${UI.escapeHTML(caseNumber)}')" style="padding: 4px 8px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Table View with all 17 Core Details
 */
function renderTableView(cases) {
  const tbody = document.getElementById('caseTableBody');

  tbody.innerHTML = cases.map(c => {
    const caseId = c._id;
    const title = c.title || 'General Legal Matter';
    const caseNumber = c.caseNumber || 'MATTER-000';
    const cnr = c.cnrNumber ? c.cnrNumber.toUpperCase() : '—';
    const court = c.court || 'District Court';
    const bench = c.courtroom || c.courtRoom || 'Bench';
    const matterType = c.caseType || 'Civil Suit';
    const clientName = c.clientId ? (c.clientId.name || 'Client') : 'Client';
    const representing = c.clientRepresentation || c.partyRole || 'Plaintiff';
    const oppositeParty = c.oppositeParty || c.opponentParty || 'Opponent';
    const oppositeCounsel = c.oppositeCounsel || c.opponentAdvocate || 'Counsel';
    const stage = c.currentStage || c.stage || 'Hearing';
    const status = c.status || 'Active';
    const agreedFee = Number(c.agreedFee !== undefined ? c.agreedFee : (c.totalAgreedFee || 0));
    const lastDate = formatDDMMYYYY(c.lastHearingDate);
    const currentDate = formatDDMMYYYY(c.currentHearingDate);
    const hearingTime = c.hearingTime || '10:00 AM';

    const calIso = toIsoDateStr(c.currentHearingDate);
    const calLink = calIso ? `/calendar.html?date=${calIso}` : '/calendar.html';

    return `
      <tr id="case-row-${caseId}">
        <td>
          <a href="/case-details.html?id=${caseId}" style="font-weight: 700; color: var(--navy-900); text-decoration: none;">
            ${UI.escapeHTML(title)}
          </a>
          <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 2px;">
            Type: <span class="badge badge-neutral" style="font-size: 0.625rem;">${UI.escapeHTML(matterType)}</span>
          </div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.8125rem; color: var(--navy-900);">
            ${UI.escapeHTML(caseNumber)}
          </div>
          <div style="font-family: var(--font-mono); font-size: 0.6875rem; color: var(--text-muted);">
            CNR: ${UI.escapeHTML(cnr)}
          </div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 600;">${UI.escapeHTML(court)}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">${UI.escapeHTML(bench)}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">${UI.escapeHTML(clientName)}</div>
          <div style="font-size: 0.6875rem; color: var(--gold-800); font-weight: 600;">For: ${UI.escapeHTML(representing)}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem;">${UI.escapeHTML(oppositeParty)}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">Adv: ${UI.escapeHTML(oppositeCounsel)}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 500;">${UI.escapeHTML(stage)}</div>
          <div style="margin-top: 2px;">${UI.getStatusBadge(status)}</div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--navy-900); font-family: var(--font-mono);">
            Curr: ${currentDate}
          </div>
          <div style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono);">
            Last: ${lastDate}
          </div>
          <div style="font-size: 0.6875rem; color: var(--gold-800); font-weight: 600;">
            Time: ${UI.escapeHTML(hearingTime)}
          </div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--navy-900);">
            ${UI.formatINR(agreedFee)}
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <a href="${calLink}" class="btn btn-sm btn-ghost" title="View in Court Calendar" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-700);">calendar_month</span>
            </a>
            <a href="/case-details.html?id=${caseId}" class="btn btn-sm btn-ghost" title="Open Case Docket" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">visibility</span>
            </a>
            <button class="btn btn-sm btn-ghost" title="Edit Case" onclick="openEditCaseModal('${caseId}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete Case" onclick="deleteCase('${caseId}', '${UI.escapeHTML(caseNumber)}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Copy 16-Digit CNR Number to clipboard with visual feedback
 */
window.copyCNR = function(cnr, btnElement) {
  if (!cnr) return;
  navigator.clipboard.writeText(cnr).then(() => {
    UI.showToast(`CNR copied: ${cnr}`, 'info');
    if (btnElement) {
      const originalHtml = btnElement.innerHTML;
      btnElement.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: var(--success);">check</span><span>Copied</span>';
      setTimeout(() => {
        btnElement.innerHTML = originalHtml;
      }, 1800);
    }
  }).catch(() => {
    UI.showToast(`CNR: ${cnr}`, 'info');
  });
};

/**
 * Switch view mode between Cards Grid and Data Table
 */
function applyViewMode(mode) {
  currentView = mode;
  localStorage.setItem('casePortfolioView', mode);

  const cardsContainer = document.getElementById('portfolioCardsContainer');
  const tableContainer = document.getElementById('portfolioTableContainer');
  const cardsBtn = document.getElementById('viewCardsBtn');
  const tableBtn = document.getElementById('viewTableBtn');

  if (mode === 'table') {
    cardsContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    cardsBtn.classList.remove('active');
    tableBtn.classList.add('active');
  } else {
    cardsContainer.style.display = 'block';
    tableContainer.style.display = 'none';
    cardsBtn.classList.add('active');
    tableBtn.classList.remove('active');
  }
}

/**
 * Handle URL query params (e.g., arrival from Court Calendar or global search)
 */
function handleUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('caseId');
  const action = urlParams.get('action');

  if (action === 'new') {
    openRegisterCaseModal();
    return;
  }

  if (caseId) {
    setTimeout(() => {
      const card = document.getElementById(`case-card-${caseId}`);
      const row = document.getElementById(`case-row-${caseId}`);
      const target = card || row;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('spotlight');
        UI.showToast('Spotlighting matter from Court Calendar', 'info');
      }
    }, 400);
  }
}

function renderPagination(p) {
  if (!p) return;
  const info = document.getElementById('paginationInfo');
  const prev = document.getElementById('prevPageBtn');
  const next = document.getElementById('nextPageBtn');

  const start = p.total === 0 ? 0 : (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);
  info.innerText = `Showing ${start}-${end} of ${p.total} matters (Page ${p.page} of ${p.totalPages || 1})`;

  prev.disabled = p.page <= 1;
  next.disabled = p.page >= p.totalPages;
}

function setupEventListeners() {
  // View toggle
  document.getElementById('viewCardsBtn').addEventListener('click', () => applyViewMode('cards'));
  document.getElementById('viewTableBtn').addEventListener('click', () => applyViewMode('table'));

  // Pagination
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchCases();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentPage++;
    fetchCases();
  });

  // Filter actions
  document.getElementById('applyFiltersBtn').addEventListener('click', () => {
    currentPage = 1;
    fetchCases();
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('caseSearchInput').value = '';
    document.getElementById('caseStatusFilter').value = '';
    document.getElementById('caseTypeFilter').value = '';
    currentPage = 1;
    fetchCases();
  });

  // Debounced live typing search
  let caseSearchDebounce = null;
  const searchInputEl = document.getElementById('caseSearchInput');
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      clearTimeout(caseSearchDebounce);
      caseSearchDebounce = setTimeout(() => {
        currentPage = 1;
        fetchCases();
      }, 250);
    });

    searchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(caseSearchDebounce);
        currentPage = 1;
        fetchCases();
      }
    });
  }

  // Instant filter on dropdown selection change
  document.getElementById('caseStatusFilter').addEventListener('change', () => {
    currentPage = 1;
    fetchCases();
  });

  document.getElementById('caseTypeFilter').addEventListener('change', () => {
    currentPage = 1;
    fetchCases();
  });

  // Modal open button
  document.getElementById('openAddCaseBtn').addEventListener('click', openRegisterCaseModal);

  // Form Submit Handler (covers all 17 fields)
  document.getElementById('caseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveCaseSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>Saving Matter...</span>';

    const editId = document.getElementById('editCaseId').value;
    const rawClientId = document.getElementById('caseClientSelect').value;

    const payload = {
      title: document.getElementById('caseTitleInput').value.trim() || 'General Legal Matter',
      caseNumber: document.getElementById('caseNumberInput').value.trim() || undefined,
      cnrNumber: document.getElementById('caseCnrInput').value.trim().toUpperCase() || undefined,
      court: document.getElementById('caseCourtInput').value.trim() || 'District Court',
      courtroom: document.getElementById('caseCourtRoomInput').value.trim() || undefined,
      courtRoom: document.getElementById('caseCourtRoomInput').value.trim() || undefined,
      caseType: document.getElementById('caseTypeSelect').value || 'Civil Suit',
      clientId: rawClientId && rawClientId.trim() ? rawClientId.trim() : undefined,
      clientRepresentation: document.getElementById('casePartyRoleSelect').value || 'Plaintiff',
      partyRole: document.getElementById('casePartyRoleSelect').value || 'Plaintiff',
      oppositeParty: document.getElementById('caseOpponent').value.trim() || undefined,
      opponentParty: document.getElementById('caseOpponent').value.trim() || undefined,
      oppositeCounsel: document.getElementById('caseOpponentAdvocate').value.trim() || undefined,
      opponentAdvocate: document.getElementById('caseOpponentAdvocate').value.trim() || undefined,
      currentStage: document.getElementById('caseStageInput').value.trim() || 'Preliminary Hearing',
      stage: document.getElementById('caseStageInput').value.trim() || 'Preliminary Hearing',
      status: document.getElementById('caseStatusSelect').value || 'Active',
      agreedFee: Number(document.getElementById('caseAgreedFeeInput').value) || 0,
      totalAgreedFee: Number(document.getElementById('caseAgreedFeeInput').value) || 0,
      lastHearingDate: document.getElementById('caseLastHearingInput').value || undefined,
      currentHearingDate: document.getElementById('caseCurrentHearingInput').value || undefined,
      hearingTime: document.getElementById('caseHearingTimeInput').value.trim() || '10:00 AM',
      time: document.getElementById('caseHearingTimeInput').value.trim() || '10:00 AM',
      description: document.getElementById('caseDescriptionInput').value.trim() || undefined,
    };

    try {
      if (editId) {
        await API.cases.update(editId, payload);
        UI.showToast('Case updated successfully!', 'success');
      } else {
        await API.cases.create(payload);
        UI.showToast('Matter registered successfully in Portfolio!', 'success');
      }
      UI.closeModal('caseModal');
      await fetchCases();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save case', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined icon-sm">save</span><span>Save Matter</span>';
    }
  });
}

/**
 * Open modal to register a brand new matter
 */
window.openRegisterCaseModal = () => {
  document.getElementById('editCaseId').value = '';
  document.getElementById('modalCaseTitleText').innerText = 'Register New Legal Matter';
  document.getElementById('caseForm').reset();
  document.getElementById('caseHearingTimeInput').value = '10:00 AM';
  UI.openModal('caseModal');
};

/**
 * Populate all 17 fields in Edit modal
 */
window.openEditCaseModal = async (id) => {
  try {
    const res = await API.cases.getById(id);
    if (res.success && res.data) {
      const c = res.data.case || res.data;
      document.getElementById('editCaseId').value = c._id;
      document.getElementById('modalCaseTitleText').innerText = `Edit Matter: ${c.caseNumber || 'Brief'}`;

      // 17 Fields mapping
      document.getElementById('caseTitleInput').value = c.title || '';
      document.getElementById('caseNumberInput').value = c.caseNumber || '';
      document.getElementById('caseCnrInput').value = c.cnrNumber || '';
      document.getElementById('caseCourtInput').value = c.court || '';
      document.getElementById('caseCourtRoomInput').value = c.courtroom || c.courtRoom || '';
      document.getElementById('caseTypeSelect').value = c.caseType || 'Civil Suit';
      document.getElementById('caseClientSelect').value = c.clientId ? (c.clientId._id || c.clientId) : '';
      document.getElementById('casePartyRoleSelect').value = c.clientRepresentation || c.partyRole || 'Plaintiff';
      document.getElementById('caseOpponent').value = c.oppositeParty || c.opponentParty || '';
      document.getElementById('caseOpponentAdvocate').value = c.oppositeCounsel || c.opponentAdvocate || '';
      document.getElementById('caseStageInput').value = c.currentStage || c.stage || 'Preliminary Hearing';
      document.getElementById('caseStatusSelect').value = c.status || 'Active';
      document.getElementById('caseAgreedFeeInput').value = c.agreedFee !== undefined ? c.agreedFee : (c.totalAgreedFee || 0);

      // Dates (ISO YYYY-MM-DD for date inputs)
      document.getElementById('caseLastHearingInput').value = toIsoDateStr(c.lastHearingDate);
      document.getElementById('caseCurrentHearingInput').value = toIsoDateStr(c.currentHearingDate);
      document.getElementById('caseHearingTimeInput').value = c.hearingTime || '10:00 AM';
      document.getElementById('caseDescriptionInput').value = c.description || '';

      UI.openModal('caseModal');
    }
  } catch (err) {
    UI.showToast(err.message || 'Could not fetch case details', 'danger');
  }
};

/**
 * Delete a legal matter with confirmation
 */
window.deleteCase = async (id, number) => {
  const confirmed = await UI.confirm({
    title: 'Delete Legal Matter',
    message: `Are you sure you want to permanently delete case "${number}"? This will remove related hearings, deadlines, and chamber records.`,
    confirmText: 'Delete Matter',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await API.cases.delete(id);
    UI.showToast(`Case ${number} deleted.`, 'success');
    await fetchCases();
  } catch (err) {
    UI.showToast(err.message || 'Failed to delete case', 'danger');
  }
};
