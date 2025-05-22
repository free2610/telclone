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
      timestamp INTEGER
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
    // Xabarni SQLite'ga saqlash
    db.run(
      'INSERT INTO messages (username, text, timestamp) VALUES (?, ?, ?)',
      [username, text, timestamp],
      (err) => {
        if (err) {
          console.error('Xabarni saqlash xatosi:', err.message);
          return;
        }
        // Barcha ulangan foydalanuvchilarga xabar yuborish
        io.emit('chatMessage', { username, text, timestamp });
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('Foydalanuvchi uzildi:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portida ishlamoqda`);
});