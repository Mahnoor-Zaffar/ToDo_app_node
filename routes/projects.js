const express = require('express');
const router = express.Router();

let projects = [
  { id: 'proj_1', name: 'Inbox' }
];

router.get('/', (req, res) => res.json(projects));

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const newProject = { id: `proj_${Date.now()}`, name };
  projects.push(newProject);
  res.status(201).json(newProject);
});

router.delete('/:id', (req, res) => {
  projects = projects.filter(p => p.id !== req.params.id);
  res.status(204).send();
});

module.exports = router;
