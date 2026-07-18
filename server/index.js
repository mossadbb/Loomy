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

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER,
      receiverId INTEGER,
      text TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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
  // Get all messages where user is sender or receiver
  db.all('SELECT * FROM messages WHERE senderId = ? OR receiverId = ? ORDER BY timestamp ASC', [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Socket.io for Real-time
const connectedUsers = new Map(); // socket.id -> userId

io.on('connection', (socket) => {
  socket.on('register_user', (userId) => {
    connectedUsers.set(socket.id, userId);
    io.emit('user_online', userId);
  });

  socket.on('send_message', (data) => {
    // data: { senderId, receiverId, text }
    db.run('INSERT INTO messages (senderId, receiverId, text) VALUES (?, ?, ?)', [data.senderId, data.receiverId, data.text], function(err) {
      if (!err) {
        const msg = {
          id: this.lastID,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text,
          timestamp: new Date().toISOString()
        };
        // Broadcast to everyone (in a real app, send only to receiver and sender)
        io.emit('receive_message', msg);
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
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
