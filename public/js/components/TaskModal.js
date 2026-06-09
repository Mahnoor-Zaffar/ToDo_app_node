import { store } from '../store.js';

export function renderTaskModal(container) {
  container.innerHTML = `
    <div class="modal-overlay hidden" id="task-modal">
      <div class="modal-content">
        <h2>Edit Task</h2>
        <form id="edit-task-form">
          <input type="hidden" id="edit-id" />
          
          <div class="form-group">
            <label>Task</label>
            <input type="text" id="edit-text" required />
          </div>
          
          <div class="form-group">
            <label>Notes</label>
            <textarea id="edit-notes" rows="3" placeholder="Add extra details or notes..."></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="edit-dueDate" />
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select id="edit-priority">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
             <label>Reminder (Date & Time)</label>
             <input type="datetime-local" id="edit-reminder" />
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn-cancel" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn-save">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#task-modal');
  const form = container.querySelector('#edit-task-form');

  container.querySelector('#btn-cancel-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    store.updateTodo(id, {
      text: document.getElementById('edit-text').value,
      notes: document.getElementById('edit-notes').value,
      dueDate: document.getElementById('edit-dueDate').value || null,
      priority: document.getElementById('edit-priority').value,
      reminder: document.getElementById('edit-reminder').value || null
    });
    
    modal.classList.add('hidden');
  });

  return {
    open: (todo) => {
      document.getElementById('edit-id').value = todo.id;
      document.getElementById('edit-text').value = todo.text;
      document.getElementById('edit-notes').value = todo.notes || '';
      document.getElementById('edit-dueDate').value = todo.dueDate ? todo.dueDate.substring(0,10) : '';
      document.getElementById('edit-priority').value = todo.priority || 'Medium';
      document.getElementById('edit-reminder').value = todo.reminder ? todo.reminder.substring(0,16) : '';
      modal.classList.remove('hidden');
    }
  };
}
