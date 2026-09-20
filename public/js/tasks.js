/**
 * Advocate DigiDiary — Tasks & Deadlines Controller
 */

let selectedStatus = 'pending';
let tasksList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  setupEventListeners();
  await loadCasesDropdown();
  await fetchTasks();
});

async function loadCasesDropdown() {
  try {
    const res = await API.cases.getAll({ limit: 100, status: 'active' });
    const select = document.getElementById('tCaseSelect');
    if (res.success && res.data) {
      select.innerHTML = '<option value="">General Chamber Task</option>' +
        res.data.map(c => `<option value="${c._id}">${UI.escapeHTML(c.caseNumber)} — ${UI.escapeHTML(c.title)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load cases:', err);
  }
}

async function fetchTasks() {
  const tbody = document.getElementById('tasksTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Loading chamber tasks...</td></tr>';

  const priority = document.getElementById('taskPriorityFilter').value;
  const params = { sort: 'dueDate' };
  if (selectedStatus) params.status = selectedStatus;
  if (priority) params.priority = priority;

  try {
    const res = await API.tasks.getAll(params);
    if (res.success && res.data) {
      tasksList = res.data;
      renderTasks(tasksList);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No tasks found.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${UI.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderTasks(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">check_circle</span>
          No tasks match the filter. All chamber obligations clear.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks.map(t => {
    const isDone = String(t.status).toLowerCase() === 'completed';
    const isUrgent = String(t.priority).toLowerCase() === 'urgent' || String(t.priority).toLowerCase() === 'high';
    const caseTitle = t.caseId ? t.caseId.title : 'General Chamber';
    const caseNum = t.caseId ? t.caseId.caseNumber : '';
    const assignedName = t.assignedTo ? t.assignedTo.name : 'Chamber Team';

    return `
      <tr class="${isDone ? 'task-row-completed' : ''}" style="${isDone ? 'background-color: rgba(5, 150, 105, 0.03);' : ''}">
        <td style="text-align: center;">
          <input type="checkbox" data-task-id="${t._id}" ${isDone ? 'checked' : ''} onchange="toggleStatus('${t._id}', this.checked)" title="Mark as ${isDone ? 'Pending' : 'Completed'}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--secondary);">
        </td>
        <td>
          <div class="task-title-text" style="font-weight: 600; color: var(--navy-900); ${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
            ${UI.escapeHTML(t.title)}
          </div>
          ${t.description ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(t.description)}</div>` : ''}
        </td>
        <td>
          ${t.caseId ? `
            <div style="font-weight: 600; font-size: 0.8125rem;">
              <a href="/case-details.html?id=${t.caseId._id || t.caseId}" style="color: var(--gold-700); text-decoration: none;">
                ${UI.escapeHTML(caseNum)}
              </a>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(caseTitle)}</div>
          ` : '<span style="color: var(--text-muted); font-size: 0.8125rem;">General Practice</span>'}
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--navy-900);">
            ${UI.formatDate(t.dueDate)}
          </div>
        </td>
        <td>
          <span class="badge ${isUrgent ? 'badge-danger' : (isDone ? 'badge-success' : 'badge-neutral')}" style="font-size: 0.65rem; text-transform: uppercase;">
            ${isDone ? 'COMPLETED' : UI.escapeHTML(t.priority)}
          </span>
        </td>
        <td>
          <span style="font-size: 0.8125rem;">${UI.escapeHTML(assignedName)}</span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn btn-sm btn-ghost" title="Edit Task" onclick="openEditTaskModal('${t._id}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost text-danger" title="Delete Task" onclick="deleteTask('${t._id}')" style="padding: 4px 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  const statusBtns = document.querySelectorAll('.task-filter-btn');
  statusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      statusBtns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      selectedStatus = btn.getAttribute('data-status');
      fetchTasks();
    });
  });

  document.getElementById('taskPriorityFilter').addEventListener('change', fetchTasks);

  document.getElementById('openAddTaskBtn').addEventListener('click', () => {
    loadCasesDropdown();
    document.getElementById('editTaskId').value = '';
    document.getElementById('taskModalTitle').innerText = 'Create Chamber Task';
    document.getElementById('taskForm').reset();
    document.getElementById('tDueDate').value = new Date().toISOString().split('T')[0];
    UI.openModal('taskModal');
  });

  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveTaskBtn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const editId = document.getElementById('editTaskId').value;
    const payload = {
      title: document.getElementById('tTitle').value.trim(),
      caseId: document.getElementById('tCaseSelect').value || undefined,
      dueDate: document.getElementById('tDueDate').value,
      priority: document.getElementById('tPriority').value,
      description: document.getElementById('tDesc').value.trim() || undefined
    };

    try {
      if (editId) {
        await API.tasks.update(editId, payload);
        UI.showToast('Task updated!', 'success');
      } else {
        await API.tasks.create(payload);
        UI.showToast('Task created successfully!', 'success');
      }
      UI.closeModal('taskModal');
      await fetchTasks();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save task', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Task';
    }
  });
}

window.toggleStatus = async (taskId, isChecked) => {
  try {
    // Immediate optimistic feedback on the table row
    const checkbox = document.querySelector(`input[data-task-id="${taskId}"]`);
    const row = checkbox ? checkbox.closest('tr') : null;
    if (row) {
      if (isChecked) {
        row.classList.add('task-row-completed');
        row.style.backgroundColor = 'rgba(5, 150, 105, 0.05)';
        const titleEl = row.querySelector('.task-title-text');
        if (titleEl) {
          titleEl.style.textDecoration = 'line-through';
          titleEl.style.opacity = '0.6';
        }
      } else {
        row.classList.remove('task-row-completed');
        row.style.backgroundColor = '';
        const titleEl = row.querySelector('.task-title-text');
        if (titleEl) {
          titleEl.style.textDecoration = 'none';
          titleEl.style.opacity = '1';
        }
      }
    }

    const res = await API.tasks.update(taskId, { status: isChecked ? 'Completed' : 'To Do' });
    if (res && res.success) {
      UI.showToast(isChecked ? 'Task marked as Completed' : 'Task restored to To Do', 'success');
    }
    // Brief delay so the user clearly observes the strikethrough effect before filter applies
    setTimeout(async () => {
      await fetchTasks();
    }, 400);
  } catch (err) {
    console.error('toggleStatus error:', err);
    UI.showToast('Failed to update task status: ' + (err.message || ''), 'danger');
    await fetchTasks();
  }
};

window.openEditTaskModal = (id) => {
  const t = tasksList.find(x => x._id === id);
  if (!t) return;

  document.getElementById('editTaskId').value = t._id;
  document.getElementById('taskModalTitle').innerText = 'Edit Task';
  document.getElementById('tTitle').value = t.title;
  document.getElementById('tCaseSelect').value = t.caseId ? (t.caseId._id || t.caseId) : '';
  document.getElementById('tDueDate').value = (t.dueDate || '').split('T')[0];
  document.getElementById('tPriority').value = t.priority || 'medium';
  document.getElementById('tDesc').value = t.description || '';

  UI.openModal('taskModal');
};

window.deleteTask = async (id) => {
  const confirmed = await UI.confirm({
    title: 'Delete Chamber Task',
    message: 'Are you sure you want to permanently delete this task? This action will remove it from chamber records.',
    confirmText: 'Delete Task',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    const res = await API.tasks.delete(id);
    if (res && res.success) {
      UI.showToast('Task removed from chamber', 'success');
    }
    await fetchTasks();
  } catch (err) {
    console.error('deleteTask error:', err);
    UI.showToast(err.message || 'Failed to delete task', 'danger');
  }
};
