const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { triggerWebhook } = require('../services/integrationService');

// Ultra-secure Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads/'))
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    cb(null, hash + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    // Basic MIME type validation
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  }
});

router.get('/', (req, res) => {
  try {
    const { projectId, date } = req.query;
    let tasks;
    if (projectId) {
      tasks = db.prepare('SELECT * FROM Tasks WHERE projectId = ?').all(projectId);
    } else if (date) {
      tasks = db.prepare('SELECT * FROM Tasks WHERE dueDate = ?').all(date);
    } else {
      tasks = db.prepare('SELECT * FROM Tasks').all();
    }
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task with UUID deduplication
router.post('/', (req, res) => {
  try {
    const { text, projectId, priority, dueDate, timeBlock, assigneeId, uuid } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    // Deduplication check
    if (uuid) {
      const existing = db.prepare('SELECT * FROM Tasks WHERE uuid = ?').get(uuid);
      if (existing) {
        return res.json(existing); // Return existing task acknowledging success
      }
    }

    const stmt = db.prepare(`
      INSERT INTO Tasks (text, projectId, priority, dueDate, timeBlock, assigneeId, status, uuid) 
      VALUES (?, ?, ?, ?, ?, ?, 'todo', ?)
    `);
    
    const info = stmt.run(text, projectId || null, priority || 'P5', dueDate || null, timeBlock || null, assigneeId || null, uuid || null);
    
    const newTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(info.lastInsertRowid);
    triggerWebhook(newTask, 'task.created');

    const clientId = req.headers['x-client-id'];
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_MUTATE', action: 'CREATE', payload: newTask, clientId });
    }

    res.status(201).json(newTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const task = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updates = req.body;
    const allowedFields = ['text', 'notes', 'priority', 'dueDate', 'timeBlock', 'isCompleted', 'assigneeId', 'status'];
    let setClauses = [];
    let params = [];
    
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (setClauses.length === 0) return res.json(task);

    params.push(id);
    db.prepare(`UPDATE Tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    const updatedTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    triggerWebhook(updatedTask, 'task.updated');

    const clientId = req.headers['x-client-id'];
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_MUTATE', action: 'UPDATE', payload: updatedTask, clientId });
    }

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete using explicit transaction wrapper from db.js
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    db.runTransaction(() => {
      db.prepare('DELETE FROM TaskTags WHERE taskId = ?').run(id);
      db.prepare('DELETE FROM Tasks WHERE id = ?').run(id);
    });

    const clientId = req.headers['x-client-id'];
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_MUTATE', action: 'DELETE', payload: { id: parseInt(id) }, clientId });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Attachment handling
router.post('/:id/attachment', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No valid file uploaded' });
    
    const { id } = req.params;
    const filePath = `/uploads/${req.file.filename}`;
    
    db.prepare('UPDATE Tasks SET attachmentPath = ? WHERE id = ?').run(filePath, id);
    const updatedTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    
    const clientId = req.headers['x-client-id'];
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_MUTATE', action: 'UPDATE', payload: updatedTask, clientId });
    }

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Error handling for Multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
