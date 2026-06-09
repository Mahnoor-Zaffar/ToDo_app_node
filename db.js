const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    initials TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    notes TEXT,
    priority TEXT DEFAULT 'P5',
    dueDate TEXT,
    timeBlock TEXT,
    projectId INTEGER,
    assigneeId INTEGER,
    attachmentPath TEXT,
    isCompleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'todo',
    FOREIGN KEY(projectId) REFERENCES Projects(id),
    FOREIGN KEY(assigneeId) REFERENCES Users(id)
  );

  CREATE TABLE IF NOT EXISTS Tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS TaskTags (
    taskId INTEGER,
    tagId INTEGER,
    PRIMARY KEY (taskId, tagId),
    FOREIGN KEY(taskId) REFERENCES Tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(tagId) REFERENCES Tags(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON Tasks(projectId);
  CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON Tasks(dueDate);
`);

// Seed default data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO Users (name, initials) VALUES (?, ?)').run('Admin User', 'AU');
  db.prepare('INSERT INTO Users (name, initials) VALUES (?, ?)').run('John Doe', 'JD');
  
  const projInsert = db.prepare('INSERT INTO Projects (name) VALUES (?)');
  projInsert.run('Inbox');
  projInsert.run('Work');
  projInsert.run('Personal');
}

module.exports = db;
