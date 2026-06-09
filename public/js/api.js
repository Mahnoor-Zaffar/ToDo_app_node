export const api = {
  getTodos: () => fetch('/api/todos').then(res => res.json()),
  createTodo: (data) => fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  updateTodo: (id, data) => fetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  deleteTodo: (id) => fetch(`/api/todos/${id}`, { method: 'DELETE' }),
  reorderTodos: (orderedIds) => fetch('/api/todos/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds })
  }).then(res => res.json()),
  
  getProjects: () => fetch('/api/projects').then(res => res.json()),
  getTags: () => fetch('/api/tags').then(res => res.json())
};
