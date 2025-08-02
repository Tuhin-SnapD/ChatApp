# Advanced Chat Application with Socket.IO

A feature-rich real-time chat application built with Node.js, Express, and Socket.IO, featuring modern UI/UX and comprehensive real-time communication capabilities.

## 🚀 Features

### Core Chat Features
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **User Authentication**: Simple name-based authentication with modal
- **Message History**: Persistent message storage per room (last 100 messages)
- **Sound Notifications**: Audio alerts for incoming messages

### Advanced Socket.IO Features

#### 👥 User Management
- **User List**: Real-time sidebar showing all connected users
- **Online/Offline Status**: Visual indicators for user availability
- **User Avatars**: Auto-generated avatars using DiceBear API
- **Last Seen**: Track when users were last active
- **User Count**: Display number of online users

#### 🏠 Chat Management
- **General Chat**: Main chat room for all users
- **Message History**: Persistent message storage (last 50 messages)
- **User Count**: See how many users are online



#### ⌨️ Typing Indicators
- **Real-time Typing**: Shows when users are typing
- **Typing Timeout**: Automatically clears after 1 second of inactivity

#### 😊 Message Reactions
- **Emoji Reactions**: React to messages with emojis (👍❤️😂😮😢😡)
- **Reaction Counts**: Display total reactions per message
- **Interactive UI**: Click emoji button to add reactions
- **Real-time Updates**: Reactions update instantly across all clients

#### 📎 File Sharing
- **File Upload**: Share images, videos, audio, and documents
- **File Preview**: Image previews for uploaded images
- **File Information**: Display file name and size
- **Multiple Formats**: Support for various file types



#### 🎨 Enhanced UI/UX
- **Modern Design**: Clean, responsive interface
- **Collapsible Sidebar**: Toggle sidebar visibility to maximize chat area
- **Sidebar Persistence**: Remembers sidebar state across sessions
- **Message Avatars**: User avatars in messages
- **Message Timestamps**: Time stamps for all messages
- **System Messages**: Special styling for system notifications
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Smooth Animations**: CSS transitions and animations

#### 🔧 Technical Features
- **Connection Management**: Handles disconnections and reconnections
- **Error Handling**: Graceful error handling and user feedback
- **Performance Optimized**: Efficient message handling and storage
- **Cross-browser Compatible**: Works across all modern browsers

#### ⌨️ Keyboard Shortcuts
- **Ctrl/Cmd + Enter**: Send message
- **Ctrl/Cmd + B**: Toggle sidebar
- **Escape**: Close reaction panel

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatapp2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:8000
   ```

## 📁 Project Structure

```
chatapp2/
├── server/
│   └── index.js          # Socket.IO server implementation
├── public/
│   ├── index.html        # Main HTML file
│   ├── css/
│   │   └── style.css     # Comprehensive styling
│   └── js/
│       └── client.js     # Client-side Socket.IO implementation
├── package.json
└── README.md
```

## 🔌 Socket.IO Events

### Client to Server Events
- `new-user-joined`: User joins the chat
- `send`: Send a message to current room
- `private-message`: Send private message to specific user
- `typing`: Typing indicator status
- `reaction`: Add reaction to message
- `join-room`: Join a specific room


### Server to Client Events
- `user-list-update`: Update user list
- `room-list`: Send available rooms
- `room-messages`: Send room message history
- `receive`: Receive new message
- `private-message`: Receive private message
- `user-joined`: User joined notification
- `user-left`: User left notification
- `user-joined-room`: User joined room notification
- `typing-start`: User started typing
- `typing-stop`: User stopped typing
- `message-reaction`: Message reaction update
- `error`: Error message

## 🎯 Usage Guide

### Getting Started
1. Enter your name in the welcome modal
2. Click "Join Chat" to enter the application
3. Start typing messages in the input field

### Using Features

#### **Joining Rooms**
- Click on room names in the sidebar
- Rooms are created automatically when first joined
- Switch between rooms to see different conversations

#### **Private Messaging**
- Click the 💬 button next to any user in the sidebar
- Private chat rooms are created automatically
- Only you and the selected user can see private messages

#### **Adding Reactions**
- Click the 😊 button on any message
- Select an emoji from the reaction panel
- Reactions are displayed below messages with counts

#### **File Sharing**
- Click the 📎 button in the message input area
- Select a file to upload
- Files are shared with preview (images) or file info

#### **Typing Indicators**
- Start typing to show "is typing" indicator
- Indicator automatically disappears after 1 second of inactivity
- Only visible to users in the same room

## 🎨 Customization

### Styling
- Modify `public/css/style.css` to customize the appearance
- All components use CSS custom properties for easy theming
- Responsive design with mobile-first approach

### Features
- Add new Socket.IO events in `server/index.js`
- Extend client functionality in `public/js/client.js`
- Modify message handling and UI updates as needed

## 🔒 Security Considerations

- Input validation on both client and server
- XSS protection through proper HTML escaping
- File upload size and type restrictions
- Rate limiting for message sending (can be implemented)

## 🚀 Performance Features

- Message history limited to 100 messages per room
- Efficient user list updates
- Optimized reconnection handling
- Minimal data transfer for real-time updates

## 📱 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Socket.IO for real-time communication
- DiceBear for avatar generation
- Modern CSS for styling inspiration
