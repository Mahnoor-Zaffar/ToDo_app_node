import { store } from '../store.js';

export function renderTaskList(container, onEditTask) {
  let draggedItem = null;

  const render = () => {
    const projectTodos = store.state.todos.filter(t => t.projectId === store.state.activeProjectId);
    
    if (projectTodos.length === 0) {
      container.innerHTML = `<div class="empty-state">No tasks here yet. Enjoy your day!</div>`;
      return;
    }

    container.innerHTML = `
      <ul class="todo-list" id="sortable-list">
        ${projectTodos.map(t => `
          <li class="todo-item ${t.completed ? 'completed' : ''}" draggable="true" data-id="${t.id}">
            <input type="checkbox" class="todo-checkbox" ${t.completed ? 'checked' : ''} />
            <div class="todo-content">
              <span class="todo-text">${t.text}</span>
              <div class="todo-badges">
                ${t.dueDate ? `<span class="todo-meta due-date">🗓 Due: ${new Date(t.dueDate).toLocaleDateString()}</span>` : ''}
                ${t.priority !== 'Medium' ? `<span class="todo-meta priority ${t.priority.toLowerCase()}">${t.priority} Priority</span>` : ''}
              </div>
            </div>
            <button class="edit-btn">Edit</button>
            <button class="delete-btn">Delete</button>
          </li>
        `).join('')}
      </ul>
    `;

    // Attach events
    container.querySelectorAll('.todo-item').forEach(item => {
      const id = item.getAttribute('data-id');
      
      // Checkbox
      item.querySelector('.todo-checkbox').addEventListener('change', (e) => {
        store.toggleTodo(id, e.target.checked);
      });

      // Delete
      item.querySelector('.delete-btn').addEventListener('click', () => {
        store.deleteTodo(id);
      });
      
      // Edit
      item.querySelector('.edit-btn').addEventListener('click', () => {
         const todo = store.state.todos.find(t => t.id === id);
         if (onEditTask) onEditTask(todo);
      });

      // Drag and drop
      item.addEventListener('dragstart', function(e) {
        draggedItem = this;
        setTimeout(() => this.classList.add('dragging'), 0);
      });

      item.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        draggedItem = null;
        
        // Save new order
        const list = document.getElementById('sortable-list');
        const orderedIds = Array.from(list.children).map(li => li.getAttribute('data-id'));
        store.reorderTodos(orderedIds);
      });
    });

    const list = container.querySelector('#sortable-list');
    if (list) {
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
          list.appendChild(draggedItem);
        } else {
          list.insertBefore(draggedItem, afterElement);
        }
      });
    }
  };

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
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

  store.addEventListener('change', render);
}
