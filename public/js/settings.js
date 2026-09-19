/**
 * Advocate DigiDiary — Chamber Settings & Profile Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();

  // Check health endpoint
  checkServerHealth();

  if (user) {
    populateSettings(user);
  }

  setupEventListeners();
});

async function checkServerHealth() {
  try {
    const res = await API.health.check();
    const el = document.getElementById('healthStatusIndicator');
    if (res.status === 'healthy') {
      el.innerHTML = '<span style="color: var(--success); font-weight: 700;">● Online & Healthy</span>';
    } else {
      el.innerHTML = '<span style="color: var(--warning); font-weight: 700;">● Degraded</span>';
    }
  } catch (err) {
    document.getElementById('healthStatusIndicator').innerHTML = '<span style="color: var(--danger); font-weight: 700;">● Offline</span>';
  }
}

function populateSettings(user) {
  document.getElementById('profName').value = user.name || '';
  document.getElementById('profEmail').value = user.email || '';
  document.getElementById('profBarEnrollment').value = user.barEnrollmentNumber || '';
  document.getElementById('profPhone').value = user.phone || '';

  if (user.lawFirmId) {
    const firm = typeof user.lawFirmId === 'object' ? user.lawFirmId : null;
    if (firm) {
      document.getElementById('settingFirmName').value = firm.name || 'Advocate Chambers';
      document.getElementById('settingFirmCity').value = `${firm.city || 'New Delhi'}, ${firm.state || 'India'}`;
      document.getElementById('settingFirmEmail').value = firm.email || '';
      document.getElementById('settingFirmPhone').value = firm.phone || '';
      document.getElementById('settingFirmId').innerText = firm._id || '';
    } else {
      document.getElementById('settingFirmId').innerText = user.lawFirmId;
    }
  }
}

function setupEventListeners() {
  document.getElementById('userProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProfBtn');
    btn.disabled = true;
    btn.innerText = 'Updating...';

    const payload = {
      name: document.getElementById('profName').value.trim(),
      barEnrollmentNumber: document.getElementById('profBarEnrollment').value.trim() || undefined,
      phone: document.getElementById('profPhone').value.trim() || undefined
    };

    try {
      await API.auth.updateProfile(payload);
      UI.showToast('Profile updated successfully!', 'success');
      // Refresh user state
      await Auth.checkAuth();
    } catch (err) {
      UI.showToast(err.message || 'Failed to update profile', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Update Profile';
    }
  });
}
