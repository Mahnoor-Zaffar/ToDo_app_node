const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const projectRoutes = require('./routes/projects');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Initialize HTTP server and WebSockets
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PRESENCE') {
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    } catch(err) {}
  });
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// Provide broadcast function to Express routes
app.locals.broadcast = (data) => {
  const message = JSON.stringify(data);
  const clients = Array.from(wss.clients);
  
  function sendChunk(startIndex) {
    const chunkSize = 100;
    const end = Math.min(startIndex + chunkSize, clients.length);
    for (let i = startIndex; i < end; i++) {
      const client = clients[i];
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
    if (end < clients.length) {
      setImmediate(() => sendChunk(end));
    }
  }
  
  if (clients.length > 0) {
    sendChunk(0);
  }
};

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
