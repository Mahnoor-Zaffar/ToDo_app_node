# Task Management Dashboard

A full-featured, collaborative Task Management Dashboard built with Node.js, Express, SQLite, and WebSockets.

![Dashboard Preview](./screenshot.png)

## Features

- **Optimistic UI**: Immediate UI updates (0ms latency) that sync silently in the background.
- **Real-Time Presence**: WebSockets sync changes and display live avatars for active collaborators.
- **Kanban Drag-and-Drop**: Easily switch between List and Kanban views and natively drag tasks across statuses.
- **Rich Text Editor**: A built-in Notion-style block editor (via Quill.js) for task notes.
- **Quick Add Parsing**: Create tasks quickly with inline priorities (`!p1`) and assignees (`@JD`).
- **File Attachments**: Local file uploads using `multer`.
- **Zero Configuration**: Uses `better-sqlite3` so no external database servers are required.

## Installation

1. `npm install`
2. `node server.js`
3. Navigate to `http://localhost:3000`

## Architecture

- **Backend**: Node.js + Express
- **Database**: SQLite3 (`better-sqlite3`)
- **Realtime**: `ws` native WebSockets
- **Frontend**: Vanilla ES6+, Modular CSS3
