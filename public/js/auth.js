/**
 * Advocate DigiDiary — Authentication & Session Manager
 */

let currentUser = null;
let currentLawFirm = null;

async function checkAuth(requiredRoles = []) {
  try {
    const res = await api.get('/auth/me');
    if (res && res.success && res.data) {
      currentUser = res.data.user;
      currentLawFirm = res.data.lawFirm;
      window.currentUser = currentUser;
      window.currentLawFirm = currentLawFirm;

      // Check RBAC permission for current page if required
      if (requiredRoles.length > 0 && !requiredRoles.includes(currentUser.role)) {
        alert(`Access Restricted: Your role (${currentUser.role}) cannot access this section.`);
        window.location.href = '/dashboard.html';
        return null;
      }

      updateUserUI(currentUser, currentLawFirm);
      return { user: currentUser, lawFirm: currentLawFirm };
    }
  } catch (err) {
    const isAuthPage = window.location.pathname.includes('login.html') ||
      window.location.pathname.includes('register.html') ||
      window.location.pathname.includes('forgot-password.html') ||
      window.location.pathname.includes('reset-password.html') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('index.html');

    if (!isAuthPage) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return null;
  }
}

function updateUserUI(user, firm) {
  // Sidebar user name
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = user.name;

  // Firm name
  const firmNameEl = document.querySelector('.firm-name');
  if (firmNameEl) firmNameEl.textContent = (firm && firm.name) || 'Singhania & Partners LLP';

  // Bar enrollment
  const barEnrollmentEl = document.querySelector('.bar-enrollment');
  if (barEnrollmentEl) {
    barEnrollmentEl.textContent = user.enrollmentNumber
      ? `Bar Enr: ${user.enrollmentNumber}`
      : firm && firm.barCouncilRegistration
      ? `Bar Enr: ${firm.barCouncilRegistration}`
      : 'Active Advocate';
  }

  // Role tag
  const roleTagEl = document.querySelector('.role-tag');
  if (roleTagEl) {
    roleTagEl.textContent = user.role.toUpperCase();
  }

  // Top header chamber title
  const chamberTitleEl = document.querySelector('.chamber-title');
  if (chamberTitleEl && firm) chamberTitleEl.textContent = firm.name;

  const chamberSubEl = document.querySelector('.chamber-sub');
  if (chamberSubEl && firm) chamberSubEl.textContent = firm.chamberNumber || 'Lawyers Chambers Block';

  // Admin navigation link visibility
  const adminLinks = document.querySelectorAll('.admin-only, #navAdminLink');
  adminLinks.forEach((el) => {
    if (user.role === 'admin') {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });

  // Attach logout listener
  const logoutBtns = document.querySelectorAll('[data-action="logout"], .logout-btn');
  logoutBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await api.post('/auth/logout');
        window.location.href = '/login.html';
      } catch (err) {
        window.location.href = '/login.html';
      }
    });
  });
}

const Auth = {
  checkAuth,
  requireAuth: async (requiredRoles = []) => {
    const res = await checkAuth(requiredRoles);
    return res ? res.user : null;
  },
  getUser: () => currentUser,
  getFirm: () => currentLawFirm,
  isAuthenticated: () => !!currentUser,
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {}
    window.location.href = '/login.html';
  },
  updateUserUI,
};

window.Auth = Auth;
window.checkAuth = checkAuth;
