const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const users = {};

const handleNewUserJoined = (socket, name) => {
  users[socket.id] = name;
  socket.broadcast.emit('user-joined', name);
};

const handleSendMessage = (socket, message) => {
  const senderName = users[socket.id];
  socket.broadcast.emit('receive', { message, name: senderName });
};

const handleDisconnect = (socket) => {
  const userName = users[socket.id];
  socket.broadcast.emit('left', userName);
  delete users[socket.id];
};

io.on('connection', (socket) => {
  socket.on('new-user-joined', handleNewUserJoined.bind(null, socket));

  socket.on('send', handleSendMessage.bind(null, socket));

  socket.on('disconnect', handleDisconnect.bind(null, socket));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
