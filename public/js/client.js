const socket = io();
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector(".container");
const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.wav');

const appendMessage = (message, position) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
    messageContainer.append(messageElement);
    if (position === 'left') {
        audio.play();
    }
};

const sendMessage = (message) => {
    appendMessage(`You: ${message}`, 'right');
    socket.emit('send', message);
    messageInput.value = '';
};

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    sendMessage(message);
});

const handleNewUser = () => {
    const name = prompt("Enter your name: ");
    socket.emit('new-user-joined', name);
};

const handleUserJoined = (name) => {
    appendMessage(`${name} joined the chat`, 'right');
};

const handleReceiveMessage = (data) => {
    appendMessage(`${data.name}: ${data.message}`, 'left');
};

const handleUserLeft = (name) => {
    appendMessage(`${name} left the chat`, 'right');
};

socket.on('user-joined', handleUserJoined);
socket.on('receive', handleReceiveMessage);
socket.on('left', handleUserLeft);

// Initialize user on connection
socket.on('connect', handleNewUser);
