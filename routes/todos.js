const express = require('express');
const router = express.Router();

// In-memory data store
let todos = [];

// Get all todos
router.get('/', (req, res) => {
  // Sort by order
  const sortedTodos = [...todos].sort((a, b) => a.order - b.order);
  res.json(sortedTodos);
});

// Create a new todo
router.post('/', (req, res) => {
  try {
    const { text, dueDate, reminder, subtasks, repeating, projectId, tags, priority, notes } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const newTodo = {
      id: `todo_${Date.now()}`,
      text,
      completed: false,
      dueDate: dueDate || null,
      reminder: reminder || null,
      subtasks: subtasks || [],
      repeating: repeating || 'none',
      projectId: projectId || 'proj_1', // Default to inbox
      tags: tags || [],
      priority: priority || 'Medium',
      notes: notes || '',
      order: todos.length // append to end
    };
    
    todos.push(newTodo);
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update todo
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const todoIndex = todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    const updates = req.body;
    todos[todoIndex] = { ...todos[todoIndex], ...updates };
    
    res.json(todos[todoIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reorder todos (bulk update)
router.post('/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body; // array of IDs in new order
    if (!Array.isArray(orderedIds)) {
       return res.status(400).json({ error: 'orderedIds array required' });
    }

    orderedIds.forEach((id, index) => {
       const todo = todos.find(t => t.id === id);
       if (todo) todo.order = index;
    });

    res.json({ success: true });
  } catch(error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a todo
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const todoIndex = todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    todos.splice(todoIndex, 1);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
