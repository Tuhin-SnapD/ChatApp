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
const rooms = {
  'general': {
    name: 'General',
    users: new Set(),
    messages: []
  }
};
const typingUsers = new Map();
const messageReactions = new Map();

const handleNewUserJoined = (socket, name) => {
  // Sanitize the name
  const sanitizedName = name.replace(/[<>]/g, '').trim();
  
  if (!sanitizedName || sanitizedName.length < 2 || sanitizedName.length > 20) {
    socket.emit('error', 'Invalid name provided');
    return;
  }
  
  users[socket.id] = {
    name: sanitizedName,
    id: socket.id,
    currentRoom: 'general',
    isOnline: true,
    lastSeen: new Date(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sanitizedName)}`
  };
  
  // Add user to general room
  socket.join('general');
  rooms.general.users.add(socket.id);
  
  // Send user list to all clients
  const userList = Object.values(users).map(user => ({
    id: user.id,
    name: user.name,
    isOnline: user.isOnline,
    avatar: user.avatar,
    currentRoom: user.currentRoom
  }));
  
  io.emit('user-list-update', userList);
  socket.broadcast.emit('user-joined', name);
  
  // Send recent messages from the general room
  socket.emit('room-messages', {
    roomId: 'general',
    messages: rooms.general.messages.slice(-50) // Last 50 messages
  });
};

const handleSendMessage = (socket, data) => {
  const sender = users[socket.id];
  if (!sender) return;
  
  const { message, roomId = 'general', replyTo = null, file = null } = data;
  
  // Sanitize message content
  const sanitizedMessage = message.replace(/[<>]/g, '').trim();
  if (!sanitizedMessage) {
    socket.emit('error', 'Message cannot be empty');
    return;
  }
  
  const messageData = {
    id: Date.now() + Math.random(),
    message: sanitizedMessage,
    sender: {
      id: sender.id,
      name: sender.name,
      avatar: sender.avatar
    },
    roomId,
    timestamp: new Date(),
    replyTo,
    file,
    reactions: {}
  };
  
  // Store message in room
  if (rooms[roomId]) {
    rooms[roomId].messages.push(messageData);
    // Keep only last 50 messages per room to prevent memory issues
    if (rooms[roomId].messages.length > 50) {
      rooms[roomId].messages = rooms[roomId].messages.slice(-50);
    }
  }
  
  // Emit to room
  io.to(roomId).emit('receive', messageData);
  
  // Clear typing indicator
  if (typingUsers.has(socket.id)) {
    typingUsers.delete(socket.id);
    socket.to(roomId).emit('typing-stop', sender.name);
  }
};



const handleTyping = (socket, data) => {
  const sender = users[socket.id];
  if (!sender) return;
  
  const { roomId = 'general', isTyping } = data;
  
  if (isTyping) {
    typingUsers.set(socket.id, { roomId, name: sender.name });
    socket.to(roomId).emit('typing-start', sender.name);
  } else {
    typingUsers.delete(socket.id);
    socket.to(roomId).emit('typing-stop', sender.name);
  }
};

const handleReaction = (socket, data) => {
  const { messageId, reaction, roomId = 'general' } = data;
  const sender = users[socket.id];
  
  if (!messageReactions.has(messageId)) {
    messageReactions.set(messageId, {});
  }
  
  const reactions = messageReactions.get(messageId);
  if (!reactions[sender.id]) {
    reactions[sender.id] = [];
  }
  
  // Remove existing reaction from this user if it exists
  reactions[sender.id] = reactions[sender.id].filter(r => r !== reaction);
  
  // Add new reaction
  reactions[sender.id].push(reaction);
  
  io.to(roomId).emit('message-reaction', {
    messageId,
    reactions: reactions,
    user: sender.name
  });
};









const handleDisconnect = (socket) => {
  const user = users[socket.id];
  if (!user) return;
  
  user.isOnline = false;
  user.lastSeen = new Date();
  
  // Remove from current room
  if (rooms[user.currentRoom]) {
    rooms[user.currentRoom].users.delete(socket.id);
  }
  
  // Remove typing indicator
  typingUsers.delete(socket.id);
  
  // Update user list
  const userList = Object.values(users).map(u => ({
    id: u.id,
    name: u.name,
    isOnline: u.isOnline,
    avatar: u.avatar,
    currentRoom: u.currentRoom
  }));
  
  socket.broadcast.emit('user-left', user.name);
  io.emit('user-list-update', userList);
  
  // Don't delete user immediately, keep for offline status
  setTimeout(() => {
    if (users[socket.id] && !users[socket.id].isOnline) {
      delete users[socket.id];
      const updatedUserList = Object.values(users).map(u => ({
        id: u.id,
        name: u.name,
        isOnline: u.isOnline,
        avatar: u.avatar,
        currentRoom: u.currentRoom
      }));
      io.emit('user-list-update', updatedUserList);
    }
  }, 300000); // Remove after 5 minutes
};

io.on('connection', (socket) => {
  socket.on('new-user-joined', (name) => handleNewUserJoined(socket, name));
  socket.on('send', (data) => handleSendMessage(socket, data));
  socket.on('typing', (data) => handleTyping(socket, data));
  socket.on('reaction', (data) => handleReaction(socket, data));
  socket.on('disconnect', () => handleDisconnect(socket));
  

});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
