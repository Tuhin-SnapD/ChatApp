// ChatFlow client

const state = {
    socket: null,
    currentUser: null,
    currentRoom: 'general',
    users: [],
    typingUsers: new Set(),
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    typingTimeout: null,
    activeReactionMessageId: null,
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheElements();
    setupTheme();
    setupSocket();
    setupModal();
    setupChatHandlers();
    setupGlobalShortcuts();
    setupSidebarToggle();
    setupReactionPanel();
    setupEmojiPicker();
    setupFileUpload();
    els.nameInput.focus();
}

function cacheElements() {
    const $ = (id) => document.getElementById(id);
    Object.assign(els, {
        nameModal: $('nameModal'),
        nameForm: $('nameForm'),
        nameInput: $('nameInput'),
        chatBox: $('chatBox'),
        themeToggle: $('themeToggle'),
        connectionStatus: $('connectionStatus'),
        statusLabel: document.querySelector('#connectionStatus .status-label'),
        sidebar: $('sidebar'),
        sidebarToggle: $('sidebarToggle'),
        userList: $('userList'),
        onlineCount: $('onlineCount'),
        sidebarTyping: $('sidebarTyping'),
        messageContainer: $('messageContainer'),
        typingIndicator: $('typingIndicator'),
        sendForm: $('send-container'),
        messageInput: $('messageInp'),
        emojiButton: $('emojiButton'),
        fileButton: $('fileButton'),
        notificationStack: $('notificationStack'),
    });
}

/* ===== Theme ===== */
function setupTheme() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
    els.themeToggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });
}
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const icon = els.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

/* ===== Socket ===== */
function setupSocket() {
    try {
        state.socket = io({
            reconnection: true,
            reconnectionAttempts: state.maxReconnectAttempts,
            reconnectionDelay: 1000,
            timeout: 20000,
        });
    } catch (err) {
        console.error('Socket init failed:', err);
        notify('Failed to connect to server.', 'error');
        return;
    }

    const s = state.socket;
    s.on('connect', () => {
        state.isConnected = true;
        state.reconnectAttempts = 0;
        updateConnectionStatus();
    });
    s.on('disconnect', () => { state.isConnected = false; updateConnectionStatus(); });
    s.on('reconnect', () => {
        state.isConnected = true;
        state.reconnectAttempts = 0;
        updateConnectionStatus();
        notify('Reconnected.', 'success');
    });
    s.on('reconnect_attempt', (n) => {
        state.reconnectAttempts = n;
        updateConnectionStatus();
    });
    s.on('reconnect_failed', () => notify('Could not reconnect. Refresh the page.', 'error'));
    s.on('connect_error', (err) => console.warn('Connect error:', err.message));

    s.on('user-list-update', updateUserList);
    s.on('room-messages', ({ messages }) => {
        clearMessages();
        messages.forEach(renderMessage);
    });
    s.on('receive', renderMessage);
    s.on('user-joined', (name) => addSystem(`${name} joined`));
    s.on('user-left', (name) => addSystem(`${name} left`));
    s.on('typing-start', (name) => { state.typingUsers.add(name); updateTypingIndicator(); });
    s.on('typing-stop',  (name) => { state.typingUsers.delete(name); updateTypingIndicator(); });
    s.on('message-reaction', ({ messageId, reactions }) => updateMessageReactions(messageId, reactions));
    s.on('error', (err) => { console.error('Server error:', err); notify(err, 'error'); });
}

function updateConnectionStatus() {
    const c = els.connectionStatus;
    c.classList.remove('connected', 'disconnected', 'reconnecting');
    if (state.isConnected) {
        c.classList.add('connected');
        els.statusLabel.textContent = 'Connected';
    } else if (state.reconnectAttempts > 0) {
        c.classList.add('reconnecting');
        els.statusLabel.textContent = `Reconnecting ${state.reconnectAttempts}/${state.maxReconnectAttempts}`;
    } else {
        c.classList.add('disconnected');
        els.statusLabel.textContent = 'Disconnected';
    }
}

/* ===== Modal ===== */
function setupModal() {
    els.nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleNewUser(els.nameInput.value);
    });

    els.nameModal.addEventListener('click', (e) => {
        const chip = e.target.closest('.suggestion-chip');
        if (!chip) return;
        els.nameInput.value = chip.dataset.name;
        els.nameInput.focus();
        document.querySelectorAll('.suggestion-chip.active').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
    });
}

function handleNewUser(name) {
    const trimmed = (name || '').trim();
    if (trimmed.length < 2) return notify('Name must be at least 2 characters.', 'error');
    if (trimmed.length > 20) return notify('Name must be 20 characters or fewer.', 'error');
    if (!state.socket || !state.isConnected) return notify('Not connected yet — try again in a moment.', 'error');

    state.currentUser = { name: trimmed, id: state.socket.id };
    state.socket.emit('new-user-joined', trimmed);

    els.nameModal.hidden = true;
    els.chatBox.hidden = false;
    els.messageInput.focus();
    addSystem(`Welcome, ${trimmed}!`);
}

/* ===== Send / typing ===== */
function setupChatHandlers() {
    els.sendForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage(els.messageInput.value);
    });

    els.messageInput.addEventListener('input', () => {
        if (state.typingTimeout) clearTimeout(state.typingTimeout);
        if (state.isConnected) {
            state.socket.emit('typing', { roomId: state.currentRoom, isTyping: true });
        }
        state.typingTimeout = setTimeout(() => {
            if (state.isConnected) {
                state.socket.emit('typing', { roomId: state.currentRoom, isTyping: false });
            }
            state.typingTimeout = null;
        }, 900);
    });
}

function sendMessage(message, extra = {}) {
    const text = (message || '').trim();
    if (!text && !extra.file) return;
    if (!state.isConnected) return notify('Not connected to server.', 'error');

    state.socket.emit('send', { message: text || ' ', roomId: state.currentRoom, ...extra });
    els.messageInput.value = '';
    els.messageInput.focus();

    if (state.typingTimeout) {
        clearTimeout(state.typingTimeout);
        state.typingTimeout = null;
    }
    state.socket.emit('typing', { roomId: state.currentRoom, isTyping: false });
}

/* ===== Messages ===== */
function clearMessages() {
    els.messageContainer.innerHTML = '';
}

function addSystem(text) {
    renderMessage(text);
}

function renderMessage(data) {
    const el = document.createElement('div');

    if (typeof data === 'string') {
        el.className = 'message system';
        el.textContent = data;
        appendAndScroll(el);
        return;
    }

    const isOwn = data.sender?.id === state.currentUser?.id;
    el.className = `message ${isOwn ? 'right' : 'left'}`;
    el.dataset.messageId = data.id;

    const header = document.createElement('div');
    header.className = 'message-header';

    if (!isOwn) {
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.alt = '';
        avatar.src = data.sender?.avatar || fallbackAvatar();
        avatar.onerror = () => { avatar.onerror = null; avatar.src = fallbackAvatar(); };
        header.appendChild(avatar);
    }

    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = data.sender?.name || 'Unknown';
    header.appendChild(sender);

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(data.timestamp);
    header.appendChild(time);

    el.appendChild(header);

    if (data.replyTo) {
        const reply = document.createElement('div');
        reply.className = 'reply-to';
        reply.textContent = `Replying to: ${data.replyTo}`;
        el.appendChild(reply);
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    if (data.file) {
        content.appendChild(buildFileNode(data.file));
    } else {
        content.textContent = data.message;
    }
    el.appendChild(content);

    const reactions = document.createElement('div');
    reactions.className = 'message-reactions';
    reactions.id = `reactions-${data.id}`;
    el.appendChild(reactions);

    const reactBtn = document.createElement('button');
    reactBtn.className = 'react-btn';
    reactBtn.type = 'button';
    reactBtn.innerHTML = '<i class="far fa-smile"></i>';
    reactBtn.setAttribute('aria-label', 'Add reaction');
    reactBtn.addEventListener('click', (e) => showReactionPanel(e, data.id));
    el.appendChild(reactBtn);

    appendAndScroll(el);
}

function buildFileNode(file) {
    const wrap = document.createElement('div');
    wrap.className = 'file-message';

    if (file.type && file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'file-preview';
        img.src = file.data;
        img.alt = file.name;
        img.loading = 'lazy';
        wrap.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'file-info';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'file-icon-wrap';
    const icon = document.createElement('i');
    icon.className = fileIconClass(file.type);
    iconWrap.appendChild(icon);
    info.appendChild(iconWrap);

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;
    meta.appendChild(name);

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatFileSize(file.size);
    meta.appendChild(size);

    info.appendChild(meta);
    wrap.appendChild(info);
    return wrap;
}

function fileIconClass(type = '') {
    if (type.startsWith('image/')) return 'fas fa-image';
    if (type.startsWith('video/')) return 'fas fa-video';
    if (type.startsWith('audio/')) return 'fas fa-music';
    if (type.includes('pdf')) return 'fas fa-file-pdf';
    if (type.includes('word')) return 'fas fa-file-word';
    if (type.startsWith('text/')) return 'fas fa-file-lines';
    return 'fas fa-file';
}

function appendAndScroll(el) {
    const c = els.messageContainer;
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
    c.appendChild(el);
    if (nearBottom) c.scrollTop = c.scrollHeight;
}

function formatTime(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

function fallbackAvatar() {
    return 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
}

/* ===== Users / typing ===== */
function updateUserList(userList) {
    state.users = userList;
    const onlineCount = userList.filter((u) => u.isOnline).length;
    els.onlineCount.textContent = `${onlineCount} online`;

    if (state.currentUser && !state.currentUser.id) {
        const me = userList.find((u) => u.name === state.currentUser.name);
        if (me) state.currentUser.id = me.id;
    }

    els.userList.innerHTML = '';
    userList.forEach((user) => {
        const item = document.createElement('div');
        item.className = `user-item ${user.isOnline ? 'online' : 'offline'}`;
        if (state.currentUser && user.id === state.currentUser.id) item.classList.add('self');
        item.dataset.userId = user.id;

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'user-avatar-wrap';
        const avatar = document.createElement('img');
        avatar.className = 'user-avatar';
        avatar.alt = '';
        avatar.src = user.avatar || fallbackAvatar();
        avatar.onerror = () => { avatar.onerror = null; avatar.src = fallbackAvatar(); };
        avatarWrap.appendChild(avatar);
        item.appendChild(avatarWrap);

        const info = document.createElement('div');
        info.className = 'user-info';
        const name = document.createElement('span');
        name.className = 'user-name';
        name.textContent = user.name;
        info.appendChild(name);

        const status = document.createElement('span');
        const isTyping = state.typingUsers.has(user.name);
        status.className = `user-status ${isTyping ? 'is-typing' : ''}`;
        status.textContent = isTyping ? 'typing…' : (user.isOnline ? 'Online' : 'Offline');
        info.appendChild(status);

        item.appendChild(info);
        els.userList.appendChild(item);
    });
}

function updateTypingIndicator() {
    const names = Array.from(state.typingUsers).filter((n) => n !== state.currentUser?.name);
    const text = formatTypingText(names);

    if (names.length === 0) {
        els.typingIndicator.hidden = true;
        els.sidebarTyping.hidden = true;
    } else {
        els.typingIndicator.querySelector('.typing-text').textContent = text;
        els.typingIndicator.hidden = false;
        els.sidebarTyping.querySelector('.typing-text').textContent = text;
        els.sidebarTyping.hidden = false;
    }

    // refresh sidebar status text
    if (state.users.length) updateUserList(state.users);
}

function formatTypingText(names) {
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''} are typing…`;
}

/* ===== Reactions ===== */
let reactionPanel;
function setupReactionPanel() {
    reactionPanel = document.createElement('div');
    reactionPanel.className = 'reaction-panel';
    reactionPanel.innerHTML = `
        <div class="reaction-options">
            <button type="button" class="reaction-btn" data-reaction="👍">👍</button>
            <button type="button" class="reaction-btn" data-reaction="❤️">❤️</button>
            <button type="button" class="reaction-btn" data-reaction="😂">😂</button>
            <button type="button" class="reaction-btn" data-reaction="😮">😮</button>
            <button type="button" class="reaction-btn" data-reaction="😢">😢</button>
            <button type="button" class="reaction-btn" data-reaction="😡">😡</button>
        </div>`;
    document.body.appendChild(reactionPanel);

    reactionPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('.reaction-btn');
        if (!btn || !state.activeReactionMessageId) return;
        if (state.isConnected) {
            state.socket.emit('reaction', {
                messageId: state.activeReactionMessageId,
                reaction: btn.dataset.reaction,
                roomId: state.currentRoom,
            });
        }
        hideReactionPanel();
    });

    document.addEventListener('click', (e) => {
        if (!reactionPanel.classList.contains('show')) return;
        if (e.target.closest('.reaction-panel') || e.target.closest('.react-btn')) return;
        hideReactionPanel();
    });
}

function showReactionPanel(event, messageId) {
    event.stopPropagation();
    state.activeReactionMessageId = messageId;
    const rect = event.currentTarget.getBoundingClientRect();
    const panelHeight = 50;
    reactionPanel.style.left = `${Math.max(8, rect.left - 80)}px`;
    reactionPanel.style.top = `${rect.top - panelHeight - 6}px`;
    reactionPanel.classList.add('show');
}

function hideReactionPanel() {
    reactionPanel.classList.remove('show');
    state.activeReactionMessageId = null;
}

function updateMessageReactions(messageId, reactions) {
    const node = document.getElementById(`reactions-${messageId}`);
    if (!node) return;

    const counts = {};
    Object.values(reactions || {}).flat().forEach((r) => { counts[r] = (counts[r] || 0) + 1; });

    node.innerHTML = '';
    Object.entries(counts).forEach(([reaction, count]) => {
        const span = document.createElement('span');
        span.className = 'reaction';
        span.textContent = `${reaction} ${count}`;
        node.appendChild(span);
    });
}

/* ===== Emoji picker ===== */
let emojiPanel;
function setupEmojiPicker() {
    const emojis = ['😊','😂','❤️','👍','🎉','🔥','💯','✨','🚀','💪','👏','🙌','🤔','😎','🥳','😍','🤩','😄','😅','😆','😴','🙏','💡','✅','⚡','🌟','🎯','📌','💬','👀'];
    emojiPanel = document.createElement('div');
    emojiPanel.className = 'emoji-panel';
    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    emojis.forEach((emoji) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'emoji-cell';
        b.dataset.emoji = emoji;
        b.textContent = emoji;
        grid.appendChild(b);
    });
    emojiPanel.appendChild(grid);
    document.body.appendChild(emojiPanel);

    emojiPanel.addEventListener('click', (e) => {
        const cell = e.target.closest('.emoji-cell');
        if (!cell) return;
        insertAtCaret(els.messageInput, cell.dataset.emoji);
        els.messageInput.focus();
    });

    els.emojiButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (emojiPanel.classList.contains('show')) {
            hideEmojiPanel();
            return;
        }
        const rect = els.emojiButton.getBoundingClientRect();
        emojiPanel.style.visibility = 'hidden';
        emojiPanel.classList.add('show');
        const panelRect = emojiPanel.getBoundingClientRect();
        emojiPanel.style.left = `${Math.min(window.innerWidth - panelRect.width - 8, rect.right - panelRect.width)}px`;
        emojiPanel.style.top = `${rect.top - panelRect.height - 8}px`;
        emojiPanel.style.visibility = '';
    });

    document.addEventListener('click', (e) => {
        if (!emojiPanel.classList.contains('show')) return;
        if (e.target.closest('.emoji-panel') || e.target.closest('#emojiButton')) return;
        hideEmojiPanel();
    });
}
function hideEmojiPanel() { emojiPanel.classList.remove('show'); }

function insertAtCaret(input, text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
}

/* ===== File upload ===== */
function setupFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
    document.body.appendChild(input);

    els.fileButton.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            notify('File too large. Max 5MB.', 'error');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            sendMessage(file.name, {
                file: { name: file.name, type: file.type, size: file.size, data: ev.target.result }
            });
        };
        reader.onerror = () => notify('Failed to read file.', 'error');
        reader.readAsDataURL(file);
        input.value = '';
    });
}

/* ===== Sidebar ===== */
function setupSidebarToggle() {
    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (collapsed) els.sidebar.classList.add('collapsed');
    els.sidebarToggle.addEventListener('click', toggleSidebar);
}
function toggleSidebar() {
    const collapsed = els.sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed);
}

/* ===== Shortcuts ===== */
function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
        if (e.key === 'Escape') {
            hideReactionPanel();
            hideEmojiPanel();
        }
    });
}

/* ===== Notifications ===== */
function notify(message, type = 'info') {
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    const node = document.createElement('div');
    node.className = `notification ${type}`;
    node.innerHTML = `<i class="fas fa-${icon}"></i><span></span>`;
    node.querySelector('span').textContent = message;
    els.notificationStack.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
        node.classList.remove('show');
        setTimeout(() => node.remove(), 250);
    }, 3200);
}
