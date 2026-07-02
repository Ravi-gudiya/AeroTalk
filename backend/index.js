import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { DB } from './db.js';
import * as usersStorage from './users-storage.js';
import { hashPassword, comparePassword, generateToken, authenticateToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Create uploads folder if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
// Serve uploads folder as static files
app.use('/api/uploads', express.static(UPLOADS_DIR));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// --- REST API Endpoints ---

// Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // 1. Check if email exists in standard DB or modular JSON storage
    const existing = await DB.findUserByEmail(email);
    const isSupabaseActive = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_KEY;
    const existingStorageUser = !isSupabaseActive ? usersStorage.findUserByEmail(email) : null;
    if (existing || existingStorageUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Save to modular data/users.json storage if local fallback mode
    if (!isSupabaseActive) {
      const storageUser = usersStorage.createUser(username, email, passwordHash);
      if (!storageUser) {
        return res.status(500).json({ error: 'Failed to create user storage entry' });
      }
    }

    // 4. Save to legacy relational mapping memory DB / Supabase DB
    const user = await DB.createUser(email, username, passwordHash);

    // 5. Generate login token and redirect response
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration flow failure:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await DB.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const { passwordHash: _, ...userProfile } = user;

    res.json({ token, user: userProfile });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search Users
app.get('/api/users/search', authenticateToken, async (req, res) => {
  const query = req.query.q || '';
  const results = await DB.searchUsers(query, req.user.email);
  res.json(results);
});

// Get Current User Profile Info
app.get('/api/users/me', authenticateToken, async (req, res) => {
  const user = await DB.findUserByEmail(req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...profile } = user;
  res.json(profile);
});

// Friend Request
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  const { targetEmail } = req.body;
  const result = await DB.sendFriendRequest(req.user.email, targetEmail);
  if (result.error) {
    return res.status(400).json(result);
  }
  
  // If request sent or accepted, notify receiver if online
  const receiverSocket = getSocketByEmail(targetEmail);
  if (receiverSocket) {
    io.to(receiverSocket).emit('friend_update');
  }

  res.json(result);
});

// Accept Friend Request
app.post('/api/friends/accept', authenticateToken, async (req, res) => {
  const { senderEmail } = req.body;
  const success = await DB.acceptFriendRequest(req.user.email, senderEmail);
  if (!success) {
    return res.status(400).json({ error: 'Friend request not found' });
  }

  // Notify sender
  const senderSocket = getSocketByEmail(senderEmail);
  if (senderSocket) {
    io.to(senderSocket).emit('friend_update');
  }

  res.json({ success: true });
});

// Decline / Cancel Friend Request
app.post('/api/friends/decline', authenticateToken, async (req, res) => {
  const { targetEmail } = req.body;
  const success = await DB.deleteFriendRequest(req.user.email, targetEmail);
  if (!success) {
    return res.status(400).json({ error: 'Friend request not found' });
  }

  // Notify peer if online
  const targetSocket = getSocketByEmail(targetEmail);
  if (targetSocket) {
    io.to(targetSocket).emit('friend_update');
  }

  res.json({ success: true });
});

// Get Friends List
app.get('/api/friends', authenticateToken, async (req, res) => {
  const list = await DB.getFriends(req.user.email);
  
  // Inject online presence statuses
  const listWithPresence = list.map(f => ({
    ...f,
    isOnline: activeConnections.hasOwnProperty(f.email)
  }));

  res.json(listWithPresence);
});

// Get 1-to-1 Chat History
app.get('/api/chats/:peerEmail', authenticateToken, async (req, res) => {
  const history = await DB.getChatHistory(req.user.email, req.params.peerEmail);
  res.json(history);
});

// Create Group
app.post('/api/groups', authenticateToken, async (req, res) => {
  const { name, members } = req.body; // members: array of emails
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const group = await DB.createGroup(name, req.user.email, members);

  // Notify added group members if online to join the room
  members.concat(req.user.email).forEach(email => {
    const socketId = getSocketByEmail(email);
    if (socketId) {
      io.to(socketId).emit('group_added', group);
    }
  });

  res.status(201).json(group);
});

// Get Groups List
app.get('/api/groups', authenticateToken, async (req, res) => {
  const list = await DB.getGroupsForUser(req.user.email);
  res.json(list);
});

// Get Group Messages History
app.get('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
  const history = await DB.getGroupChatHistory(req.params.groupId);
  res.json(history);
});

// Get Active WebRTC Peer ID by user email
app.get('/api/users/:email/peer', authenticateToken, (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();
  const conn = activeConnections[targetEmail];
  if (conn) {
    res.json({ peerId: conn.peerId });
  } else {
    res.status(404).json({ error: 'User is offline' });
  }
});

// Upload File
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/api/uploads/${req.file.filename}`;
  res.json({ fileUrl, fileName: req.file.originalname });
});

// Upload User Avatar DP
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  const avatarUrl = `/api/uploads/${req.file.filename}`;
  await DB.updateUserAvatar(req.user.email, avatarUrl);
  res.json({ avatarUrl });
});

// Upload User Cover Photo
app.post('/api/users/cover', authenticateToken, upload.single('cover'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  const coverUrl = `/api/uploads/${req.file.filename}`;
  await DB.updateUserCover(req.user.email, coverUrl);
  res.json({ coverUrl });
});

// Update User Profile Fields
app.post('/api/users/profile', authenticateToken, async (req, res) => {
  const updated = await DB.updateUserProfile(req.user.email, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(updated);
});

// Create Feed Post
app.post('/api/feed', authenticateToken, async (req, res) => {
  const { imageUrl, caption } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Image URL is required' });
  }
  
  const user = await DB.findUserByEmail(req.user.email);
  const post = await DB.createPost(req.user.email, user.username, user.avatarUrl || null, imageUrl, caption);
  
  // Real-time broadcast of new social post
  io.emit('new_feed_post', post);
  
  res.status(201).json(post);
});

// Get Feed Posts
app.get('/api/feed', authenticateToken, async (req, res) => {
  const posts = await DB.getFeed();
  res.json(posts);
});

// Create Goal
app.post('/api/goals', authenticateToken, async (req, res) => {
  const { title, category } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category required' });
  }
  const goal = await DB.createGoal(req.user.email, title, category);
  res.status(201).json(goal);
});

// Patch Goal Progress
app.patch('/api/goals/:id', authenticateToken, async (req, res) => {
  const { progress } = req.body;
  const updated = await DB.updateGoalProgress(req.params.id, progress);
  if (!updated) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  res.json(updated);
});

// Get Goals
app.get('/api/goals', authenticateToken, async (req, res) => {
  const list = await DB.getGoals(req.user.email);
  res.json(list);
});

// Create Time Capsule
app.post('/api/capsules', authenticateToken, async (req, res) => {
  const { message, openDate } = req.body;
  if (!message || !openDate) {
    return res.status(400).json({ error: 'Message and open date required' });
  }
  const capsule = await DB.createCapsule(req.user.email, message, openDate);
  res.status(201).json(capsule);
});

// Get Time Capsules
app.get('/api/capsules', authenticateToken, async (req, res) => {
  const list = await DB.getCapsules(req.user.email);
  res.json(list);
});

// --- Socket.io Real-Time Coordination ---

// Keep track of active users: email -> { socketId, peerId }
const activeConnections = {};

function getSocketByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  console.log(`[Presence Query] Finding socket for: "${cleanEmail}". Active keys:`, Object.keys(activeConnections));
  return activeConnections[cleanEmail]?.socketId || null;
}

io.on('connection', (socket) => {
  let userEmail = null;
  console.log(`New socket connected: ${socket.id}`);

  socket.on('register', async ({ email, peerId }) => {
    if (!email) {
      console.warn(`Socket register failed: missing email for socket ${socket.id}`);
      return;
    }
    userEmail = email.toLowerCase().trim();
    activeConnections[userEmail] = { socketId: socket.id, peerId };
    console.log(`Socket registered user: "${userEmail}" (Socket: ${socket.id}, Peer: ${peerId})`);

    // Let user join rooms of groups they are members of
    const groups = await DB.getGroupsForUser(userEmail);
    groups.forEach(g => {
      socket.join(`group_${g.id}`);
    });

    // Notify friends of online status
    await notifyFriendsPresence(userEmail, true);
  });

  // Direct Message Sending
  socket.on('send_direct_message', async ({ to, content, fileUrl, fileName }) => {
    if (!userEmail) {
      console.warn(`Attempted to send direct message from unregistered socket: ${socket.id}`);
      return;
    }
    const cleanTo = to.toLowerCase().trim();
    const newMsg = await DB.saveMessage(userEmail, cleanTo, content, fileUrl, fileName);
    console.log(`Direct message from "${userEmail}" to "${cleanTo}": "${content}"`);

    const receiverSocket = getSocketByEmail(cleanTo);
    if (receiverSocket) {
      console.log(`Forwarding message to receiver "${cleanTo}" on socket ${receiverSocket}`);
      io.to(receiverSocket).emit('direct_message', newMsg);
    } else {
      console.log(`Receiver "${cleanTo}" is offline. Message saved to DB only.`);
    }
    
    // Echo back to sender
    socket.emit('direct_message', newMsg);
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id} (User: ${userEmail})`);
    if (userEmail && activeConnections[userEmail]?.socketId === socket.id) {
      delete activeConnections[userEmail];
      console.log(`Cleaned up active connection for "${userEmail}"`);
      
      // Update lastSeen in database
      await DB.updateLastSeen(userEmail);
      
      await notifyFriendsPresence(userEmail, false);
    }
  });

  // Group Message Sending
  socket.on('send_group_message', async ({ groupId, content, fileUrl, fileName }) => {
    if (!userEmail) return;
    const newMsg = await DB.saveGroupMessage(groupId, userEmail, content, fileUrl, fileName);
    
    // Broadcast to everyone in group
    io.to(`group_${groupId}`).emit('group_message', newMsg);
  });

  // Handle typing alerts
  socket.on('typing_direct', ({ to, isTyping }) => {
    const receiverSocket = getSocketByEmail(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing_direct', { from: userEmail, isTyping });
    }
  });

  socket.on('typing_group', ({ groupId, isTyping }) => {
    socket.to(`group_${groupId}`).emit('typing_group', { groupId, from: userEmail, isTyping });
  });

  // Manual Join Room for newly created groups
  socket.on('join_group_room', ({ groupId }) => {
    socket.join(`group_${groupId}`);
  });
});

// Notify friends when user goes online or offline
async function notifyFriendsPresence(email, isOnline) {
  const friends = await DB.getFriends(email);
  const lastSeen = isOnline ? null : Date.now();
  friends.forEach(f => {
    const friendSocket = getSocketByEmail(f.email);
    if (friendSocket) {
      io.to(friendSocket).emit('presence_change', { email, isOnline, lastSeen });
    }
  });
}

// Fallback for Single Page App routing
app.get('*', (req, res) => {
  const distIndex = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.json({ status: 'active', message: 'AeroTalk Backend API is online.' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend Server listening on port ${PORT}`);
});
