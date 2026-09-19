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
}

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
};
window.UI = UI;

document.addEventListener('DOMContentLoaded', initDrawersAndModals);
