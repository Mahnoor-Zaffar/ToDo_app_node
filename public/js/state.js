export class StateManager {
  constructor() {
    this.currentUser = null;
    this.users = [];
    this.projects = [];
    this.tasks = []; // Array of tasks
    this.activeProjectId = null;
    this.activeView = 'inbox'; // 'inbox', 'today', 'project'
    this.viewMode = 'list'; // 'list' or 'kanban'
    this.selectedTask = null;
    this.presence = {}; // { clientId: { user, timestamp } }
    
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(l => l(this));
  }

  setTasks(tasks) {
    this.tasks = tasks.map(t => ({ ...t, syncState: 'server-acknowledged' }));
    this.notify();
  }

  mutateTaskOptimistically(id, updates) {
    const idx = this.tasks.findIndex(t => t.id === id || t.uuid === id);
    if (idx > -1) {
      this.tasks[idx] = { ...this.tasks[idx], ...updates, syncState: 'local-optimistic' };
      if (this.selectedTask && (this.selectedTask.id === id || this.selectedTask.uuid === id)) {
        this.selectedTask = this.tasks[idx];
      }
      this.notify();
    }
  }

  addTaskOptimistically(task) {
    this.tasks.push({ ...task, syncState: 'local-optimistic' });
    this.notify();
  }

  acknowledgeTask(payload) {
    const idx = this.tasks.findIndex(t => t.uuid === payload.uuid || t.id === payload.id);
    if (idx > -1) {
      this.tasks[idx] = { ...payload, syncState: 'server-acknowledged' };
    } else {
      this.tasks.push({ ...payload, syncState: 'server-acknowledged' });
    }
    
    if (this.selectedTask && (this.selectedTask.uuid === payload.uuid || this.selectedTask.id === payload.id)) {
      this.selectedTask = this.tasks[idx] || payload;
    }
    this.notify();
  }

  removeTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id && t.uuid !== id);
    if (this.selectedTask && (this.selectedTask.id === id || this.selectedTask.uuid === id)) {
      this.selectedTask = null;
    }
    this.notify();
  }

  updatePresence(clientId, payload) {
    this.presence[clientId] = { user: payload.user, time: Date.now() };
    this.notify();
  }

  removePresence(clientId) {
    delete this.presence[clientId];
    this.notify();
  }
}

export const state = new StateManager();
