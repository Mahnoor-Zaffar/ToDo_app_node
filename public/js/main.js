import { api, clientId } from './api.js';
import { initWebSocket } from './socket.js';

let state = {
  currentUser: null,
  users: [],
  projects: [],
  tasks: [],
  activeProjectId: null,
  activeView: 'inbox', // 'inbox', 'today', 'project'
  viewMode: 'list', // 'list' or 'kanban'
  selectedTask: null,
  presence: {} // { clientId: { user, timestamp } }
};

let ws;
let quill;

const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, 
  tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
);

document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupQuill();
  setupUI();
  
  ws = initWebSocket((msg) => {
    if (msg.type === 'TASK_CREATED' && msg.clientId !== clientId) {
      state.tasks.push(msg.payload);
      renderTasks();
    } else if (msg.type === 'TASK_UPDATED' && msg.clientId !== clientId) {
      const idx = state.tasks.findIndex(t => t.id === msg.payload.id);
      if (idx > -1) state.tasks[idx] = msg.payload;
      if (state.selectedTask && state.selectedTask.id === msg.payload.id) {
        state.selectedTask = msg.payload;
        populateDrawer();
      }
      renderTasks();
    } else if (msg.type === 'TASK_DELETED' && msg.clientId !== clientId) {
      state.tasks = state.tasks.filter(t => t.id !== msg.payload.id);
      renderTasks();
      if (state.selectedTask && state.selectedTask.id === msg.payload.id) closeDrawer();
    } else if (msg.type === 'PRESENCE') {
      state.presence[msg.clientId] = { user: msg.payload.user, time: Date.now() };
      renderPresence();
    }
  });

  // Broadcast presence every 5 seconds
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && state.currentUser) {
      ws.send(JSON.stringify({ type: 'PRESENCE', clientId, payload: { user: state.currentUser } }));
    }
  }, 5000);
});

async function loadInitialData() {
  const [me, users, projects, tasks] = await Promise.all([
    api.me(), api.users(), api.projects(), api.tasks()
  ]);
  state.currentUser = me;
  state.users = users;
  state.projects = projects;
  state.tasks = tasks;
  
  if (projects.length > 0) {
    state.activeProjectId = projects[0].id;
  }
  
  document.getElementById('current-user-name').textContent = me.name;
  document.getElementById('current-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(me.name)}&background=random`;
}

function setupQuill() {
  quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Add details...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
      ]
    }
  });

  quill.on('text-change', () => {
    if (state.selectedTask) {
      const html = quill.root.innerHTML;
      // Optimistic update
      state.selectedTask.notes = html;
      api.updateTask(state.selectedTask.id, { notes: html });
    }
  });
}

function setupUI() {
  renderSidebar();
  renderTasks();
  
  document.getElementById('toggle-view-btn').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'list' ? 'kanban' : 'list';
    renderTasks();
  });

  // Quick add input
  const quickAdd = document.getElementById('quick-add-input');
  quickAdd.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && quickAdd.value.trim()) {
      const text = quickAdd.value.trim();
      let priority = 'P5';
      let assigneeId = null;
      let cleanedText = text;

      const pMatch = cleanedText.match(/!p([1-5])/i);
      if (pMatch) {
        priority = `P${pMatch[1]}`;
        cleanedText = cleanedText.replace(pMatch[0], '');
      }
      
      const aMatch = cleanedText.match(/@(\w+)/);
      if (aMatch) {
        const u = state.users.find(u => u.initials.toLowerCase() === aMatch[1].toLowerCase());
        if (u) assigneeId = u.id;
      }

      // Optimistic UI for create
      const tempTask = {
        id: Date.now(), // temporary
        text: cleanedText.trim(),
        projectId: state.activeView === 'project' ? state.activeProjectId : 1,
        priority,
        assigneeId,
        status: 'todo',
        isCompleted: 0,
        dueDate: state.activeView === 'today' ? new Date().toISOString().split('T')[0] : null
      };
      state.tasks.push(tempTask);
      renderTasks();
      
      try {
        const realTask = await api.createTask(tempTask);
        const idx = state.tasks.findIndex(t => t.id === tempTask.id);
        if (idx > -1) state.tasks[idx] = realTask;
      } catch (err) {
        state.tasks = state.tasks.filter(t => t.id !== tempTask.id); // Revert
        renderTasks();
      }
      quickAdd.value = '';
    }
  });

  document.getElementById('close-drawer').addEventListener('click', closeDrawer);
  
  document.getElementById('task-priority').addEventListener('change', (e) => {
    if (state.selectedTask) optimisticUpdate(state.selectedTask.id, { priority: e.target.value });
  });
  document.getElementById('task-status').addEventListener('change', (e) => {
    if (state.selectedTask) optimisticUpdate(state.selectedTask.id, { status: e.target.value });
  });
  document.getElementById('task-duedate').addEventListener('change', (e) => {
    if (state.selectedTask) optimisticUpdate(state.selectedTask.id, { dueDate: e.target.value });
  });
  document.getElementById('delete-task-btn').addEventListener('click', () => {
    if (state.selectedTask) {
      const id = state.selectedTask.id;
      state.tasks = state.tasks.filter(t => t.id !== id);
      renderTasks();
      closeDrawer();
      api.deleteTask(id);
    }
  });

  document.getElementById('task-attachment').addEventListener('change', async (e) => {
    if (state.selectedTask && e.target.files[0]) {
      const updated = await api.uploadAttachment(state.selectedTask.id, e.target.files[0]);
      const idx = state.tasks.findIndex(t => t.id === updated.id);
      if (idx > -1) state.tasks[idx] = updated;
      if (state.selectedTask.id === updated.id) {
        state.selectedTask = updated;
        populateDrawer();
      }
    }
  });

  setupDragAndDrop();
}

function optimisticUpdate(id, updates) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  Object.assign(task, updates);
  renderTasks();
  if (state.selectedTask && state.selectedTask.id === id) populateDrawer();
  api.updateTask(id, updates).catch(() => {
    console.error('Update failed');
  });
}

function renderSidebar() {
  const container = document.getElementById('sidebar-projects');
  container.innerHTML = state.projects.map(p => `
    <div class="nav-item ${state.activeView === 'project' && state.activeProjectId === p.id ? 'active' : ''}" data-id="${p.id}">
      <span class="icon">📁</span> ${escapeHTML(p.name)}
    </div>
  `).join('');

  container.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', async () => {
      state.activeView = 'project';
      state.activeProjectId = parseInt(el.getAttribute('data-id'));
      state.tasks = await api.tasks({ projectId: state.activeProjectId });
      renderSidebar();
      renderTasks();
    });
  });

  document.getElementById('view-today').addEventListener('click', async () => {
    state.activeView = 'today';
    state.activeProjectId = null;
    const today = new Date().toISOString().split('T')[0];
    state.tasks = await api.tasks({ date: today });
    renderSidebar();
    renderTasks();
  });
}

function createTaskHTML(t) {
  return `
    <div class="task-item ${t.isCompleted ? 'completed' : ''}" data-id="${t.id}" draggable="true">
      <input type="checkbox" class="task-checkbox" ${t.isCompleted ? 'checked' : ''} />
      <span class="task-text">${escapeHTML(t.text)}</span>
      ${t.assigneeId ? `<span class="priority-badge" style="background:#888">${state.users.find(u=>u.id===t.assigneeId)?.initials || ''}</span>` : ''}
      <span class="priority-badge priority-${t.priority}">${t.priority}</span>
    </div>
  `;
}

function renderTasks() {
  const listView = document.getElementById('list-view');
  const kanbanView = document.getElementById('kanban-view');
  const header = document.getElementById('main-header-title');

  if (state.activeView === 'today') {
    header.textContent = 'Today\'s Focus';
  } else {
    const p = state.projects.find(p => p.id === state.activeProjectId);
    header.textContent = p ? p.name : 'Inbox';
  }

  if (state.viewMode === 'list') {
    listView.style.display = 'block';
    kanbanView.style.display = 'none';
    listView.innerHTML = state.tasks.map(createTaskHTML).join('');
  } else {
    listView.style.display = 'none';
    kanbanView.style.display = 'flex';
    document.querySelector('.kanban-dropzone[data-status="todo"]').innerHTML = state.tasks.filter(t => t.status === 'todo').map(createTaskHTML).join('');
    document.querySelector('.kanban-dropzone[data-status="in-progress"]').innerHTML = state.tasks.filter(t => t.status === 'in-progress').map(createTaskHTML).join('');
    document.querySelector('.kanban-dropzone[data-status="done"]').innerHTML = state.tasks.filter(t => t.status === 'done').map(createTaskHTML).join('');
  }

  attachTaskEvents(document.getElementById('main-content-area'));
}

function attachTaskEvents(container) {
  container.querySelectorAll('.task-checkbox').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = parseInt(e.target.closest('.task-item').getAttribute('data-id'));
      optimisticUpdate(id, { isCompleted: e.target.checked ? 1 : 0 });
    });
  });

  container.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox')) return;
      const id = parseInt(el.getAttribute('data-id'));
      state.selectedTask = state.tasks.find(t => t.id === id);
      openDrawer();
    });
  });
}

function setupDragAndDrop() {
  let draggedTaskId = null;

  document.addEventListener('dragstart', (e) => {
    if (e.target.classList && e.target.classList.contains('task-item')) {
      draggedTaskId = parseInt(e.target.getAttribute('data-id'));
      e.target.style.opacity = '0.5';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('task-item')) {
      e.target.style.opacity = '1';
    }
  });

  document.querySelectorAll('.kanban-dropzone').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault(); // allow drop
      zone.style.background = 'rgba(0,0,0,0.02)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.background = 'transparent';
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.background = 'transparent';
      const status = zone.getAttribute('data-status');
      if (draggedTaskId && status) {
        optimisticUpdate(draggedTaskId, { status });
        draggedTaskId = null;
      }
    });
  });
}

function openDrawer() {
  document.getElementById('right-drawer').classList.add('open');
  populateDrawer();
}

function closeDrawer() {
  document.getElementById('right-drawer').classList.remove('open');
  state.selectedTask = null;
}

function populateDrawer() {
  if (!state.selectedTask) return;
  const t = state.selectedTask;
  document.getElementById('task-title-display').textContent = t.text;
  document.getElementById('task-priority').value = t.priority || 'P5';
  document.getElementById('task-status').value = t.status || 'todo';
  document.getElementById('task-duedate').value = t.dueDate || '';
  
  // Set Quill content
  quill.root.innerHTML = t.notes || '';
  
  const attachmentList = document.getElementById('attachment-list');
  if (t.attachmentPath) {
    attachmentList.innerHTML = `<a href="${t.attachmentPath}" target="_blank" class="secondary-btn" style="display:block; text-align:center; padding:0.5rem; text-decoration:none;">📄 View Attached File</a>`;
  } else {
    attachmentList.innerHTML = '';
  }
}

function renderPresence() {
  const container = document.getElementById('presence-avatars');
  const now = Date.now();
  // Filter out users inactive for 15 seconds
  const activeUsers = Object.values(state.presence).filter(p => now - p.time < 15000);
  
  container.innerHTML = activeUsers.map(p => `
    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.user.name)}&background=random" title="${escapeHTML(p.user.name)}" class="presence-avatar">
  `).join('');
}
