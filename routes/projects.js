const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM Projects').all();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const info = db.prepare('INSERT INTO Projects (name) VALUES (?)').run(name);
    const newProj = db.prepare('SELECT * FROM Projects WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newProj);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
