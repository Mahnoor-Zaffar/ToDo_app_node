import { api } from './api.js';

class Store extends EventTarget {
  constructor() {
    super();
    this.state = {
      todos: [],
      projects: [],
      tags: [],
      activeProjectId: 'proj_1' // Default Inbox
    };
  }

  async loadAll() {
    const [todos, projects, tags] = await Promise.all([
      api.getTodos(),
      api.getProjects(),
      api.getTags()
    ]);
    this.state.todos = todos;
    this.state.projects = projects;
    this.state.tags = tags;
    this.emitChange();
  }

  emitChange() {
    this.dispatchEvent(new Event('change'));
  }

  async addTodo(text, details = {}) {
    const newTodo = await api.createTodo({
      text,
      projectId: this.state.activeProjectId,
      ...details
    });
    this.state.todos.push(newTodo);
    this.emitChange();
  }

  async toggleTodo(id, completed) {
    const todo = this.state.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = completed;
      this.emitChange();
      await api.updateTodo(id, { completed });
    }
  }

  async updateTodo(id, updates) {
    const todoIndex = this.state.todos.findIndex(t => t.id === id);
    if (todoIndex > -1) {
      this.state.todos[todoIndex] = { ...this.state.todos[todoIndex], ...updates };
      this.emitChange();
      await api.updateTodo(id, updates);
    }
  }

  async deleteTodo(id) {
    this.state.todos = this.state.todos.filter(t => t.id !== id);
    this.emitChange();
    await api.deleteTodo(id);
  }

  async reorderTodos(orderedIds) {
    // Optimistic UI update
    orderedIds.forEach((id, index) => {
      const todo = this.state.todos.find(t => t.id === id);
      if (todo) todo.order = index;
    });
    this.state.todos.sort((a, b) => a.order - b.order);
    this.emitChange();
    await api.reorderTodos(orderedIds);
  }
  
  setActiveProject(projectId) {
    this.state.activeProjectId = projectId;
    this.emitChange();
  }
}

export const store = new Store();
