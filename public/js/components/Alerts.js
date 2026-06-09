import { store } from '../store.js';

export function setupAlerts() {
  setInterval(() => {
    const now = new Date();
    store.state.todos.forEach(t => {
      if (!t.completed && t.reminder) {
        const reminderTime = new Date(t.reminder);
        // If reminder is within the last minute
        if (now >= reminderTime && (now - reminderTime) < 60000) {
           alert(`Reminder: ${t.text}`);
           // clear reminder to prevent multiple alerts
           store.updateTodo(t.id, { reminder: null });
        }
      }
    });
  }, 30000); // check every 30s
}
