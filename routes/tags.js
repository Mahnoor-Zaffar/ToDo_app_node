const express = require('express');
const router = express.Router();

let tags = [];

router.get('/', (req, res) => res.json(tags));

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const newTag = { id: `tag_${Date.now()}`, name, color: color || '#ccc' };
  tags.push(newTag);
  res.status(201).json(newTag);
});

router.delete('/:id', (req, res) => {
  tags = tags.filter(t => t.id !== req.params.id);
  res.status(204).send();
});

module.exports = router;
