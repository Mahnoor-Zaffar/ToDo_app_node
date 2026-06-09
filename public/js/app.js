import { store } from './store.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderTaskList } from './components/TaskList.js';
import { renderTaskModal } from './components/TaskModal.js';
import { setupAlerts } from './components/Alerts.js';

document.addEventListener('DOMContentLoaded', async () => {
  const sidebarContainer = document.getElementById('sidebar-container');
  const mainListContainer = document.getElementById('main-list');
  const modalContainer = document.getElementById('modal-container');
  
  const taskModal = renderTaskModal(modalContainer);

  renderSidebar(sidebarContainer);
  renderTaskList(mainListContainer, (todo) => {
    taskModal.open(todo);
  });
  
  setupAlerts();

  // Add Todo Form
  const addForm = document.getElementById('add-todo-form');
  const addInput = document.getElementById('add-todo-input');
  
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = addInput.value.trim();
    if (text) {
      store.addTodo(text);
      addInput.value = '';
    }
  });

  // Initial load
  await store.loadAll();
});
