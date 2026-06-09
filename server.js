const express = require('express');
const path = require('path');
const todoRoutes = require('./routes/todos');
const projectRoutes = require('./routes/projects');
const tagRoutes = require('./routes/tags');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/todos', todoRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tags', tagRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
