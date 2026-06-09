export const clientId = Math.random().toString(36).substring(2, 15);

export const api = {
  me: () => fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer mock-jwt-token' } }).then(r => {
    if (!r.ok) throw new Error('Unauthorized');
    return r.json();
  }),
  users: () => fetch('/api/auth/users').then(r => r.json()),
  projects: () => fetch('/api/projects').then(r => r.json()),
  createProject: (name) => fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
    body: JSON.stringify({ name })
  }).then(r => r.json()),
  tasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`/api/tasks?${qs}`).then(r => r.json());
  },
  createTask: (data) => fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateTask: (id, updates) => fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
    body: JSON.stringify(updates)
  }).then(r => r.json()),
  deleteTask: (id) => fetch(`/api/tasks/${id}`, { 
    method: 'DELETE',
    headers: { 'x-client-id': clientId } 
  }),
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`/api/tasks/${id}/attachment`, {
      method: 'POST',
      headers: { 'x-client-id': clientId },
      body: formData
    }).then(r => r.json());
  }
};
