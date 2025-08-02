// Global state
let socket = null;
let form = null;
let messageInput = null;
let messageContainer = null;
let audio = null;

// Modal elements
let nameModal = null;
let nameForm = null;
let nameInput = null;
let chatBox = null;

// Global state
let currentUser = null;
let currentRoom = 'general';
let users = [];
let typingUsers = new Set();
let messageReactions = new Map();
let typingTimeout = null;
let isConnected = false;

// DOM elements
let userListElement = null;
let typingIndicatorElement = null;
let reactionPanelElement = null;
let connectionStatusElement = null;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Socket.IO
    socket = io();
    
    // Initialize DOM elements
    form = document.getElementById('send-container');
    messageInput = document.getElementById('messageInp');
    messageContainer = document.querySelector(".container");
    
    // Check if required elements exist
    if (!form || !messageInput || !messageContainer) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Initialize audio with error handling
    try {
        audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.wav');
        audio.volume = 0.3; // Set volume to 30%
    } catch (error) {
        console.warn('Audio initialization failed:', error);
        audio = null;
    }

    // Modal elements
    nameModal = document.getElementById('nameModal');
    nameForm = document.getElementById('nameForm');
    nameInput = document.getElementById('nameInput');
    chatBox = document.getElementById('chatBox');
    connectionStatusElement = document.querySelector('.connection-status');
    
    // Check if modal elements exist
    if (!nameModal || !nameForm || !nameInput || !chatBox) {
        console.error('Modal elements not found');
        return;
    }

    // Initialize event listeners
    initializeEventListeners();
    
    // Initialize Socket event handlers
    initializeSocketHandlers();
    
    // Modal is shown by default in HTML
    
    // Update connection status when socket connects
    socket.on('connect', () => {
        isConnected = true;
        updateConnectionStatus();
    });

    socket.on('disconnect', () => {
        isConnected = false;
        updateConnectionStatus();
    });

    socket.on('reconnect', () => {
        isConnected = true;
        updateConnectionStatus();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        appendMessage('Connection error. Trying to reconnect...', 'system');
    });
});

// Update connection status display
const updateConnectionStatus = () => {
    if (!connectionStatusElement) return;
    
    if (isConnected) {
        connectionStatusElement.innerHTML = '🟢 Connected';
        connectionStatusElement.style.background = 'rgba(16, 185, 129, 0.2)';
        connectionStatusElement.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else {
        connectionStatusElement.innerHTML = '🔴 Disconnected';
        connectionStatusElement.style.background = 'rgba(239, 68, 68, 0.2)';
        connectionStatusElement.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
};

// Initialize UI elements
const initializeUI = () => {
    // Check if main-content and chat-area exist
    const mainContent = document.querySelector('.main-content');
    const chatArea = document.querySelector('.chat-area');
    
    if (!mainContent || !chatArea) {
        console.error('main-content or chat-area not found');
        return;
    }
    
    // Remove any existing sidebar first
    const existingSidebar = document.querySelector('.sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }
    
    // Create user list sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <h3>Chats</h3>
            <span class="online-count">0 online</span>
        </div>
        <div class="user-list" id="userList"></div>
        <div class="sidebar-typing-indicator" id="sidebarTypingIndicator" style="display: none;">
            <div class="typing-dot"></div>
            <span class="typing-text">Someone is typing...</span>
        </div>
    `;
    
    // Create sidebar toggle button
    const sidebarToggle = document.createElement('button');
    sidebarToggle.className = 'sidebar-toggle';
    sidebarToggle.innerHTML = '◀';
    sidebarToggle.title = 'Toggle sidebar (Ctrl+B)';
    sidebarToggle.onclick = toggleSidebar;
    
    mainContent.insertBefore(sidebar, chatArea);
    mainContent.appendChild(sidebarToggle);
    
    userListElement = document.getElementById('userList');
    
    // Create typing indicator
    typingIndicatorElement = document.createElement('div');
    typingIndicatorElement.className = 'typing-indicator';
    typingIndicatorElement.style.display = 'none';
    // Position typing indicator at the bottom of the message container
    messageContainer.appendChild(typingIndicatorElement);
    

    
    // Create reaction panel
    reactionPanelElement = document.createElement('div');
    reactionPanelElement.className = 'reaction-panel';
    reactionPanelElement.innerHTML = `
        <div class="reaction-options">
            <button class="reaction-btn" data-reaction="👍">👍</button>
            <button class="reaction-btn" data-reaction="❤️">❤️</button>
            <button class="reaction-btn" data-reaction="😂">😂</button>
            <button class="reaction-btn" data-reaction="😮">😮</button>
            <button class="reaction-btn" data-reaction="😢">😢</button>
            <button class="reaction-btn" data-reaction="😡">😡</button>
        </div>
    `;
    document.body.appendChild(reactionPanelElement);
    
    // Add file upload button
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    const fileButton = document.createElement('button');
    fileButton.type = 'button';
    fileButton.className = 'btn file-btn';
    fileButton.innerHTML = '📎';
    fileButton.onclick = () => fileInput.click();
    document.querySelector('#send-container').insertBefore(fileButton, document.querySelector('#send-container button'));
    
    fileInput.addEventListener('change', handleFileUpload);
    
    // Add reaction panel event listeners
    reactionPanelElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('reaction-btn')) {
            const messageId = reactionPanelElement.dataset.messageId;
            const reaction = e.target.dataset.reaction;
            addReaction(messageId, reaction);
        }
    });

    // Add welcome message
    setTimeout(() => {
        appendMessage('Welcome to the chat! Start typing to send a message.', 'system');
    }, 500);
    
    // Restore sidebar state from localStorage
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        const sidebar = document.querySelector('.sidebar');
        const toggle = document.querySelector('.sidebar-toggle');
        if (sidebar && toggle) {
            sidebar.classList.add('collapsed');
            toggle.innerHTML = '▶';
            toggle.title = 'Expand sidebar (Ctrl+B)';
        }
    }
};

const initializeEventListeners = () => {
    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value;
        sendMessage(message);
    });

    // Typing indicator
    messageInput.addEventListener('input', () => {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        socket.emit('typing', { roomId: currentRoom, isTyping: true });
        
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { roomId: currentRoom, isTyping: false });
            typingTimeout = null;
        }, 800);
    });

    // Modal functionality
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value;
        handleNewUser(name);
    });

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const name = nameInput.value;
            handleNewUser(name);
        }
    });



    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const message = messageInput.value;
            if (message.trim()) {
                sendMessage(message);
            }
        }
        
        // Ctrl/Cmd + B to toggle sidebar
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            hideReactionPanel();
        }
    });
};

const initializeSocketHandlers = () => {
    socket.on('user-list-update', updateUserList);
    socket.on('room-messages', (data) => {
        data.messages.forEach(message => {
            appendMessage(message, message.sender?.id === currentUser?.id ? 'right' : 'left');
        });
    });

    socket.on('receive', (messageData) => {
        appendMessage(messageData, messageData.sender?.id === currentUser?.id ? 'right' : 'left');
    });

    socket.on('general-messages', (data) => {
        // Clear existing messages and load general chat messages
        messageContainer.innerHTML = '';
        if (typingIndicatorElement) {
            messageContainer.appendChild(typingIndicatorElement);
        }
        data.messages.forEach(message => {
            appendMessage(message, message.sender?.id === currentUser?.id ? 'right' : 'left');
        });
    });

    socket.on('user-joined', (name) => {
        appendMessage(`${name} joined the chat`, 'system');
    });

    socket.on('user-left', (name) => {
        appendMessage(`${name} left the chat`, 'system');
    });

    socket.on('typing-start', (name) => {
        typingUsers.add(name);
        updateTypingIndicator();
        
        // Play subtle typing sound (optional)
        playTypingSound();
    });

    socket.on('typing-stop', (name) => {
        typingUsers.delete(name);
        updateTypingIndicator();
    });

    socket.on('message-reaction', (data) => {
        updateMessageReactions(data.messageId, data.reactions);
    });



    socket.on('error', (error) => {
        appendMessage(`Error: ${error}`, 'system');
    });
};

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        alert('File size too large. Please select a file smaller than 5MB.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result
        };
        
        sendMessage(`📎 ${file.name}`, { file: fileData });
    };
    
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
        event.target.value = '';
    };
    
    reader.readAsDataURL(file);
    event.target.value = '';
};

const updateUserList = (userList) => {
    users = userList;
    const onlineCount = userList.filter(user => user.isOnline).length;
    
    // Update currentUser with correct ID if we don't have it yet
    if (currentUser && !currentUser.id) {
        const currentUserInList = userList.find(user => user.name === currentUser.name);
        if (currentUserInList) {
            currentUser.id = currentUserInList.id;
        }
    }
    
    if (document.querySelector('.online-count')) {
        document.querySelector('.online-count').textContent = `${onlineCount} online`;
    }
    
    if (userListElement) {
        userListElement.innerHTML = userList.map(user => {
            const isTyping = typingUsers.has(user.name);
            return `
                <div class="user-item ${user.isOnline ? 'online' : 'offline'} ${isTyping ? 'typing' : ''}" data-user-id="${user.id}">
                    <img src="${user.avatar}" alt="${user.name}" class="user-avatar">
                    <div class="user-info">
                        <span class="user-name">${user.name}</span>
                        <span class="user-status">
                            ${isTyping ? '<span class="typing-status">typing...</span>' : (user.isOnline ? 'Online' : 'Offline')}
                        </span>
                    </div>
                    ${isTyping ? '<div class="typing-indicator-dot"></div>' : ''}
                </div>
            `;
        }).join('');
    }
};

const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        toggle.innerHTML = '◀';
        toggle.title = 'Collapse sidebar (Ctrl+B)';
    } else {
        sidebar.classList.add('collapsed');
        toggle.innerHTML = '▶';
        toggle.title = 'Expand sidebar (Ctrl+B)';
    }
    
    // Store preference in localStorage
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
};







const appendMessage = (messageData, position) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${position}`;
    
    if (typeof messageData === 'string') {
        // System message
        messageElement.innerHTML = `<div class="message-content">${messageData}</div>`;
    } else {
        // Regular message
        messageElement.dataset.messageId = messageData.id;
        const isOwnMessage = messageData.sender?.id === currentUser?.id;
        const senderName = messageData.sender?.name || 'Unknown';
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString();
        
        const content = `
            <div class="message-header">
                <img src="${messageData.sender?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}" alt="${senderName}" class="message-avatar">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">
                ${messageData.replyTo ? `<div class="reply-to">Replying to: ${messageData.replyTo}</div>` : ''}
                ${messageData.file ? `
                    <div class="file-message">
                        <div class="file-info">
                            <span class="file-name">${messageData.file.name}</span>
                            <span class="file-size">${formatFileSize(messageData.file.size)}</span>
                        </div>
                        ${messageData.file.type.startsWith('image/') ? 
                            `<img src="${messageData.file.data}" alt="${messageData.file.name}" class="file-preview">` :
                            `<div class="file-icon">📎</div>`
                        }
                    </div>
                ` : messageData.message}
            </div>
            <div class="message-reactions" id="reactions-${messageData.id}"></div>
            ${!isOwnMessage ? `<button class="react-btn" onclick="showReactionPanel('${messageData.id}')">😊</button>` : ''}
        `;
        
        messageElement.innerHTML = content;
    }
    
    if (messageContainer) {
        messageContainer.appendChild(messageElement);
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
    } else {
        console.error('Message container not found!');
    }
    
    // Play sound for incoming messages
    if (position === 'left' && audio) {
        audio.play().catch(error => {
            console.warn('Audio playback failed:', error);
        });
    }
    

};

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const showReactionPanel = (messageId) => {
    const rect = event.target.getBoundingClientRect();
    reactionPanelElement.style.left = rect.left + 'px';
    reactionPanelElement.style.top = (rect.top - 60) + 'px';
    reactionPanelElement.style.display = 'block';
    reactionPanelElement.dataset.messageId = messageId;
    
    // Hide panel when clicking outside
    setTimeout(() => {
        document.addEventListener('click', hideReactionPanel);
    }, 100);
};

const hideReactionPanel = () => {
    reactionPanelElement.style.display = 'none';
    document.removeEventListener('click', hideReactionPanel);
};

const addReaction = (messageId, reaction) => {
    socket.emit('reaction', { messageId, reaction, roomId: currentRoom });
    hideReactionPanel();
};

const updateMessageReactions = (messageId, reactions) => {
    const reactionsElement = document.getElementById(`reactions-${messageId}`);
    if (!reactionsElement) return;
    
    const reactionCounts = {};
    Object.values(reactions).flat().forEach(reaction => {
        reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    });
    
    reactionsElement.innerHTML = Object.entries(reactionCounts).map(([reaction, count]) => 
        `<span class="reaction">${reaction} ${count}</span>`
    ).join('');
};

const updateTypingIndicator = () => {
    if (!typingIndicatorElement) return;
    
    if (typingUsers.size === 0) {
        typingIndicatorElement.style.display = 'none';
        updateSidebarTypingIndicator(false);
        return;
    }
    
    const typingNames = Array.from(typingUsers);
    let displayText;
    
    if (typingNames.length === 1) {
        displayText = `<em>${typingNames[0]} is typing...</em>`;
    } else if (typingNames.length === 2) {
        displayText = `<em>${typingNames[0]} and ${typingNames[1]} are typing...</em>`;
    } else if (typingNames.length === 3) {
        displayText = `<em>${typingNames[0]}, ${typingNames[1]}, and ${typingNames[2]} are typing...</em>`;
    } else {
        displayText = `<em>${typingNames[0]}, ${typingNames[1]}, and ${typingNames.length - 2} others are typing...</em>`;
    }
    
    typingIndicatorElement.innerHTML = displayText;
    typingIndicatorElement.style.display = 'flex';
    
    // Update sidebar typing indicator
    updateSidebarTypingIndicator(true, typingNames);
    
    // Ensure typing indicator is visible at the bottom
    if (messageContainer) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }, 10);
    }
};

const updateSidebarTypingIndicator = (show, typingNames = []) => {
    const sidebarTypingIndicator = document.getElementById('sidebarTypingIndicator');
    if (!sidebarTypingIndicator) return;
    
    if (!show) {
        sidebarTypingIndicator.style.display = 'none';
        return;
    }
    
    let text = '';
    if (typingNames.length === 1) {
        text = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
        text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else if (typingNames.length === 3) {
        text = `${typingNames[0]}, ${typingNames[1]}, and ${typingNames[2]} are typing...`;
    } else {
        text = `${typingNames[0]}, ${typingNames[1]}, and ${typingNames.length - 2} others are typing...`;
    }
    
    sidebarTypingIndicator.querySelector('.typing-text').textContent = text;
    sidebarTypingIndicator.style.display = 'flex';
};

const playTypingSound = () => {
    // Create a subtle typing sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Fallback: silent if Web Audio API is not supported
        console.log('Typing sound played');
    }
};

const sendMessage = (message, additionalData = {}) => {
    if (!message.trim()) return;
    
    if (!isConnected) {
        appendMessage('Not connected to server. Please wait...', 'system');
        return;
    }
    
    const messageData = {
        message: message,
        roomId: currentRoom,
        ...additionalData
    };
    
    socket.emit('send', messageData);
    messageInput.value = '';
    
    // Clear typing indicator
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    socket.emit('typing', { roomId: currentRoom, isTyping: false });
};

// Modal functionality
const showModal = () => {
    nameModal.style.display = 'flex';
    nameInput.focus();
};

const hideModal = () => {
    // Hide the modal
    nameModal.style.display = 'none';
    
    // Show the chat box with proper styling
    chatBox.style.cssText = 'display: flex !important; flex-direction: column !important; width: 100vw !important; height: 100vh !important; background: white !important; overflow: hidden !important;';
    
    // Check if elements exist
    const sendContainer = document.getElementById('send-container');
    const messageInput = document.getElementById('messageInp');
    const container = document.querySelector('.container');
    
    // Initialize UI immediately
    initializeUI();
    
    // Make sure the input is visible and properly styled
    if (messageInput) {
        messageInput.style.cssText = 'background: white !important; border: 1px solid #e5e7eb !important; color: #1f2937 !important; font-size: 14px !important; padding: 12px !important; border-radius: 8px !important; width: 100% !important; display: block !important;';
        messageInput.placeholder = 'Type your message...';
    }
    
    if (sendContainer) {
        sendContainer.style.cssText = 'background: white !important; border-top: 1px solid #e5e7eb !important; padding: 16px !important; display: flex !important; align-items: center !important; gap: 12px !important; width: 100% !important;';
    }
    
    // Make sure the container is visible
    if (container) {
        container.style.cssText = 'background: white !important; padding: 16px !important; flex: 1 !important; overflow-y: auto !important; display: flex !important; flex-direction: column !important; gap: 12px !important;';
    }
    
    // Make sure the main content area is properly styled
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.cssText = 'display: flex !important; flex: 1 !important; overflow: hidden !important; background: white !important; flex-direction: row !important;';
    }
    
    // Make sure the chat area is properly styled
    const chatArea = document.querySelector('.chat-area');
    if (chatArea) {
        chatArea.style.cssText = 'flex: 1 !important; display: flex !important; flex-direction: column !important; overflow: hidden !important;';
    }
};

const handleNewUser = (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        alert('Please enter a valid name.');
        return;
    }
    
    if (trimmedName.length < 2) {
        alert('Name must be at least 2 characters long.');
        return;
    }
    
    if (trimmedName.length > 20) {
        alert('Name must be less than 20 characters.');
        return;
    }
    
    currentUser = { name: trimmedName, id: socket.id };
    socket.emit('new-user-joined', trimmedName);
    hideModal();
};

// Make functions globally available for onclick handlers
window.toggleSidebar = toggleSidebar;
window.showReactionPanel = showReactionPanel;
