# Chat App 2

A real-time chat application built with Node.js, Express, and Socket.io.

## Features

- Real-time messaging
- User join/leave notifications
- Sound notifications for new messages
- Responsive design
- Modern UI with smooth animations

## Directory Structure

```
chatapp2/
├── public/                 # Static files served by Express
│   ├── index.html         # Main HTML file
│   ├── css/
│   │   └── style.css      # Stylesheet
│   └── js/
│       └── client.js      # Client-side JavaScript
├── server/
│   └── index.js           # Server-side code
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## How it Works

- The server runs on port 8000 using Express and Socket.io
- Static files (HTML, CSS, JS) are served from the `public` directory
- Icons and sounds are loaded from online CDNs for better portability
- Real-time communication is handled through Socket.io events
- Users can join with a custom name and send messages
- All connected users receive real-time updates

## Technologies Used

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time Communication**: Socket.io
- **External Resources**: CDN icons and sounds
