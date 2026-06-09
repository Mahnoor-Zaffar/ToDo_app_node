const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { triggerWebhook } = require('../services/integrationService');

// Setup multer for local file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads/'))
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, Date.now() + '-' + safeName);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPG, PNG, PDF, and TXT are allowed.'), false);
    }
    cb(null, true);
  }
});

function parseTags(text) {
  const tagRegex = /#(\w+)/g;
  let tags = [];
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

// Get all tasks (optionally filter by projectId or date)
router.get('/', (req, res) => {
  try {
    const { projectId, date } = req.query;
    let query = 'SELECT * FROM Tasks';
    let params = [];
    let conditions = [];

    if (projectId) {
      conditions.push('projectId = ?');
      params.push(projectId);
    }
    
    // For 'Today' view, filter by due date
    if (date) {
      conditions.push('dueDate = ?');
      params.push(date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create task
router.post('/', (req, res) => {
  try {
    const { text, projectId, priority, dueDate, timeBlock, assigneeId } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const info = db.prepare(`
      INSERT INTO Tasks (text, projectId, priority, dueDate, timeBlock, assigneeId) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(text, projectId || 1, priority || 'P5', dueDate || null, timeBlock || null, assigneeId || null);
    
    const newTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(info.lastInsertRowid);
    
    // Auto-extract tags
    const extractedTags = parseTags(text);
    extractedTags.forEach(tagName => {
      // insert or ignore tag
      db.prepare('INSERT OR IGNORE INTO Tags (name) VALUES (?)').run(tagName);
      const tag = db.prepare('SELECT id FROM Tags WHERE name = ?').get(tagName);
      if (tag) {
        db.prepare('INSERT OR IGNORE INTO TaskTags (taskId, tagId) VALUES (?, ?)').run(newTask.id, tag.id);
      }
    });

    triggerWebhook(newTask, 'task.created');

    // Broadcast WebSocket event
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_CREATED', payload: newTask });
    }

    res.status(201).json(newTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update task (mark complete, change priority, add notes, etc)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const task = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updates = req.body;
    const allowedFields = ['text', 'notes', 'priority', 'dueDate', 'timeBlock', 'isCompleted', 'assigneeId'];
    let setClauses = [];
    let params = [];
    
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }
    
    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields provided for update' });

    params.push(id);

    if (setClauses.length > 0) {
      db.prepare(`UPDATE Tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    }

    const updatedTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    triggerWebhook(updatedTask, 'task.updated');

    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_UPDATED', payload: updatedTask });
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload attachment
router.post('/:id/attachment', upload.single('file'), (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const attachmentPath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE Tasks SET attachmentPath = ? WHERE id = ?').run(attachmentPath, id);
    
    const updatedTask = db.prepare('SELECT * FROM Tasks WHERE id = ?').get(id);
    triggerWebhook(updatedTask, 'task.attachment_added');

    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_UPDATED', payload: updatedTask });
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM Tasks WHERE id = ?').run(id);
    
    triggerWebhook({ id }, 'task.deleted');

    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({ type: 'TASK_DELETED', payload: { id } });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
