const express = require('express');
const router = express.Router();
const db = require('../db');

// Simulate getting current user session
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    // In a real app, verify JWT here. We simulate it by checking for a specific mock token.
    if (!authHeader || !authHeader.startsWith('Bearer mock-jwt-token')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // For now, always return the first user (Admin User)
    const user = db.prepare('SELECT * FROM Users LIMIT 1').get();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all available assignees
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM Users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
