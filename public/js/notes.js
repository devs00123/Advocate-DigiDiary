/**
 * Advocate DigiDiary — Legal Notebook Controller (Stitch Dual-Pane)
 * Text-only research notes. Strictly NO document storage.
 */

let allNotes = [];
let activeNoteId = null;
let selectedCategory = '';
let isPinnedState = false;

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  await loadCasesDropdown();
  setupEventListeners();
  await fetchNotes();
});

async function loadCasesDropdown() {
  try {
    const res = await API.cases.getAll({ limit: 100 });
    const select = document.getElementById('noteCaseSelect');
    if (res.success && res.data) {
      select.innerHTML = '<option value="">No linked case (General chamber note)</option>' +
        res.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
  }
}

async function fetchNotes() {
  const container = document.getElementById('notesListContainer');
  container.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Loading notes...</p>';

  const search = document.getElementById('noteSearchInput').value.trim();
  const params = { sort: '-updatedAt' };
  if (search) params.search = search;
  if (selectedCategory) params.category = selectedCategory;

  try {
    const res = await API.notes.getAll(params);
    if (res.success && res.data) {
      allNotes = res.data;
      renderNotesList();

      if (allNotes.length > 0 && !activeNoteId) {
        selectNote(allNotes[0]._id);
      } else if (allNotes.length === 0) {
        resetEditor();
      }
    } else {
      allNotes = [];
      container.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No notes found.</p>';
      resetEditor();
    }
  } catch (err) {
    container.innerHTML = `<p style="padding: 1.5rem; text-align: center; color: var(--danger);">Error: ${UI.escapeHTML(err.message)}</p>`;
  }
}

function renderNotesList() {
  const container = document.getElementById('notesListContainer');
  if (allNotes.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted);">
        <span class="material-symbols-outlined" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">edit_note</span>
        No notes match your filter.
      </div>
    `;
    return;
  }

  container.innerHTML = allNotes.map(n => {
    const isActive = n._id === activeNoteId;
    const snippet = n.content ? (n.content.length > 70 ? n.content.substring(0, 70) + '...' : n.content) : '';
    const caseBadge = n.caseId 
      ? `<span class="badge badge-neutral font-mono" style="font-size: 0.65rem;">${UI.escapeHTML(n.caseId.caseNumber || 'Case')}</span>` 
      : '';
    const pinBadge = n.isPinned ? '<span class="material-symbols-outlined" style="font-size: 14px; color: var(--gold-600);">push_pin</span>' : '';

    return `
      <div class="note-card-item ${isActive ? 'active' : ''}" onclick="selectNote('${n._id}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--navy-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">
            ${UI.escapeHTML(n.title)}
          </div>
          ${pinBadge}
        </div>
        <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35; margin-bottom: 6px;">
          ${UI.escapeHTML(snippet)}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          ${caseBadge || '<span></span>'}
          <span style="font-size: 0.7rem; color: var(--text-muted);">${UI.formatDate(n.updatedAt || n.createdAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.selectNote = (id) => {
  activeNoteId = id;
  const note = allNotes.find(n => n._id === id);
  if (!note) return;

  renderNotesList();

  document.getElementById('currentNoteId').value = note._id;
  document.getElementById('noteTitleInput').value = note.title;
  document.getElementById('noteCategorySelect').value = note.category || 'general';
  document.getElementById('noteCaseSelect').value = note.caseId ? (note.caseId._id || note.caseId) : '';
  document.getElementById('noteBodyInput').value = note.content || '';
  document.getElementById('noteCitationsInput').value = note.citations ? note.citations.join(', ') : '';
  document.getElementById('noteTimestamp').innerText = `Saved: ${UI.formatDate(note.updatedAt || note.createdAt)}`;

  isPinnedState = !!note.isPinned;
  updatePinButtonUI();

  document.getElementById('deleteNoteBtn').style.display = 'inline-flex';
};

function resetEditor() {
  activeNoteId = null;
  document.getElementById('currentNoteId').value = '';
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteCategorySelect').value = 'general';
  document.getElementById('noteCaseSelect').value = '';
  document.getElementById('noteBodyInput').value = '';
  document.getElementById('noteCitationsInput').value = '';
  document.getElementById('noteTimestamp').innerText = 'New Draft';

  isPinnedState = false;
  updatePinButtonUI();

  document.getElementById('deleteNoteBtn').style.display = 'none';
  renderNotesList();
}

function updatePinButtonUI() {
  const icon = document.getElementById('pinIcon');
  if (isPinnedState) {
    icon.style.color = 'var(--gold-600)';
    icon.style.fontVariationSettings = "'FILL' 1";
  } else {
    icon.style.color = 'var(--text-muted)';
    icon.style.fontVariationSettings = "'FILL' 0";
  }
}

function setupEventListeners() {
  // New Note Button
  document.getElementById('createNewNoteBtn').addEventListener('click', () => {
    resetEditor();
    document.getElementById('noteTitleInput').focus();
  });

  // Pin Toggle
  document.getElementById('pinToggleBtn').addEventListener('click', () => {
    isPinnedState = !isPinnedState;
    updatePinButtonUI();
  });

  // Search Notes
  document.getElementById('noteSearchInput').addEventListener('input', () => {
    fetchNotes();
  });

  // Category Filter Buttons
  const catBtns = document.querySelectorAll('.cat-filter-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      selectedCategory = btn.getAttribute('data-cat');
      fetchNotes();
    });
  });

  // Save Note Button
  document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const title = document.getElementById('noteTitleInput').value.trim();
    const content = document.getElementById('noteBodyInput').value.trim();
    if (!title || !content) {
      UI.showToast('Please provide a title and note content', 'warning');
      return;
    }

    const citationsRaw = document.getElementById('noteCitationsInput').value.trim();
    const citations = citationsRaw ? citationsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];

    const payload = {
      title,
      content,
      category: document.getElementById('noteCategorySelect').value,
      caseId: document.getElementById('noteCaseSelect').value || undefined,
      citations,
      isPinned: isPinnedState
    };

    const noteId = document.getElementById('currentNoteId').value;
    const saveBtn = document.getElementById('saveNoteBtn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    try {
      if (noteId) {
        await API.notes.update(noteId, payload);
        UI.showToast('Note updated!', 'success');
      } else {
        const created = await API.notes.create(payload);
        UI.showToast('Note created!', 'success');
        if (created.data) activeNoteId = created.data._id;
      }
      await fetchNotes();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save note', 'danger');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">save</span><span>Save Note</span>';
    }
  });

  // Delete Note Button
  document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
    const noteId = document.getElementById('currentNoteId').value;
    if (!noteId) return;

    const confirmed = await UI.confirm({
      title: 'Delete Research Note',
      message: 'Are you sure you want to delete this legal research note? This cannot be undone.',
      confirmText: 'Delete Note',
      cancelText: 'Cancel',
      danger: true
    });
    if (!confirmed) return;

    try {
      await API.notes.delete(noteId);
      UI.showToast('Note deleted', 'success');
      activeNoteId = null;
      await fetchNotes();
    } catch (err) {
      UI.showToast(err.message || 'Failed to delete note', 'danger');
    }
  });
}
