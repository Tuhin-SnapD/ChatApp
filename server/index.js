
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

// Improved sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

const handleNewUserJoined = (socket, name) => {
  try {
    // Sanitize the name
    const sanitizedName = sanitizeInput(name);
    
    if (!sanitizedName || sanitizedName.length < 2 || sanitizedName.length > 20) {
      socket.emit('error', 'Invalid name provided');
      return;
    }
    
    // Check if name is already taken
    const existingUser = Object.values(users).find(user => user.name === sanitizedName);
    if (existingUser) {
      socket.emit('error', 'Name is already taken. Please choose another name.');
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
    socket.broadcast.emit('user-joined', sanitizedName);
    
    // Send recent messages from the general room
    socket.emit('room-messages', {
      roomId: 'general',
      messages: rooms.general.messages.slice(-50) // Last 50 messages
    });
  } catch (error) {
    console.error('Error in handleNewUserJoined:', error);
    socket.emit('error', 'An error occurred while joining. Please try again.');
  }
};

const handleSendMessage = (socket, data) => {
  try {
    const sender = users[socket.id];
    if (!sender) {
      socket.emit('error', 'You are not authenticated');
      return;
    }
    
    const { message, roomId = 'general', replyTo = null, file = null } = data;
    
    // Sanitize message content
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
      socket.emit('error', 'Message cannot be empty');
      return;
    }
    
    // Validate file if present
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        socket.emit('error', 'File size too large. Maximum size is 5MB.');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/'];
      const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
      if (!isAllowedType) {
        socket.emit('error', 'File type not allowed');
        return;
      }
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
      replyTo: replyTo ? sanitizeInput(replyTo) : null,
      file,
      reactions: {}
    };
    
    // Store message in room
    if (rooms[roomId]) {
      rooms[roomId].messages.push(messageData);
      // Keep only last 100 messages per room to prevent memory issues
      if (rooms[roomId].messages.length > 100) {
        rooms[roomId].messages = rooms[roomId].messages.slice(-100);
      }
    }
    
    // Emit to room
    io.to(roomId).emit('receive', messageData);
    
    // Clear typing indicator
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      socket.to(roomId).emit('typing-stop', sender.name);
    }
  } catch (error) {
    console.error('Error in handleSendMessage:', error);
    socket.emit('error', 'An error occurred while sending message. Please try again.');
  }
};

const handleTyping = (socket, data) => {
  try {
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
  } catch (error) {
    console.error('Error in handleTyping:', error);
  }
};

const handleReaction = (socket, data) => {
  try {
    const { messageId, reaction, roomId = 'general' } = data;
    const sender = users[socket.id];
    
    if (!sender) {
      socket.emit('error', 'You are not authenticated');
      return;
    }
    
    // Validate reaction
    const validReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    if (!validReactions.includes(reaction)) {
      socket.emit('error', 'Invalid reaction');
      return;
    }
    
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
  } catch (error) {
    console.error('Error in handleReaction:', error);
    socket.emit('error', 'An error occurred while adding reaction. Please try again.');
  }
};

const handleDisconnect = (socket) => {
  try {
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
    
    // Clean up user data after 5 minutes
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
  } catch (error) {
    console.error('Error in handleDisconnect:', error);
  }
};

// Add error handling for socket connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('new-user-joined', (name) => handleNewUserJoined(socket, name));
  socket.on('send', (data) => handleSendMessage(socket, data));
  socket.on('typing', (data) => handleTyping(socket, data));
  socket.on('reaction', (data) => handleReaction(socket, data));
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });
  
  // Add error handling for socket errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Add error handling for server
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error('Port 8000 is already in use. Please try a different port or kill the existing process.');
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
