import { store } from '../store.js';

export function renderSidebar(container) {
  const render = () => {
    container.innerHTML = `
      <div class="sidebar-section">
        <h3>Projects</h3>
        <ul class="nav-list">
          ${store.state.projects.map(p => `
            <li class="nav-item ${p.id === store.state.activeProjectId ? 'active' : ''}" data-id="${p.id}">
              ${p.name}
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="sidebar-section" style="margin-top: 2rem;">
        <h3>Tags</h3>
        <ul class="nav-list tags-list">
          ${store.state.tags.length ? store.state.tags.map(t => `
            <li class="nav-item">
              <span class="tag-color" style="background:${t.color}"></span> ${t.name}
            </li>
          `).join('') : '<li class="nav-item empty">No tags yet</li>'}
        </ul>
      </div>
    `;

    // Event listeners
    container.querySelectorAll('.nav-item[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        store.setActiveProject(el.getAttribute('data-id'));
      });
    });
  };

  store.addEventListener('change', render);
  render(); // Initial render
}
