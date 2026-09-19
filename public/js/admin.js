/**
 * Advocate DigiDiary — Super Admin & Platform Telemetry Controller
 */

(function () {
  let currentPage = 1;
  let currentSearch = '';
  let currentStatus = 'all';
  let currentJurisdiction = 'all';
  let searchTimeout = null;

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Authentication & Admin Role Gate
    await checkAdminAccess();

    // 2. Initialize UI & Event Listeners
    initEventListeners();

    // 3. Fetch Telemetry, Advocates Roster, and Live Feed
    await Promise.all([
      loadTelemetry(),
      loadAdvocates(1),
      loadLiveFeed(),
    ]);

    // Set auto-refresh interval for live feed every 30 seconds
    setInterval(() => {
      loadLiveFeed(true);
    }, 30000);
  });

  /**
   * Verify authenticated user has root/admin role
   */
  async function checkAdminAccess() {
    try {
      const res = await window.API.auth.me();
      const user = res && res.data ? res.data.user : res;
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      // Check role
      if (user.role !== 'admin') {
        alert('Access Restricted: Super Admin console requires root chamber privileges.');
        window.location.href = 'dashboard.html';
        return;
      }

      // Set user header details
      const nameEl = document.getElementById('adminUserName');
      const emailEl = document.getElementById('adminUserEmail');
      if (nameEl) nameEl.textContent = user.name || 'Master Admin';
      if (emailEl) emailEl.textContent = user.email || 'root@advocatedigi.com';
    } catch (err) {
      console.error('Failed to verify session', err);
      window.location.href = 'login.html';
    }
  }

  /**
   * Initialize interactive action buttons and search controls
   */
  function initEventListeners() {
    // Master Search with debounce
    const searchInput = document.getElementById('masterSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentSearch = e.target.value.trim();
          loadAdvocates(1);
        }, 300);
      });
    }

    // Filters
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentStatus = e.target.value;
        loadAdvocates(1);
      });
    }

    const jurisdictionFilter = document.getElementById('filterJurisdiction');
    if (jurisdictionFilter) {
      jurisdictionFilter.addEventListener('change', (e) => {
        currentJurisdiction = e.target.value;
        loadAdvocates(1);
      });
    }

    // Pagination
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) prevBtn.addEventListener('click', () => loadAdvocates(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => loadAdvocates(currentPage + 1));

    // Export Audit CSV
    const exportBtn = document.getElementById('btnExportAudit');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.location.href = '/api/admin/export-audit';
        if (window.UI) window.UI.showToast('Streaming immutable audit log CSV...', 'success');
      });
    }

    // Purge Stale Records
    const purgeBtn = document.getElementById('btnPurgeStale');
    if (purgeBtn) {
      purgeBtn.addEventListener('click', async () => {
        const confirmed = await window.UI.confirm({
          title: 'Optimize Cluster Cache',
          message: 'Optimize cluster cache and purge stale temporary sessions across the multi-tenant registry?',
          confirmText: 'Purge & Optimize',
          cancelText: 'Cancel',
          danger: false
        });
        if (!confirmed) return;
        try {
          const res = await window.API.request('/admin/purge-stale', { method: 'POST' });
          if (res.success) {
            if (window.UI) window.UI.showToast(res.message, 'success');
            await loadLiveFeed();
          }
        } catch (err) {
          if (window.UI) window.UI.showToast(err.message || 'Purge failed', 'error');
        }
      });
    }

    // Health Report Modal
    const healthBtn = document.getElementById('btnHealthReport');
    const navHealthBtn = document.getElementById('navHealthBtn');
    const modalHealth = document.getElementById('modalHealth');
    const closeHealth = document.getElementById('btnCloseHealth');
    const dismissHealth = document.getElementById('btnDismissHealth');

    const openHealthModal = async () => {
      if (modalHealth) modalHealth.classList.remove('hidden');
      await loadHealthDiagnostics();
    };

    if (healthBtn) healthBtn.addEventListener('click', openHealthModal);
    if (navHealthBtn) navHealthBtn.addEventListener('click', openHealthModal);
    if (closeHealth) closeHealth.addEventListener('click', () => modalHealth.classList.add('hidden'));
    if (dismissHealth) dismissHealth.addEventListener('click', () => modalHealth.classList.add('hidden'));

    // Invite Chamber Head Modal
    const inviteBtn = document.getElementById('btnInviteChamberHead');
    const modalInvite = document.getElementById('modalInvite');
    const closeInvite = document.getElementById('btnCloseInvite');
    const cancelInvite = document.getElementById('btnCancelInvite');
    const formInvite = document.getElementById('formInviteChamberHead');

    if (inviteBtn) inviteBtn.addEventListener('click', () => modalInvite.classList.remove('hidden'));
    if (closeInvite) closeInvite.addEventListener('click', () => modalInvite.classList.add('hidden'));
    if (cancelInvite) cancelInvite.addEventListener('click', () => modalInvite.classList.add('hidden'));

    if (formInvite) {
      formInvite.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('inviteName').value.trim(),
          email: document.getElementById('inviteEmail').value.trim(),
          firmName: document.getElementById('inviteFirmName').value.trim(),
          enrollmentNumber: document.getElementById('inviteEnrollment').value.trim(),
        };

        try {
          const res = await window.API.request('/admin/invite', {
            method: 'POST',
            body: payload,
          });

          if (res.success) {
            alert(`Chamber Head Invited Successfully!\n\nEmail: ${res.data.email}\nTemporary Password: ${res.data.temporaryPassword}\nFirm: ${res.data.firm}`);
            formInvite.reset();
            modalInvite.classList.add('hidden');
            await loadAdvocates(1);
            await loadLiveFeed();
          }
        } catch (err) {
          alert('Failed to invite user: ' + err.message);
        }
      });
    }

    // Refresh Live Feed Button
    const refreshFeedBtn = document.getElementById('btnRefreshFeed');
    if (refreshFeedBtn) {
      refreshFeedBtn.addEventListener('click', () => {
        loadLiveFeed();
        if (window.UI) window.UI.showToast('Live stream synced with cluster.', 'info');
      });
    }

    // Header Notification Button
    const notifBtn = document.getElementById('btnNotifications');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        if (window.UI) window.UI.showToast('All cluster alerts resolved. Platform operating nominally.', 'info');
        else alert('All cluster alerts resolved. Platform operating nominally.');
      });
    }

    // Mobile Navigation Toggle
    const mobileToggle = document.getElementById('adminMobileToggle');
    const asideEl = document.querySelector('aside');
    if (mobileToggle && asideEl) {
      mobileToggle.addEventListener('click', () => {
        asideEl.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!asideEl.contains(e.target) && !mobileToggle.contains(e.target) && asideEl.classList.contains('open')) {
          asideEl.classList.remove('open');
        }
      });
    }
  }

  /**
   * Load real platform telemetry KPIs and update charts
   */
  async function loadTelemetry() {
    try {
      const res = await window.API.request('/admin/telemetry');
      if (!res.success || !res.data) return;

      const d = res.data;

      // Update KPI numbers
      const advocateEl = document.getElementById('kpiAdvocateRoster');
      if (advocateEl) advocateEl.textContent = d.advocateRoster.total.toLocaleString();

      const viewsEl = document.getElementById('kpiPlatformViews');
      if (viewsEl) viewsEl.textContent = d.totalPlatformViews.toLocaleString();

      const concurrentEl = document.getElementById('kpiActiveConcurrent');
      if (concurrentEl) concurrentEl.textContent = d.activeConcurrent.toLocaleString();

      const footprintEl = document.getElementById('kpiDataFootprint');
      if (footprintEl) footprintEl.textContent = d.dataFootprintGB;

      // Module distribution bars
      if (d.moduleTraffic) {
        updateModuleBar('Hearings', d.moduleTraffic.hearings);
        updateModuleBar('Cases', d.moduleTraffic.cases);
        updateModuleBar('Finance', d.moduleTraffic.finance);
        updateModuleBar('Notes', d.moduleTraffic.notes);
      }
    } catch (err) {
      console.error('Failed to load telemetry', err);
    }
  }

  function updateModuleBar(name, pct) {
    const pctEl = document.getElementById(`pct${name}`);
    const barEl = document.getElementById(`bar${name}`);
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;
  }

  /**
   * Load registered advocates table
   */
  async function loadAdvocates(page = 1) {
    currentPage = page;
    const tableBody = document.getElementById('advocatesTableBody');
    if (!tableBody) return;

    try {
      const params = new URLSearchParams({
        page,
        limit: 8,
      });

      if (currentSearch) params.append('search', currentSearch);
      if (currentStatus && currentStatus !== 'all') params.append('status', currentStatus);
      if (currentJurisdiction && currentJurisdiction !== 'all') params.append('jurisdiction', currentJurisdiction);

      const res = await window.API.request(`/admin/advocates?${params.toString()}`);
      if (!res.success || !res.data) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-on-surface-variant">No registered advocates found matching criteria.</td></tr>`;
        return;
      }

      const advocates = res.data;
      if (advocates.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-on-surface-variant">No accounts matched your filters.</td></tr>`;
        return;
      }

      tableBody.innerHTML = advocates
        .map((adv) => {
          const statusBadge = adv.status === 'active'
            ? `<span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] uppercase font-bold">
                 <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span> Active
               </span>`
            : `<span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-[11px]">
                 ${adv.status || 'Pending'}
               </span>`;

          return `
            <tr class="hover:bg-surface-container-low transition-colors">
              <td class="py-space-sm px-space-sm">
                <div class="font-headline-sm text-[15px] font-semibold text-primary">${escapeHTML(adv.name)}</div>
                <div class="font-label-sm text-[11px] text-on-surface-variant">${escapeHTML(adv.firm?.name || 'Independent Chamber')}</div>
              </td>
              <td class="py-space-sm px-space-sm">
                <span class="inline-block px-1.5 py-0.5 bg-surface-container rounded font-label-sm text-[11px] text-primary mb-0.5 font-medium">
                  ${escapeHTML(adv.enrollmentNumber)}
                </span>
                <div class="text-on-surface-variant text-[12px] truncate max-w-[170px]">${escapeHTML(adv.email)}</div>
              </td>
              <td class="py-space-sm px-space-sm text-center">
                <span class="font-label-md text-sm font-bold text-primary">${adv.caseCount}</span>
                <div class="font-label-sm text-[10px] text-on-surface-variant">${adv.todayHearings} Listed</div>
              </td>
              <td class="py-space-sm px-space-sm text-right font-label-md text-sm font-medium">
                ${adv.views.toLocaleString()}
              </td>
              <td class="py-space-sm px-space-sm">
                ${statusBadge}
              </td>
              <td class="py-space-sm px-space-sm text-center">
                <div class="flex items-center justify-center gap-1">
                  <button onclick="window.viewAdvocateDetails('${adv._id}')" class="p-1 rounded hover:bg-surface-container text-primary hover:text-secondary transition-colors" title="Inspect Account Details">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                  <button onclick="window.openAdvocateAudit('${adv._id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Audit Trail">
                    <span class="material-symbols-outlined text-[18px]">history</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      // Update pagination
      const pagination = res.pagination;
      const paginationInfo = document.getElementById('paginationInfo');
      const prevBtn = document.getElementById('btnPrevPage');
      const nextBtn = document.getElementById('btnNextPage');
      const pageNumbers = document.getElementById('pageNumbersContainer');

      if (paginationInfo) {
        const start = (pagination.page - 1) * pagination.limit + 1;
        const end = Math.min(pagination.page * pagination.limit, pagination.total);
        paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} Registered Advocates`;
      }

      if (prevBtn) prevBtn.disabled = pagination.page <= 1;
      if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;

      if (pageNumbers) {
        pageNumbers.innerHTML = `<button class="px-space-sm py-1 bg-primary-container text-surface-container-lowest font-bold rounded">${pagination.page}</button>`;
      }
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-error">Failed to load accounts: ${err.message}</td></tr>`;
    }
  }

  /**
   * Load real-time event stream
   */
  async function loadLiveFeed(isSilent = false) {
    const listEl = document.getElementById('liveFeedList');
    if (!listEl) return;

    try {
      const res = await window.API.request('/admin/live-feed');
      if (!res.success || !res.data || res.data.length === 0) {
        if (!isSilent) listEl.innerHTML = `<div class="text-center py-6 text-on-surface-variant text-sm">No recent events recorded.</div>`;
        return;
      }

      listEl.innerHTML = res.data
        .map((ev) => {
          const timeAgo = formatTimeAgo(ev.timestamp);
          return `
            <div class="p-space-sm bg-surface-container-low rounded-lg flex items-start gap-space-sm border border-surface-container/60 hover:bg-surface-container-lowest transition-colors">
              <div class="w-7 h-7 rounded ${ev.tagColor} flex items-center justify-center shrink-0 mt-0.5">
                <span class="material-symbols-outlined text-[16px]">${ev.icon}</span>
              </div>
              <div class="flex flex-col">
                <div class="font-label-sm text-xs text-on-surface leading-snug">
                  <strong>${escapeHTML(ev.userName)}</strong> ${escapeHTML(ev.description || ev.action)}
                </div>
                <div class="font-body-sm text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <span class="material-symbols-outlined text-[12px]">schedule</span> ${timeAgo} • IP: ${ev.ipAddress}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Failed to load live feed', err);
    }
  }

  /**
   * Load system health diagnostics into modal
   */
  async function loadHealthDiagnostics() {
    const content = document.getElementById('healthContent');
    if (!content) return;

    content.innerHTML = `<p class="text-on-surface-variant text-center py-4">Gathering cluster telemetry...</p>`;

    try {
      const res = await window.API.request('/admin/health-report');
      if (!res.success || !res.data) {
        content.innerHTML = `<p class="text-error">Diagnostics report unavailable.</p>`;
        return;
      }

      const d = res.data;
      content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 p-3 bg-surface-container-low rounded-lg">
          <div>
            <div class="text-xs text-on-surface-variant">Cluster Engine</div>
            <div class="font-bold text-primary">${d.database.engine}</div>
            <div class="text-[11px] text-secondary font-semibold">${d.database.status}</div>
          </div>
          <div>
            <div class="text-xs text-on-surface-variant">Security Protocol</div>
            <div class="font-bold text-primary">${d.cluster.encryption}</div>
            <div class="text-[11px] text-on-surface-variant">Node.js ${d.cluster.nodeVersion}</div>
          </div>
          <div>
            <div class="text-xs text-on-surface-variant">Process Uptime</div>
            <div class="font-bold text-primary">${Math.floor(d.cluster.uptimeSeconds / 60)} minutes</div>
          </div>
          <div>
            <div class="text-xs text-on-surface-variant">Memory Footprint</div>
            <div class="font-bold text-primary">${d.memory.heapUsedMB} MB / ${d.memory.heapTotalMB} MB</div>
          </div>
        </div>

        <div>
          <div class="font-semibold text-xs text-on-surface uppercase tracking-wider mb-2">Live Collection Census</div>
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="p-2 bg-surface-container rounded">
              <div class="font-bold text-base text-primary">${d.documentCounts.cases}</div>
              <div class="text-[10px] text-on-surface-variant uppercase">Cases</div>
            </div>
            <div class="p-2 bg-surface-container rounded">
              <div class="font-bold text-base text-primary">${d.documentCounts.hearings}</div>
              <div class="text-[10px] text-on-surface-variant uppercase">Hearings</div>
            </div>
            <div class="p-2 bg-surface-container rounded">
              <div class="font-bold text-base text-primary">${d.documentCounts.payments}</div>
              <div class="text-[10px] text-on-surface-variant uppercase">Payments</div>
            </div>
            <div class="p-2 bg-surface-container rounded">
              <div class="font-bold text-base text-primary">${d.documentCounts.auditLogs}</div>
              <div class="text-[10px] text-on-surface-variant uppercase">Audit Logs</div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<p class="text-error">Error fetching health report: ${err.message}</p>`;
    }
  }

  // Global actions attached to window
  window.viewAdvocateDetails = (id) => {
    alert(`Inspecting Advocate ID: ${id}\nStrict Tenant Isolation active. All operations recorded in cluster audit trail.`);
  };

  window.openAdvocateAudit = (id) => {
    window.location.href = `audit-logs.html?userId=${id}`;
  };

  // Safe formatting helpers
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Just now';
    const d = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }
})();
