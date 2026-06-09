export const api = {
  me: () => fetch('/api/auth/me').then(r => r.json()),
  users: () => fetch('/api/auth/users').then(r => r.json()),
  projects: () => fetch('/api/projects').then(r => r.json()),
  createProject: (name) => fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  }).then(r => r.json()),
  tasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`/api/tasks?${qs}`).then(r => r.json());
  },
  createTask: (data) => fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateTask: (id, updates) => fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  }).then(r => r.json()),
  deleteTask: (id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }),
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`/api/tasks/${id}/attachment`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());
  }
};
