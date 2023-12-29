const io = require('socket.io')(8000, {
  cors: {
    origin: '*',
  },
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
