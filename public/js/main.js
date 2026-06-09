import { api, clientId, generateUUID } from './api.js';
import { initWebSocket } from './socket.js';
import { state } from './state.js';

let ws;
let quill;
let isDragging = false;
let draggedElementId = null;
let ghostNode = null;

const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, 
  tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
);

document.addEventListener('DOMContentLoaded', async () => {
  state.subscribe(() => {
    renderTasks();
    renderPresence();
    if (state.selectedTask) populateDrawer(); // Update drawer state dynamically if it changes
  });

  await loadInitialData();
  setupUI();
  setupDragAndDrop();
  
  ws = initWebSocket((msg) => {
    if (msg.clientId === clientId) return; // Prevent duplicate echo

    if (msg.action === 'CREATE' || msg.action === 'UPDATE') {
      state.acknowledgeTask(msg.payload);
    } else if (msg.action === 'DELETE') {
      state.removeTask(msg.payload.id);
    } else if (msg.type === 'PRESENCE_UPDATE') {
      state.updatePresence(msg.clientId, msg.payload);
    } else if (msg.type === 'PRESENCE_LEAVE') {
      state.removePresence(msg.clientId);
    }
  });

  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && state.currentUser) {
      ws.send(JSON.stringify({ type: 'PRESENCE_UPDATE', payload: { user: state.currentUser } }));
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
  state.setTasks(tasks);
  
  if (projects.length > 0) state.activeProjectId = projects[0].id;
  
  document.getElementById('current-user-name').textContent = me.name;
  document.getElementById('current-user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(me.name)}&background=random`;
  renderSidebar();
}

function setupUI() {
  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  });

  // View Toggles
  document.getElementById('toggle-view-btn').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'list' ? 'kanban' : 'list';
    renderTasks();
  });
  
  document.getElementById('view-today').addEventListener('click', async () => {
    state.activeView = 'today'; state.activeProjectId = null;
    const today = new Date().toISOString().split('T')[0];
    state.setTasks(await api.tasks({ date: today }));
    renderSidebar();
  });

  document.getElementById('view-inbox').addEventListener('click', async () => {
    state.activeView = 'inbox'; state.activeProjectId = null;
    state.setTasks(await api.tasks());
    renderSidebar();
  });

  // Regex Quick Add
  const quickAdd = document.getElementById('quick-add-input');
  const quickAddPreview = document.getElementById('quick-add-preview');
  
  quickAdd.addEventListener('input', () => {
    const val = quickAdd.value;
    let previewHTML = '';
    
    const pMatch = val.match(/!p([1-5])/i);
    if (pMatch) previewHTML += `<span class="chip" style="background:var(--priority-p${pMatch[1]}); color:var(--priority-p${pMatch[1]}-text)">Priority P${pMatch[1]}</span>`;
    
    const aMatch = val.match(/@(\w+)/);
    if (aMatch) previewHTML += `<span class="chip">Assignee: ${aMatch[1]}</span>`;

    const dMatch = val.match(/\/\/((\d{4}-\d{2}-\d{2})|(today|tomorrow))/i);
    if (dMatch) previewHTML += `<span class="chip">Due: ${dMatch[1]}</span>`;
    
    quickAddPreview.innerHTML = previewHTML;
  });

  quickAdd.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && quickAdd.value.trim()) {
      let text = quickAdd.value.trim();
      let priority = 'P5', assigneeId = null, dueDate = null;

      const pMatch = text.match(/!p([1-5])/i);
      if (pMatch) { priority = `P${pMatch[1]}`; text = text.replace(pMatch[0], ''); }
      
      const aMatch = text.match(/@(\w+)/);
      if (aMatch) {
        const u = state.users.find(u => u.initials.toLowerCase() === aMatch[1].toLowerCase());
        if (u) assigneeId = u.id;
        text = text.replace(aMatch[0], '');
      }

      const dMatch = text.match(/\/\/((\d{4}-\d{2}-\d{2})|(today|tomorrow))/i);
      if (dMatch) {
        if(dMatch[1] === 'today') dueDate = new Date().toISOString().split('T')[0];
        else if(dMatch[1] === 'tomorrow') { const d = new Date(); d.setDate(d.getDate()+1); dueDate = d.toISOString().split('T')[0]; }
        else dueDate = dMatch[1];
        text = text.replace(dMatch[0], '');
      }

      const tempTask = {
        uuid: generateUUID(),
        text: text.trim(),
        projectId: state.activeView === 'project' ? state.activeProjectId : null,
        priority, assigneeId, dueDate, status: 'todo', isCompleted: 0
      };
      
      quickAdd.value = '';
      quickAddPreview.innerHTML = '';
      
      state.addTaskOptimistically(tempTask);
      try {
        const res = await api.createTask(tempTask);
        state.acknowledgeTask(res);
      } catch (err) {
        state.removeTask(tempTask.uuid);
      }
    }
  });

  document.getElementById('close-drawer').addEventListener('click', () => {
    document.getElementById('right-drawer').classList.remove('open');
    state.selectedTask = null;
  });
  
  const handleOptimisticUpdate = (updates) => {
    if (state.selectedTask) {
      const id = state.selectedTask.id || state.selectedTask.uuid;
      state.mutateTaskOptimistically(id, updates);
      if(state.selectedTask.id) {
        api.updateTask(state.selectedTask.id, updates)
          .then(res => state.acknowledgeTask(res))
          .catch(err => {
            console.error('Update failed, rolling back state', err);
            api.tasks().then(tasks => state.setTasks(tasks));
          });
      }
    }
  };

  document.getElementById('task-title-input').addEventListener('blur', (e) => handleOptimisticUpdate({ text: e.target.value }));
  document.getElementById('task-priority').addEventListener('change', (e) => handleOptimisticUpdate({ priority: e.target.value }));
  document.getElementById('task-status').addEventListener('change', (e) => handleOptimisticUpdate({ status: e.target.value }));
  document.getElementById('task-duedate').addEventListener('change', (e) => handleOptimisticUpdate({ dueDate: e.target.value }));
  
  document.getElementById('delete-task-btn').addEventListener('click', () => {
    if (state.selectedTask && state.selectedTask.id) {
      const id = state.selectedTask.id;
      state.removeTask(id);
      document.getElementById('right-drawer').classList.remove('open');
      api.deleteTask(id);
    }
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
      state.setTasks(await api.tasks({ projectId: state.activeProjectId }));
      renderSidebar();
    });
  });
}

function createTaskHTML(t) {
  const uid = t.id || t.uuid;
  const syncClass = t.syncState === 'local-optimistic' ? 'syncing' : '';
  return `
    <div class="task-item ${t.isCompleted ? 'completed' : ''} ${syncClass}" data-id="${uid}" draggable="true">
      <input type="checkbox" class="task-checkbox" ${t.isCompleted ? 'checked' : ''} />
      <span class="task-text">${escapeHTML(t.text)}</span>
      ${t.assigneeId ? `<span class="priority-badge" style="background:#888">${state.users.find(u=>u.id===t.assigneeId)?.initials || ''}</span>` : ''}
      <span class="priority-badge priority-${t.priority}">${t.priority}</span>
    </div>
  `;
}

function renderTasks() {
  if (isDragging) return; // Don't interrupt drag UX

  const listView = document.getElementById('list-view');
  const kanbanView = document.getElementById('kanban-view');
  const header = document.getElementById('main-header-title');

  if (state.activeView === 'today') header.textContent = 'Today\'s Focus';
  else if (state.activeView === 'inbox') header.textContent = 'Inbox';
  else {
    const p = state.projects.find(p => p.id === state.activeProjectId);
    header.textContent = p ? p.name : 'Project';
  }

  if (state.viewMode === 'list') {
    listView.style.display = 'block'; kanbanView.style.display = 'none';
    listView.innerHTML = state.tasks.map(createTaskHTML).join('');
  } else {
    listView.style.display = 'none'; kanbanView.style.display = 'flex';
    document.querySelector('.kanban-dropzone[data-status="todo"]').innerHTML = state.tasks.filter(t => t.status === 'todo').map(createTaskHTML).join('');
    document.querySelector('.kanban-dropzone[data-status="in-progress"]').innerHTML = state.tasks.filter(t => t.status === 'in-progress').map(createTaskHTML).join('');
    document.querySelector('.kanban-dropzone[data-status="done"]').innerHTML = state.tasks.filter(t => t.status === 'done').map(createTaskHTML).join('');
  }

  attachTaskEvents(document.getElementById('main-content-area'));
}

function attachTaskEvents(container) {
  container.querySelectorAll('.task-checkbox').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = e.target.closest('.task-item').getAttribute('data-id');
      const realId = isNaN(id) ? id : parseInt(id);
      state.mutateTaskOptimistically(realId, { isCompleted: e.target.checked ? 1 : 0 });
      if(typeof realId === 'number') {
        api.updateTask(realId, { isCompleted: e.target.checked ? 1 : 0 })
          .then(res => state.acknowledgeTask(res))
          .catch(err => {
            console.error('Update failed, rolling back state', err);
            api.tasks().then(tasks => state.setTasks(tasks));
          });
      }
    });
  });

  container.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox')) return;
      const id = el.getAttribute('data-id');
      const realId = isNaN(id) ? id : parseInt(id);
      state.selectedTask = state.tasks.find(t => t.id === realId || t.uuid === realId);
      openDrawer();
    });
  });
}

function setupDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    if (e.target.classList && e.target.classList.contains('task-item')) {
      isDragging = true;
      draggedElementId = e.target.getAttribute('data-id');
      e.target.classList.add('dragging');
      
      ghostNode = document.createElement('div');
      ghostNode.className = 'ghost-placeholder';
      ghostNode.style.height = e.target.offsetHeight + 'px';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('task-item')) {
      isDragging = false;
      e.target.classList.remove('dragging');
      if (ghostNode && ghostNode.parentNode) ghostNode.parentNode.removeChild(ghostNode);
      renderTasks();
    }
  });

  document.querySelectorAll('.kanban-dropzone').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      if (!isDragging) return;
      
      const afterElement = getDragAfterElement(zone, e.clientY);
      if (afterElement == null) {
        zone.appendChild(ghostNode);
      } else {
        zone.insertBefore(ghostNode, afterElement);
      }
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      if (!isDragging) return;
      const status = zone.getAttribute('data-status');
      const realId = isNaN(draggedElementId) ? draggedElementId : parseInt(draggedElementId);
      
      if (realId && status) {
        state.mutateTaskOptimistically(realId, { status });
        if(typeof realId === 'number') {
           api.updateTask(realId, { status })
             .then(res => state.acknowledgeTask(res))
             .catch(err => {
               console.error('Drag drop failed, rolling back state', err);
               api.tasks().then(tasks => state.setTasks(tasks));
             });
        }
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function openDrawer() {
  document.getElementById('right-drawer').classList.add('open');
  populateDrawer();
}

let isPopulatingDrawer = false;

function populateDrawer() {
  if (!state.selectedTask) return;
  if (isPopulatingDrawer) return; // Prevent loop
  isPopulatingDrawer = true;
  
  const t = state.selectedTask;
  document.getElementById('task-title-input').value = t.text;
  document.getElementById('task-priority').value = t.priority || 'P5';
  document.getElementById('task-status').value = t.status || 'todo';
  document.getElementById('task-duedate').value = t.dueDate || '';
  
  // Decoupled safe Quill mounting
  document.getElementById('quill-container-wrapper').innerHTML = '<div id="quill-editor" style="background:var(--bg-primary); border-radius:var(--radius-sm); min-height:150px; border:1px solid var(--border-color);"></div>';
  quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Add details...',
    modules: { toolbar: [[{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['clean']] }
  });
  
  if (t.notes) {
     const cleanHTML = window.DOMPurify ? window.DOMPurify.sanitize(t.notes) : t.notes;
     quill.clipboard.dangerouslyPasteHTML(cleanHTML);
  }

  quill.on('text-change', () => {
    if (state.selectedTask && !isPopulatingDrawer) {
      const html = quill.root.innerHTML;
      const realId = state.selectedTask.id || state.selectedTask.uuid;
      state.mutateTaskOptimistically(realId, { notes: html });
      if(typeof realId === 'number') {
        api.updateTask(realId, { notes: html })
          .then(res => state.acknowledgeTask(res))
          .catch(err => {
            console.error('Note update failed, rolling back state', err);
            api.tasks().then(tasks => state.setTasks(tasks));
          });
      }
    }
  });

  isPopulatingDrawer = false;
}

function renderPresence() {
  const container = document.getElementById('avatar-track');
  const now = Date.now();
  const activeUsers = Object.values(state.presence).filter(p => now - p.time < 35000);
  
  if (activeUsers.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = activeUsers.slice(0, 3).map(p => `
    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.user.name)}&background=random" title="${escapeHTML(p.user.name)}" class="presence-avatar">
  `).join('');
  
  if (activeUsers.length > 3) {
    html += `<div class="presence-avatar" style="background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">+${activeUsers.length - 3}</div>`;
  }
  container.innerHTML = html;
}
