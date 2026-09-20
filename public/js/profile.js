/**
 * Advocate DigiDiary — Practitioner Profile Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  setupProfileForm();
});

let currentUser = null;
let currentFirm = null;

async function loadUserProfile() {
  try {
    const res = await API.auth.me();
    if (!res.success || !res.data) {
      window.location.href = '/login.html';
      return;
    }

    currentUser = res.data.user;
    currentFirm = res.data.lawFirm;

    // Set Initials
    const initials = (currentUser.name || 'Advocate')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const avatarEl = document.getElementById('profileAvatarInitials');
    if (avatarEl) avatarEl.textContent = initials || 'AD';

    // Hero details
    const heroName = document.getElementById('profileHeroName');
    if (heroName) heroName.textContent = currentUser.name || 'Advocate';

    const heroRoleTag = document.getElementById('profileHeroRoleTag');
    if (heroRoleTag) heroRoleTag.textContent = (currentUser.role || 'Advocate').toUpperCase();

    const heroDesig = document.getElementById('profileHeroDesignation');
    if (heroDesig) heroDesig.textContent = currentUser.designation || 'Advocate at Law';

    const heroFirm = document.getElementById('profileHeroFirm');
    if (heroFirm) heroFirm.textContent = currentFirm ? currentFirm.name : 'Chambers';

    const heroBar = document.getElementById('profileHeroBar');
    if (heroBar) heroBar.textContent = currentUser.enrollmentNumber ? `Bar ID: ${currentUser.enrollmentNumber}` : 'Bar ID: Registered';

    const heroMemberSince = document.getElementById('profileHeroMemberSince');
    if (heroMemberSince && currentUser.createdAt) {
      const year = new Date(currentUser.createdAt).getFullYear();
      heroMemberSince.textContent = `Member since ${year}`;
    }

    // Form inputs
    const nameInput = document.getElementById('profileName');
    if (nameInput) nameInput.value = currentUser.name || '';

    const desigInput = document.getElementById('profileDesignation');
    if (desigInput) desigInput.value = currentUser.designation || '';

    const enrollInput = document.getElementById('profileEnrollment');
    if (enrollInput) enrollInput.value = currentUser.enrollmentNumber || '';

    const phoneInput = document.getElementById('profilePhone');
    if (phoneInput) phoneInput.value = currentUser.phone || '';

    const emailInput = document.getElementById('profileEmail');
    if (emailInput) emailInput.value = currentUser.email || '';

    const roleInput = document.getElementById('profileRole');
    if (roleInput) roleInput.value = (currentUser.role || 'advocate').toUpperCase();

    // Chamber Affiliation Card
    const cardFirm = document.getElementById('cardFirmName');
    if (cardFirm) cardFirm.textContent = currentFirm ? currentFirm.name : 'Chambers Practice';

    const cardCity = document.getElementById('cardFirmCity');
    if (cardCity) cardCity.textContent = (currentFirm && currentFirm.address) ? currentFirm.address.split(',').pop().trim() : 'Supreme Court & High Courts';

    const cardBar = document.getElementById('cardFirmBar');
    if (cardBar) cardBar.textContent = currentFirm ? (currentFirm.barCouncilRegistration || 'D/ROOT/2026') : 'D/ROOT/2026';

  } catch (err) {
    console.error('Failed to load profile', err);
    UI.showToast('Could not load user profile: ' + err.message, 'danger');
  }
}

function setupProfileForm() {
  const form = document.getElementById('profileForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.innerHTML = '<span>Saving Changes...</span>';

    const payload = {
      name: document.getElementById('profileName').value.trim(),
      designation: document.getElementById('profileDesignation').value.trim(),
      enrollmentNumber: document.getElementById('profileEnrollment').value.trim(),
      phone: document.getElementById('profilePhone').value.trim(),
    };

    try {
      const res = await API.auth.updateProfile(payload);
      if (res.success) {
        UI.showToast('Profile credentials successfully updated!', 'success');
        await loadUserProfile();

        // Update sidebar
        const sideName = document.getElementById('sidebarUserName');
        if (sideName) sideName.textContent = payload.name;
        const sideBar = document.getElementById('sidebarBarEnrollment');
        if (sideBar) sideBar.textContent = payload.enrollmentNumber || payload.designation || 'Advocate';
      }
    } catch (err) {
      UI.showToast(err.message || 'Failed to update profile.', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">save</span><span>Save Profile Changes</span>';
    }
  });
}
