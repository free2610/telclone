const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// SQLite ma'lumotlar bazasini sozlash
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Ma\'lumotlar bazasi xatosi:', err.message);
  } else {
    console.log('SQLite ma\'lumotlar bazasiga ulandi');
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      text TEXT,
      timestamp INTEGER,
      socketId TEXT
    )`);
  }
});

// Statik fayllarni 'public' papkasidan xizmat qilish
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO ulanishlarni boshqarish
io.on('connection', (socket) => {
  console.log('Foydalanuvchi ulandi:', socket.id);

  // Eski xabarlarni yuborish
  db.all('SELECT * FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
    if (err) {
      console.error('Xabarlarni olish xatosi:', err.message);
      return;
    }
    socket.emit('loadMessages', rows);
  });

  // Yangi xabar qabul qilish
  socket.on('chatMessage', (data) => {
    const { username, text, timestamp } = data;
    db.run(
      'INSERT INTO messages (username, text, timestamp, socketId) VALUES (?, ?, ?, ?)',
      [username, text, timestamp, socket.id],
      (err) => {
        if (err) {
          console.error('Xabarni saqlash xatosi:', err.message);
          return;
        }
        db.get('SELECT last_insert_rowid() as id', (err, row) => {
          if (err) return;
          const message = { id: row.id, username, text, timestamp, socketId: socket.id };
          io.emit('chatMessage', message);
        });
      }
    );
  });

  // Xabar o'chirish
  socket.on('deleteMessage', (messageId) => {
    db.get('SELECT socketId FROM messages WHERE id = ?', [messageId], (err, row) => {
      if (err) {
        console.error('Xabar o\'chirish xatosi:', err.message);
        return;
      }
      if (row && row.socketId === socket.id) {
        db.run('DELETE FROM messages WHERE id = ?', [messageId], (err) => {
          if (err) {
            console.error('Xabar o\'chirish xatosi:', err.message);
            return;
          }
          io.emit('messageDeleted', messageId);
        });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Foydalanuvchi uzildi:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portida ishlamoqda`);
});
