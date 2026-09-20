/**
 * Advocate DigiDiary — UI Helpers & Micro-Interactions
 */

// Safe HTML Escaping (Crucial for preventing XSS)
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

// Currency Formatter
function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}
window.formatINR = formatINR;

// Date Formatter
function formatDate(dateInput) {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
window.formatDate = formatDate;

// Status Badge Generator (used across dashboard, cases, hearings, case-details)
function getStatusBadge(status) {
  if (!status) return '<span class="badge badge-neutral">—</span>';
  const s = String(status).toLowerCase().trim();
  const map = {
    'active':     { cls: 'badge-gold',    label: 'Active' },
    'pending':    { cls: 'badge-warning',  label: 'Pending' },
    'scheduled':  { cls: 'badge-scheduled',label: 'Scheduled' },
    'completed':  { cls: 'badge-success',  label: 'Completed' },
    'adjourned':  { cls: 'badge-warning',  label: 'Adjourned' },
    'cancelled':  { cls: 'badge-urgent',   label: 'Cancelled' },
    'disposed':   { cls: 'badge-neutral',  label: 'Disposed' },
    'closed':     { cls: 'badge-neutral',  label: 'Closed' },
    'on hold':    { cls: 'badge-neutral',  label: 'On Hold' },
    'transferred':{ cls: 'badge-navy',     label: 'Transferred' },
    'hearing':    { cls: 'badge-live',     label: 'Hearing' },
    'live':       { cls: 'badge-live',     label: 'Live' },
    'upcoming':   { cls: 'badge-scheduled',label: 'Upcoming' },
  };
  const info = map[s] || { cls: 'badge-neutral', label: escapeHTML(status) };
  return `<span class="badge ${info.cls}">${info.label}</span>`;
}
window.getStatusBadge = getStatusBadge;

// Toast Notification Manager
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  // Normalize 'danger' -> 'error' for CSS class
  const cssType = type === 'danger' ? 'error' : type;
  toast.className = `toast ${cssType}`;

  const icon = cssType === 'error' ? 'error' : cssType === 'info' ? 'info' : 'check_circle';
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 18px;">${icon}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

// Drawer Open/Close
function openDrawer(drawerId) {
  const el = drawerId.startsWith('#') || drawerId.startsWith('.')
    ? document.querySelector(drawerId)
    : document.getElementById(drawerId);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}
window.openDrawer = openDrawer;

function closeDrawer(drawerId) {
  const el = drawerId.startsWith('#') || drawerId.startsWith('.')
    ? document.querySelector(drawerId)
    : document.getElementById(drawerId);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}
window.closeDrawer = closeDrawer;

// Modal Open/Close
function openModal(modalId) {
  const el = modalId.startsWith('#') || modalId.startsWith('.')
    ? document.querySelector(modalId)
    : document.getElementById(modalId);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}
window.openModal = openModal;

function closeModal(modalId) {
  const el = modalId.startsWith('#') || modalId.startsWith('.')
    ? document.querySelector(modalId)
    : document.getElementById(modalId);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}
window.closeModal = closeModal;

// Drawer & Modal Controller
function initDrawersAndModals() {
  // Close drawer/modal on backdrop click or close button
  document.addEventListener('click', (e) => {
    // Backdrop click — close drawers
    if (e.target.classList.contains('drawer-backdrop')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }
    // Backdrop click — close modals (only when clicking the backdrop itself, not the dialog)
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Explicit close button with data-close
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      const targetSelector = closeBtn.getAttribute('data-close');
      const target = document.querySelector(targetSelector);
      if (target) {
        target.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });

  // Global Escape key handler — close the topmost active modal/drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close topmost modal first, then drawer
      const activeModals = document.querySelectorAll('.modal-backdrop.active');
      if (activeModals.length > 0) {
        activeModals[activeModals.length - 1].classList.remove('active');
        document.body.style.overflow = '';
        return;
      }
      const activeDrawers = document.querySelectorAll('.drawer-backdrop.active');
      if (activeDrawers.length > 0) {
        activeDrawers[activeDrawers.length - 1].classList.remove('active');
        document.body.style.overflow = '';
        return;
      }
      // Close mobile sidebar if open
      const sidebar = document.querySelector('.sidebar.mobile-open');
      if (sidebar) {
        sidebar.classList.remove('mobile-open');
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('active');
      }
    }
  });

  // Mobile menu toggle — match both #mobileMenuToggle and .mobile-menu-toggle
  const mobileToggles = document.querySelectorAll('#mobileMenuToggle, .mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (sidebar && mobileToggles.length > 0) {
    // Create a sidebar backdrop overlay for mobile
    let sidebarBackdrop = document.querySelector('.sidebar-backdrop');
    if (!sidebarBackdrop) {
      sidebarBackdrop = document.createElement('div');
      sidebarBackdrop.className = 'sidebar-backdrop';
      document.body.appendChild(sidebarBackdrop);
    }

    mobileToggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        sidebarBackdrop.classList.toggle('active', sidebar.classList.contains('mobile-open'));
      });
    });

    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      sidebarBackdrop.classList.remove('active');
    });
  }

  // Setup mobile header title & details
  setupMobileHeader();
}

function setupMobileHeader() {
  const topHeader = document.querySelector('.top-header');
  if (!topHeader) return;

  const leftBox = topHeader.querySelector('div:first-child');
  if (leftBox && !leftBox.querySelector('.mobile-header-brand')) {
    let titleText = '';
    const pageTitleEl = document.querySelector('.page-title');
    if (pageTitleEl) {
      titleText = pageTitleEl.textContent.trim().split('\n')[0].trim();
    } else {
      titleText = document.title.split('—')[0].split('-')[0].trim();
    }

    const brandEl = document.createElement('div');
    brandEl.className = 'mobile-header-brand d-md-none';
    brandEl.innerHTML = `
      <span class="mobile-header-title">${escapeHTML(titleText || 'Advocate Diary')}</span>
      <span class="mobile-header-subtitle">DigiDiary</span>
    `;
    leftBox.appendChild(brandEl);
  }

  const actionsBox = topHeader.querySelector('.header-actions');
  if (actionsBox && !actionsBox.querySelector('.mobile-user-avatar')) {
    const avatarEl = document.createElement('a');
    avatarEl.href = '/profile.html';
    avatarEl.className = 'mobile-user-avatar d-md-none';
    avatarEl.title = 'My Profile';
    avatarEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">account_circle</span>`;
    actionsBox.appendChild(avatarEl);
  }
}
window.setupMobileHeader = setupMobileHeader;

// Confirmation Dialog Modal (Promise-based, Sovereign Navy + Antique Brass aesthetic)
function confirmDialog(options = {}) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure you wish to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
  } = typeof options === 'string' ? { message: options } : options;

  return new Promise((resolve) => {
    let modal = document.getElementById('uiConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'uiConfirmModal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 48px rgba(10, 17, 40, 0.35); border: 1px solid var(--border-light); background: #FFFFFF; padding: 0;">
          <div style="padding: 1.25rem 1.5rem; background: var(--navy-900, #0A1128); color: #FFFFFF; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(197, 155, 39, 0.25);">
            <div id="uiConfirmIconWrapper" style="width: 38px; height: 38px; border-radius: 10px; background: rgba(197, 155, 39, 0.15); border: 1px solid rgba(197, 155, 39, 0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span class="material-symbols-outlined" id="uiConfirmIcon" style="color: var(--gold-500, #C59B27); font-size: 20px;">gavel</span>
            </div>
            <div>
              <h3 id="uiConfirmTitle" style="margin: 0; font-family: var(--font-headline, 'Playfair Display', serif); font-size: 1.15rem; color: #FFFFFF; font-weight: 600;">Confirm Chamber Action</h3>
              <p style="margin: 2px 0 0; font-size: 0.72rem; color: rgba(255,255,255,0.7); font-family: var(--font-label, sans-serif); text-transform: uppercase; letter-spacing: 0.05em;">Chamber Verification</p>
            </div>
          </div>
          <div style="padding: 1.5rem;">
            <p id="uiConfirmMsg" style="margin: 0; color: #334155; font-size: 0.9375rem; line-height: 1.55;"></p>
          </div>
          <div style="padding: 1rem 1.5rem; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="uiConfirmCancel" class="btn btn-outline" style="padding: 8px 18px; font-size: 0.875rem;">Cancel</button>
            <button type="button" id="uiConfirmOk" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.875rem;">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#uiConfirmTitle');
    const msgEl = modal.querySelector('#uiConfirmMsg');
    const okBtn = modal.querySelector('#uiConfirmOk');
    const cancelBtn = modal.querySelector('#uiConfirmCancel');
    const iconEl = modal.querySelector('#uiConfirmIcon');
    const iconWrapper = modal.querySelector('#uiConfirmIconWrapper');

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    if (danger) {
      okBtn.className = 'btn btn-danger';
      okBtn.style.background = '#DC2626';
      okBtn.style.color = '#FFFFFF';
      okBtn.style.border = 'none';
      iconEl.textContent = 'delete_forever';
      iconEl.style.color = '#EF4444';
      iconWrapper.style.background = 'rgba(239, 68, 68, 0.15)';
      iconWrapper.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else {
      okBtn.className = 'btn btn-primary';
      okBtn.style.background = 'var(--gold-600, #C59B27)';
      okBtn.style.color = '#FFFFFF';
      okBtn.style.border = 'none';
      iconEl.textContent = 'gavel';
      iconEl.style.color = 'var(--gold-500, #C59B27)';
      iconWrapper.style.background = 'rgba(197, 155, 39, 0.15)';
      iconWrapper.style.borderColor = 'rgba(197, 155, 39, 0.3)';
    }

    const cleanup = (result) => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      document.removeEventListener('keydown', handleKey);
      resolve(result);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    document.addEventListener('keydown', handleKey);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    okBtn.focus();
  });
}
window.confirmDialog = confirmDialog;

// Executive Chamber Reminder Pop-up Alert
function showReminderPopup(dueReminders = []) {
  if (!dueReminders || dueReminders.length === 0) return;

  let modal = document.getElementById('uiReminderAlertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'uiReminderAlertModal';
    modal.className = 'modal-backdrop';
    modal.style.zIndex = '99998';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 520px; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 54px rgba(10, 17, 40, 0.4); border: 1px solid rgba(197, 155, 39, 0.3); background: #FFFFFF; padding: 0;">
      <!-- Header -->
      <div style="padding: 1.25rem 1.5rem; background: var(--navy-900, #0A1128); color: #FFFFFF; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--gold-600, #C59B27);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(197, 155, 39, 0.2); border: 1px solid rgba(197, 155, 39, 0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="color: var(--gold-500, #C59B27); font-size: 22px;">notifications_active</span>
          </div>
          <div>
            <h3 style="margin: 0; font-family: var(--font-headline, 'Playfair Display', serif); font-size: 1.2rem; color: #FFFFFF; font-weight: 700;">Chamber Reminder Alert</h3>
            <p style="margin: 2px 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.75); letter-spacing: 0.03em;">
              <span id="uiReminderPendingCount">${dueReminders.length}</span> pending alert${dueReminders.length > 1 ? 's' : ''} requiring chamber attention
            </p>
          </div>
        </div>
        <button type="button" id="uiReminderCloseX" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 20px; line-height: 1; padding: 4px;" title="Dismiss">&times;</button>
      </div>

      <!-- Reminder Items Body -->
      <div id="uiReminderListContainer" style="padding: 1.25rem 1.5rem; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.85rem; background: #FAFBFD;">
        ${dueReminders.map(r => {
          const relCase = r.relatedCase || r.caseId;
          const caseNum = relCase ? (relCase.caseNumber || '') : '';
          const caseTitle = relCase ? (relCase.title || '') : '';
          const isUrgent = r.priority === 'Urgent' || r.priority === 'High' || r.priority === 'urgent' || r.priority === 'high';
          const priorityColor = isUrgent ? '#BA1A1A' : '#C59B27';
          const dateStr = formatDate(r.reminderDate || r.remindAt);
          const timeStr = r.reminderTime || '09:00 AM';

          return `
            <div class="reminder-popup-item" id="reminder-pop-${r._id}" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 14px; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; border-left: 4px solid ${priorityColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                  <span style="font-weight: 700; color: #0A1128; font-size: 0.875rem;">${escapeHTML(r.title)}</span>
                  <span class="badge ${isUrgent ? 'badge-danger' : 'badge-gold'}" style="font-size: 0.65rem; padding: 1px 6px; text-transform: uppercase;">${escapeHTML(r.priority || 'Medium')}</span>
                </div>
                ${(r.description || r.message) ? `<p style="margin: 2px 0 6px; font-size: 0.78rem; color: #475569; line-height: 1.4;">${escapeHTML(r.description || r.message)}</p>` : ''}
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #64748B;">
                  <span><strong style="color: #0A1128;">${dateStr}</strong> at ${escapeHTML(timeStr)}</span>
                  ${relCase ? `<span>&bull;</span><span style="font-family: monospace; color: #C59B27; font-weight: 600;">${escapeHTML(caseNum || caseTitle)}</span>` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary reminder-pop-done-btn" data-id="${r._id}" style="align-self: center; padding: 6px 12px; font-size: 0.78rem; display: flex; align-items: center; gap: 4px; border-radius: 6px; background: #0A1128; color: #FFFFFF; border: none; cursor: pointer; flex-shrink: 0;">
                <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
                <span>Done</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Footer -->
      <div style="padding: 0.85rem 1.5rem; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
        <a href="/reminders.html" style="font-size: 0.8125rem; color: var(--gold-700, #C59B27); font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;">
          <span>Open Reminders Diary</span>
          <span class="material-symbols-outlined" style="font-size: 16px;">arrow_forward</span>
        </a>
        <button type="button" id="uiReminderDismissBtn" class="btn btn-outline" style="padding: 6px 14px; font-size: 0.8125rem;">
          Dismiss
        </button>
      </div>
    </div>
  `;

  const closePopup = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // Snooze for 10 minutes in this session
    sessionStorage.setItem('last_reminder_popup_dismissed', Date.now().toString());
  };

  const closeX = modal.querySelector('#uiReminderCloseX');
  if (closeX) closeX.onclick = closePopup;

  const dismissBtn = modal.querySelector('#uiReminderDismissBtn');
  if (dismissBtn) dismissBtn.onclick = closePopup;

  // Handle Mark Done clicks inside popup
  const container = modal.querySelector('#uiReminderListContainer');
  if (container) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.reminder-pop-done-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">hourglass_empty</span>';

      try {
        if (window.API && window.API.reminders && window.API.reminders.toggle) {
          await window.API.reminders.toggle(id, { completed: true });
        } else {
          await fetch(`/api/reminders/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
            credentials: 'include'
          });
        }

        showToast('Reminder marked as done!', 'success');

        const itemEl = document.getElementById(`reminder-pop-${id}`);
        if (itemEl) {
          itemEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          itemEl.style.opacity = '0';
          itemEl.style.transform = 'translateX(20px)';
          setTimeout(() => {
            itemEl.remove();
            const remaining = container.querySelectorAll('.reminder-popup-item');
            const countEl = document.getElementById('uiReminderPendingCount');
            if (countEl) countEl.innerText = remaining.length;
            if (remaining.length === 0) {
              container.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem; color: #059669;">
                  <span class="material-symbols-outlined" style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">task_alt</span>
                  <strong style="font-size: 1rem; color: #0A1128;">All Chamber Reminders Completed!</strong>
                  <p style="font-size: 0.8125rem; color: #64748B; margin-top: 4px;">All dockets and chamber obligations are clear.</p>
                </div>
              `;
              setTimeout(closePopup, 1600);
            }
          }, 300);
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span><span>Done</span>';
        showToast('Failed to complete reminder', 'danger');
      }
    });
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function checkRemindersAndShowPopup(force = false) {
  if (!force) {
    const lastDismissed = sessionStorage.getItem('last_reminder_popup_dismissed');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 10 * 60 * 1000) {
      return;
    }
  }

  const isAuthPage = window.location.pathname.includes('login') ||
    window.location.pathname.includes('register') ||
    window.location.pathname.includes('forgot') ||
    window.location.pathname.includes('reset') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('index.html');
  if (isAuthPage) return;

  try {
    let res = null;
    if (window.API && window.API.reminders) {
      res = await window.API.reminders.getAll({ completed: 'false' });
    } else {
      const resp = await fetch('/api/reminders?completed=false', { credentials: 'include' });
      res = await resp.json();
    }

    if (res && res.success && res.data && res.data.length > 0) {
      const now = new Date();
      const dueThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const pendingDue = res.data.filter(r => {
        if (r.completed) return false;
        const d = new Date(r.reminderDate || r.remindAt);
        return isNaN(d.getTime()) || d <= dueThreshold;
      });

      if (pendingDue.length > 0) {
        showReminderPopup(pendingDue);
      }
    }
  } catch (err) {
    console.debug('Reminder check skipped:', err.message);
  }
}

const UI = {
  escapeHTML,
  formatINR,
  formatDate,
  showToast,
  getStatusBadge,
  openDrawer,
  closeDrawer,
  openModal,
  closeModal,
  confirm: confirmDialog,
  showReminderPopup,
  checkRemindersAndShowPopup,
};
window.UI = UI;

document.addEventListener('DOMContentLoaded', () => {
  initDrawersAndModals();
  // Check reminders 1.5 seconds after page load for authenticated sessions
  setTimeout(() => {
    checkRemindersAndShowPopup();
  }, 1500);

  // Auto-load DigiDiary Legal AI Assistant on all authenticated pages
  try {
    const isAuthPage =
      window.location.pathname.includes('login') ||
      window.location.pathname.includes('register') ||
      window.location.pathname.includes('forgot') ||
      window.location.pathname.includes('reset') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('index.html');

    if (!isAuthPage && !document.querySelector('script[src*="ai-chat.js"]')) {
      const aiScript = document.createElement('script');
      aiScript.src = '/js/ai-chat.js';
      aiScript.defer = true;
      document.body.appendChild(aiScript);
    }
  } catch (e) {
    console.debug('AI chat script init notice:', e);
  }
});
