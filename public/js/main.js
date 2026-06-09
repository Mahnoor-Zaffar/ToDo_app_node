import { api } from './api.js';
import { initWebSocket } from './socket.js';

let state = {
  currentUser: null,
  users: [],
  projects: [],
  tasks: [],
  activeProjectId: null,
  activeView: 'inbox', // 'inbox', 'today', 'project'
  selectedTask: null
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupUI();
  
  initWebSocket((msg) => {
    console.log('WS msg received:', msg);
    if (msg.type === 'TASK_CREATED') {
      state.tasks.push(msg.payload);
      renderTasks();
    } else if (msg.type === 'TASK_UPDATED') {
      const idx = state.tasks.findIndex(t => t.id === msg.payload.id);
      if (idx > -1) state.tasks[idx] = msg.payload;
      if (state.selectedTask && state.selectedTask.id === msg.payload.id) {
        state.selectedTask = msg.payload;
        populateDrawer();
      }
      renderTasks();
    } else if (msg.type === 'TASK_DELETED') {
      state.tasks = state.tasks.filter(t => t.id !== msg.payload.id);
      renderTasks();
      if (state.selectedTask && state.selectedTask.id === msg.payload.id) closeDrawer();
    }
  });
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
}

function setupUI() {
  renderSidebar();
  renderTasks();
  
  // Quick add input
  const quickAdd = document.getElementById('quick-add-input');
  quickAdd.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && quickAdd.value.trim()) {
      const text = quickAdd.value.trim();
      let priority = 'P5';
      let assigneeId = null;
      let cleanedText = text;

      // Inline parsing
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

      await api.createTask({
        text: cleanedText.trim(),
        projectId: state.activeView === 'project' ? state.activeProjectId : 1, // Default inbox
        priority,
        assigneeId,
        dueDate: state.activeView === 'today' ? new Date().toISOString().split('T')[0] : null
      });
      quickAdd.value = '';
    }
  });

  // Drawer events
  document.getElementById('close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('task-notes').addEventListener('blur', (e) => {
    if (state.selectedTask) api.updateTask(state.selectedTask.id, { notes: e.target.value });
  });
  document.getElementById('task-priority').addEventListener('change', (e) => {
    if (state.selectedTask) api.updateTask(state.selectedTask.id, { priority: e.target.value });
  });
  document.getElementById('task-timeblock').addEventListener('change', (e) => {
    if (state.selectedTask) api.updateTask(state.selectedTask.id, { timeBlock: e.target.value });
  });
  document.getElementById('task-attachment').addEventListener('change', async (e) => {
    if (state.selectedTask && e.target.files[0]) {
      await api.uploadAttachment(state.selectedTask.id, e.target.files[0]);
    }
  });
}

function renderSidebar() {
  const container = document.getElementById('sidebar-projects');
  container.innerHTML = state.projects.map(p => `
    <div class="nav-item ${state.activeView === 'project' && state.activeProjectId === p.id ? 'active' : ''}" data-id="${p.id}">
      ${p.name}
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

function renderTasks() {
  const container = document.getElementById('main-list');
  const header = document.getElementById('main-header-title');

  if (state.activeView === 'today') {
    header.textContent = 'Today';
  } else {
    const p = state.projects.find(p => p.id === state.activeProjectId);
    header.textContent = p ? p.name : 'Inbox';
  }

  container.innerHTML = state.tasks.map(t => `
    <div class="task-item ${t.isCompleted ? 'completed' : ''}" data-id="${t.id}">
      <input type="checkbox" class="task-checkbox" ${t.isCompleted ? 'checked' : ''} />
      <span class="task-text">${t.text}</span>
      ${t.assigneeId ? `<span class="priority-badge" style="background:#888">${state.users.find(u=>u.id===t.assigneeId)?.initials || ''}</span>` : ''}
      <span class="priority-badge priority-${t.priority}">${t.priority}</span>
    </div>
  `).join('');

  container.querySelectorAll('.task-checkbox').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = e.target.closest('.task-item').getAttribute('data-id');
      api.updateTask(id, { isCompleted: e.target.checked ? 1 : 0 });
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
  document.getElementById('task-notes').value = t.notes || '';
  document.getElementById('task-priority').value = t.priority || 'P5';
  document.getElementById('task-timeblock').value = t.timeBlock || '';
  
  const link = document.getElementById('attachment-link');
  if (t.attachmentPath) {
    link.href = t.attachmentPath;
    link.textContent = 'View Attachment';
    link.style.display = 'block';
  } else {
    link.style.display = 'none';
  }
}
