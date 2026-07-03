# Apex Tasks Dashboard

A highly-optimized, production-ready, real-time Task Management Dashboard built entirely with Node.js, Express, SQLite, and Vanilla ES6+ without heavy external frameworks. 

![Dashboard Preview](./screenshot.png)

## Elite Features

### 🚀 Zero-Latency Optimistic UI
A custom Vanilla JS State Machine ensures that UI interactions happen instantly. Tasks are immediately rendered locally (`local-optimistic` state) and seamlessly sync with the server (`server-acknowledged` state) in the background.

### 🌐 High-Performance WebSockets
Real-time collaboration is powered by native `ws` WebSockets.
- **Bi-directional Heartbeat**: Implements a 30-second ping/pong protocol to gracefully handle disconnects.
- **Idempotency & Deduplication**: Client-side generated UUIDs prevent duplicate task creations on spotty networks.
- **Live Presence Engine**: Absolute-positioned avatar tracks (`+3 others`) animate smoothly when users enter or leave the workspace.

### 🎯 Native HTML5 Kanban Drag-and-Drop
Say goodbye to heavy, clunky drag-and-drop libraries. This implementation uses native HTML5 `dragstart`, `dragover`, `drop`, and `dragend` events.
- **Ghost Drop-Zones**: Visual placeholder "ghost" containers inject themselves exactly where the card will land.
- **Smooth Animations**: Uses CSS transforms and tilt transitions (`transform: rotate(2deg) scale(1.02)`) while dragging.

### ⚡ RegEx Quick Add Engine
The Quick Add input parses shorthand syntax instantly. Typing `!p1`, `@User`, or `//today` dynamically injects visual UI chips beneath the input bar *before* submission, allowing for ultra-fast data entry.

### 🛡️ Production-Ready Backend
- **Optimized SQLite**: Multi-table deletions and cascading updates are wrapped in explicit database transactions (`db.transaction()`). Schema tables utilize explicit `CREATE INDEX` parameters for ultra-fast row lookups.
- **Hardened File Uploads**: `multer` configuration strictly limits files to 5MB, verifies Magic Byte/MIME types (JPEG/PNG/PDF only), and sanitizes all filenames using `crypto.randomBytes` hashes to prevent directory traversal vulnerabilities.
- **Quill.js Memory Safety**: The rich text editor instances are cleanly decoupled and destroyed upon drawer closure to prevent DOM memory leaks.

## Installation

1. Clone the repository and run `npm install`.
2. Start the server with `node server.js`.
3. Navigate to `http://localhost:3000`.

## Architecture & Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`better-sqlite3`) with explicit transactional boundaries
- **Realtime Sync**: `ws` Native WebSockets
- **Frontend State**: Modular Vanilla JS (`state.js`)
- **Styling**: Strict CSS Variable Tokens system with built-in Light/Dark mode toggling.
