const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// SQLite setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      bio TEXT,
      isAdmin BOOLEAN DEFAULT 0
    )
  `);

  // Add isAdmin and achievements columns to existing table if they don't exist
  db.run(`ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT 0`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN achievements TEXT DEFAULT '["beta"]'`, (err) => {});

  // Add columns to messages table if they don't exist
  db.run(`ALTER TABLE messages ADD COLUMN groupId INTEGER`, (err) => {});
  db.run(`ALTER TABLE messages ADD COLUMN metadata TEXT`, (err) => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER,
      receiverId INTEGER,
      groupId INTEGER,
      text TEXT,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      ownerId INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      groupId INTEGER,
      userId INTEGER,
      PRIMARY KEY (groupId, userId)
    )
  `);
});

// System Bot User Mock
const SYSTEM_BOT = {
  id: 0,
  username: 'loomysupport',
  name: 'Loomy Support',
  bio: 'Официальный аккаунт поддержки',
  isAdmin: 0,
  achievements: '[]'
};

// API Routes
app.post('/api/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  const defaultName = name || username;
  const isAdmin = username.toLowerCase() === 'zell' ? 1 : 0;
  const initialAchievements = '["beta"]';
  
  db.run('INSERT INTO users (username, password, name, bio, isAdmin, achievements) VALUES (?, ?, ?, ?, ?, ?)', 
    [username, password, defaultName, 'Привет, я использую Loomy!', isAdmin, initialAchievements], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      
      const newUserId = this.lastID;
      
      // Auto-insert welcome message from SYSTEM_BOT
      const welcomeText = `Привет! Спасибо за регистрацию в открытом бета-тесте Loomy. Если тебе нравится проект и ты хочешь поддержать его материально, напиши нашему администратору (@zell). Желаем приятного общения!`;
      db.run('INSERT INTO messages (senderId, receiverId, text) VALUES (?, ?, ?)', [SYSTEM_BOT.id, newUserId, welcomeText]);

      res.json({ id: newUserId, username, name: defaultName, bio: 'Привет, я использую Loomy!', isAdmin, achievements: initialAchievements });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT id, username, name, bio, isAdmin, achievements FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(row);
  });
});

app.get('/api/users/contacts/:userId', (req, res) => {
  const userId = req.params.userId;
  // Get users who have exchanged messages with this user
  const query = `
    SELECT DISTINCT u.id, u.username, u.name, u.bio, u.isAdmin, u.achievements
    FROM users u
    JOIN messages m ON (u.id = m.senderId OR u.id = m.receiverId)
    WHERE u.id != ? AND (m.senderId = ? OR m.receiverId = ?)
  `;
  db.all(query, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Check if there's a message from System Bot
    db.get('SELECT 1 FROM messages WHERE (senderId = 0 AND receiverId = ?) OR (senderId = ? AND receiverId = 0) LIMIT 1', [userId, userId], (err, botMsg) => {
      if (botMsg) {
        rows.unshift(SYSTEM_BOT); // Add bot to contacts list
      }
      res.json(rows);
    });
  });
});

app.get('/api/users/search', (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  
  db.all('SELECT id, username, name, bio, isAdmin, achievements FROM users WHERE username LIKE ? LIMIT 10', [`%${q}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/profile', (req, res) => {
  const { id, name, bio } = req.body;
  db.run('UPDATE users SET name = ?, bio = ? WHERE id = ?', [name, bio, id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
  });
});

app.post('/api/admin/grant', (req, res) => {
  const { adminUsername, targetUserId, achievement } = req.body;
  if (adminUsername.toLowerCase() !== 'zell') return res.status(403).json({ error: 'Forbidden' });
  
  db.get('SELECT achievements FROM users WHERE id = ?', [targetUserId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'User not found' });
    
    let achievements = [];
    try { achievements = JSON.parse(row.achievements || '[]'); } catch (e) {}
    
    if (!achievements.includes(achievement)) {
      achievements.push(achievement);
    }
    
    db.run('UPDATE users SET achievements = ? WHERE id = ?', [JSON.stringify(achievements), targetUserId], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, achievements: JSON.stringify(achievements) });
    });
  });
});

app.get('/api/messages/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all('SELECT * FROM messages WHERE senderId = ? OR receiverId = ? OR groupId IN (SELECT groupId FROM group_members WHERE userId = ?) ORDER BY timestamp ASC', [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    })));
  });
});

app.post('/api/groups/create', (req, res) => {
  const { name, ownerId, members } = req.body;
  if (!name || !ownerId) return res.status(400).json({ error: 'Missing name or owner' });
  
  db.run('INSERT INTO groups (name, ownerId) VALUES (?, ?)', [name, ownerId], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    const groupId = this.lastID;
    
    // Insert members
    const allMembers = [...new Set([...members, ownerId])];
    const stmt = db.prepare('INSERT INTO group_members (groupId, userId) VALUES (?, ?)');
    allMembers.forEach(userId => stmt.run(groupId, userId));
    stmt.finalize();
    
    res.json({ id: groupId, name, ownerId, isGroup: true, members: allMembers });
  });
});

app.get('/api/groups/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all(`
    SELECT g.id, g.name, g.ownerId, 1 as isGroup, 
           (SELECT json_group_array(userId) FROM group_members WHERE groupId = g.id) as members
    FROM groups g 
    JOIN group_members gm ON g.id = gm.groupId 
    WHERE gm.userId = ?
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(r => ({ ...r, members: JSON.parse(r.members || '[]'), username: r.name, bio: 'Групповой чат' })));
  });
});

app.post('/api/groups/addMember', (req, res) => {
  const { groupId, userId } = req.body;
  db.run('INSERT OR IGNORE INTO group_members (groupId, userId) VALUES (?, ?)', [groupId, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
  });
});

// Socket.io for Real-time
const connectedUsers = new Map(); // socket.id -> userId

io.on('connection', (socket) => {
  socket.on('register_user', (userId) => {
    connectedUsers.set(socket.id, userId);
    io.emit('user_online', userId);
    
    db.all('SELECT groupId FROM group_members WHERE userId = ?', [userId], (err, rows) => {
      if (!err && rows) {
        rows.forEach(r => socket.join(`group_${r.groupId}`));
      }
    });
  });

  socket.on('send_message', (data) => {
    db.run('INSERT INTO messages (senderId, receiverId, groupId, text, metadata) VALUES (?, ?, ?, ?, ?)', 
      [data.senderId, data.receiverId || null, data.groupId || null, data.text, data.metadata ? JSON.stringify(data.metadata) : null], 
      function(err) {
      if (!err) {
        const msg = {
          id: this.lastID,
          senderId: data.senderId,
          receiverId: data.receiverId,
          groupId: data.groupId,
          text: data.text,
          metadata: data.metadata,
          timestamp: new Date().toISOString()
        };
        if (data.groupId) {
          io.to(`group_${data.groupId}`).emit('receive_message', msg);
        } else {
          io.emit('receive_message', msg);
        }
      }
    });
  });

  socket.on('update_message', (data) => {
    // data: { id, metadata }
    db.run('UPDATE messages SET metadata = ? WHERE id = ?', [data.metadata ? JSON.stringify(data.metadata) : null, data.id], function(err) {
      if (!err) {
        io.emit('message_updated', data); // Broadcast update
      }
    });
  });

  socket.on('delete_message', (msgId) => {
    db.run('DELETE FROM messages WHERE id = ?', [msgId], function(err) {
      if (!err) {
        io.emit('message_deleted', msgId);
      }
    });
  });

  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    if (userId) {
      // Check if user has other active sockets before marking offline (simplified here)
      io.emit('user_offline', userId);
    }
  });
});

// Serve static frontend files for production
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback for React Router (must be after API routes)
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
