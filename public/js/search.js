/**
 * Advocate DigiDiary — Global Ctrl+K Search Modal
 */

function initGlobalSearch() {
  // 1. Create Modal DOM if not present
  let searchModal = document.getElementById('globalSearchModal');
  if (!searchModal) {
    searchModal = document.createElement('div');
    searchModal.id = 'globalSearchModal';
    searchModal.className = 'modal-backdrop';
    searchModal.innerHTML = `
      <div class="modal-dialog" style="max-width: 640px; margin-top: 10vh; max-height: 80vh;">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--outline-variant); display: flex; align-items: center; gap: 12px; background: var(--surface-lowest);">
          <span class="material-symbols-outlined" style="color: var(--outline); font-size: 22px;">search</span>
          <input type="text" id="globalSearchInputField" placeholder="Type a case title, CNR, client name, courtroom, note..." style="flex: 1; border: none; outline: none; font-size: 15px; color: var(--on-surface); background: transparent;" autocomplete="off" />
          <span style="font-family: var(--font-label); font-size: 11px; padding: 2px 6px; background: var(--surface-low); border-radius: var(--radius-sm); border: 1px solid var(--outline-variant); color: var(--on-surface-variant);">ESC</span>
        </div>
        <div id="globalSearchResults" style="flex: 1; overflow-y: auto; padding: 12px 18px; max-height: 480px; min-height: 120px; font-size: 13px;">
          <div style="color: var(--on-surface-variant); text-align: center; padding: 32px 0;">
            Type at least 2 characters to search cases, clients, hearings, notes & ledger across your chamber.
          </div>
        </div>
        <div style="padding: 10px 18px; background: var(--surface-low); border-top: 1px solid var(--outline-variant); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-label); font-size: 11px; color: var(--on-surface-variant);">
          <span>Search scope: <strong>Chamber Vault (Confidential)</strong></span>
          <span>Press <strong>ESC</strong> to dismiss</span>
        </div>
      </div>
    `;
    document.body.appendChild(searchModal);
  }

  const searchInput = document.getElementById('globalSearchInputField');
  const resultsContainer = document.getElementById('globalSearchResults');

  function openSearch() {
    searchModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 50);
  }

  function closeSearch() {
    searchModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Keyboard shortcut listener: Ctrl+K / Cmd+K / Esc
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchModal.classList.contains('active')) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if (e.key === 'Escape' && searchModal.classList.contains('active')) {
      closeSearch();
    }
  });

  // Backdrop click to dismiss
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      closeSearch();
    }
  });

  // Top header search click trigger across all pages
  const triggers = document.querySelectorAll('.search-input, #globalSearchTrigger, .header-search');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
    });
    trigger.addEventListener('focus', (e) => {
      e.preventDefault();
      openSearch();
    });
  });

  // Debounced search query
  let debounceTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(debounceTimeout);

    if (q.length < 2) {
      resultsContainer.innerHTML = `
        <div style="color: var(--on-surface-variant); text-align: center; padding: 32px 0;">
          Type at least 2 characters to search cases, clients, hearings, notes & ledger across your chamber.
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 30px 0; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined" style="animation: spin 1s linear infinite; font-size: 24px;">progress_activity</span>
        <div style="margin-top: 6px;">Searching records...</div>
      </div>
    `;

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await api.get('/search', { q });
        if (res && res.success) {
          renderSearchResults(res.data, resultsContainer, closeSearch);
        }
      } catch (err) {
        resultsContainer.innerHTML = `
          <div style="color: var(--error); text-align: center; padding: 24px 0;">
            Search failed: ${escapeHTML(err.message)}
          </div>
        `;
      }
    }, 280);
  });
}

function renderSearchResults(data, container, closeFn) {
  const { cases = [], clients = [], hearings = [], tasks = [], notes = [], payments = [] } = data;
  const total = cases.length + clients.length + hearings.length + tasks.length + notes.length + payments.length;

  if (total === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 0; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined" style="font-size: 32px; color: var(--outline);">search_off</span>
        <p style="margin-top: 8px;">No records matched your search in your chamber.</p>
      </div>
    `;
    return;
  }

  let html = '';

  // 1. Cases
  if (cases.length > 0) {
    html += `<div style="font-family: var(--font-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--secondary); margin-bottom: 6px; letter-spacing: 0.04em;">Cases (${cases.length})</div><div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">`;
    cases.forEach((c) => {
      html += `
        <a href="/cases.html?caseId=${c._id}" class="search-result-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); color: var(--on-surface); text-decoration: none; transition: background 0.15s;">
          <div>
            <div style="font-weight: 600;">${escapeHTML(c.title)}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant);">${escapeHTML(c.caseNumber || 'No Pet. No.')} • ${escapeHTML(c.court || 'Court')}</div>
          </div>
          <span class="badge badge-gold" style="font-size: 10px;">${escapeHTML(c.status || 'Active')}</span>
        </a>
      `;
    });
    html += `</div>`;
  }

  // 2. Clients
  if (clients.length > 0) {
    html += `<div style="font-family: var(--font-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--secondary); margin-bottom: 6px; letter-spacing: 0.04em;">Clients (${clients.length})</div><div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">`;
    clients.forEach((cl) => {
      html += `
        <a href="/clients.html?id=${cl._id}" class="search-result-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); color: var(--on-surface); text-decoration: none; transition: background 0.15s;">
          <div>
            <div style="font-weight: 600;">${escapeHTML(cl.name)}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant);">${escapeHTML(cl.phone || cl.email || 'No contact')} • ${escapeHTML(cl.clientType || 'Client')}</div>
          </div>
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--outline);">chevron_right</span>
        </a>
      `;
    });
    html += `</div>`;
  }

  // 3. Hearings
  if (hearings.length > 0) {
    html += `<div style="font-family: var(--font-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--secondary); margin-bottom: 6px; letter-spacing: 0.04em;">Hearings (${hearings.length})</div><div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">`;
    hearings.forEach((h) => {
      const caseId = h.caseId ? (h.caseId._id || h.caseId) : null;
      const caseTitle = (h.caseId && h.caseId.title) ? h.caseId.title : (h.court || 'Court Appearance');
      const caseHref = caseId ? `/calendar.html?caseId=${caseId}&date=${new Date(h.date).toISOString().split('T')[0]}` : '/calendar.html';
      const hearingDateStr = h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      html += `
        <a href="${caseHref}" class="search-result-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); color: var(--on-surface); text-decoration: none; transition: background 0.15s;">
          <div>
            <div style="font-weight: 600;">${escapeHTML(caseTitle)}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant);">${escapeHTML(h.court || '')} • ${escapeHTML(h.purpose || 'Hearing')} (${hearingDateStr}${h.time ? ' at ' + h.time : ''})</div>
          </div>
          <span class="badge badge-scheduled" style="font-size: 10px;">${escapeHTML(h.status || 'Scheduled')}</span>
        </a>
      `;
    });
    html += `</div>`;
  }

  // 4. Tasks
  if (tasks.length > 0) {
    html += `<div style="font-family: var(--font-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--secondary); margin-bottom: 6px; letter-spacing: 0.04em;">Tasks (${tasks.length})</div><div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">`;
    tasks.forEach((t) => {
      html += `
        <a href="/tasks.html?id=${t._id}" class="search-result-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); color: var(--on-surface); text-decoration: none; transition: background 0.15s;">
          <div>
            <div style="font-weight: 600;">${escapeHTML(t.title)}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant);">${escapeHTML(t.category || 'Practice Task')} • Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}</div>
          </div>
          <span class="badge badge-warning" style="font-size: 10px;">${escapeHTML(t.status || 'Pending')}</span>
        </a>
      `;
    });
    html += `</div>`;
  }

  // 5. Notes
  if (notes.length > 0) {
    html += `<div style="font-family: var(--font-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--secondary); margin-bottom: 6px; letter-spacing: 0.04em;">Legal Notes (${notes.length})</div><div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">`;
    notes.forEach((n) => {
      html += `
        <a href="/notes.html?id=${n._id}" class="search-result-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-low); color: var(--on-surface); text-decoration: none; transition: background 0.15s;">
          <div>
            <div style="font-weight: 600;">${escapeHTML(n.title)}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant);">${escapeHTML(n.citation || n.court || n.category || 'Note')}</div>
          </div>
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--secondary);">${n.pinned ? 'push_pin' : 'edit_note'}</span>
        </a>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initGlobalSearch);
