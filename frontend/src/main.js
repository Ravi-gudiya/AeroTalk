import './style.css';
import { io } from 'socket.io-client';
import { Peer } from 'peerjs';
import { SoundEffects } from './sound-effects.js';

// Production API endpoints configuration
let API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerotalk.onrender.com';

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  API_BASE_URL = 'http://localhost:5000';
}

if (API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}

function apiFetch(url, options = {}) {
  const absoluteUrl = url.startsWith('/api') ? `${API_BASE_URL}${url}` : url;
  return fetch(absoluteUrl, options);
}

// Application State
let token = localStorage.getItem('aerotalk_token') || null;
let currentUser = null; // { email, username, avatarColor }
let socket = null;
let peer = null;
let activeChatId = null; // Can be email (1-to-1) or groupId (group)
let activeChatType = null; // 'direct' or 'group'
let friendsList = [];
let groupsList = [];
let activeChats = []; // Emails/groupIDs with recent chat sessions
let peerNameMap = {}; // Maps email -> username for display
let peerAvatarMap = {}; // Maps email -> avatarColor
let peerAvatarUrlMap = {}; // Maps email -> avatarUrl
let postImageFile = null;

// Call State
let activeCall = null;
let localStream = null;
let screenStream = null;
let activeCallRing = null;
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;

// Upload State
let selectedFile = null;

// --- DOM Elements ---

// Auth
const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const regUsername = document.getElementById('reg-username');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const showRegisterBtn = document.getElementById('show-register-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const authSubtitle = document.getElementById('auth-subtitle');

// App Header & Profile
const appContainer = document.getElementById('app');
const myAvatar = document.getElementById('my-avatar');
const myUsername = document.getElementById('my-username');
const myEmail = document.getElementById('my-email');
const logoutBtn = document.getElementById('logout-btn');

// Sidebar Lists
const activeChatsList = document.getElementById('active-chats-list');
const friendsListEl = document.getElementById('friends-list');
const groupsListEl = document.getElementById('groups-list');

// Searching Friends
const friendSearchInput = document.getElementById('friend-search-input');
const searchResults = document.getElementById('search-results');
const searchBtn = document.getElementById('search-btn');

// Group Creation Modal
const openCreateGroupBtn = document.getElementById('open-create-group-btn');
const groupModal = document.getElementById('group-modal');
const closeGroupModal = document.getElementById('close-group-modal');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersList = document.getElementById('group-members-list');
const createGroupSubmit = document.getElementById('create-group-submit');

// Active Chat Frame
const chatBlankState = document.getElementById('chat-blank-state');
const chatActiveWindow = document.getElementById('chat-active-window');
const chatAvatar = document.getElementById('chat-avatar');
const peerAvatarInitial = document.getElementById('peer-avatar-initial');
const chatStatusIndicator = document.getElementById('chat-status-indicator');
const peerDisplayName = document.getElementById('peer-display-name');
const peerStatus = document.getElementById('peer-status');
const callActionsHeader = document.getElementById('call-actions-header');
const headerAudioCallBtn = document.getElementById('header-audio-call-btn');
const headerVideoCallBtn = document.getElementById('header-video-call-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const typingIndicator = document.getElementById('typing-indicator');

// File Upload Preview
const fileInput = document.getElementById('file-input');
const filePreviewCard = document.getElementById('file-preview-card');
const filePreviewName = document.getElementById('file-preview-name');
const fileProgressFill = document.getElementById('file-progress-fill');
const cancelUploadBtn = document.getElementById('cancel-upload-btn');

// Avatar DP & Feed Elements
const avatarInput = document.getElementById('avatar-input');
const feedPosts = document.getElementById('feed-posts');
const openCreatePostBtn = document.getElementById('open-create-post-btn');
const postModal = document.getElementById('post-modal');
const closePostModal = document.getElementById('close-post-modal');
const postImageInput = document.getElementById('post-image-input');
const postImageStatus = document.getElementById('post-image-status');
const postCaptionInput = document.getElementById('post-caption-input');
const createPostSubmit = document.getElementById('create-post-submit');

// Calling Elements
const callOverlay = document.getElementById('call-overlay');
const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const localVideoContainer = document.getElementById('local-video-container');
const videoPlaceholder = document.getElementById('video-placeholder');
const callAvatarInitial = document.getElementById('call-avatar-initial');
const callStatusLabel = document.getElementById('call-status-label');

const outgoingCallUI = document.getElementById('outgoing-call-ui');
const outgoingName = document.getElementById('outgoing-name');
const cancelCallBtn = document.getElementById('cancel-call-btn');

const incomingCallUI = document.getElementById('incoming-call-ui');
const incomingCallerName = document.getElementById('incoming-caller-name');
const declineCallBtn = document.getElementById('decline-call-btn');
const acceptAudioCallBtn = document.getElementById('accept-audio-call-btn');
const acceptVideoCallBtn = document.getElementById('accept-video-call-btn');

const activeCallControls = document.getElementById('active-call-controls');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const shareScreenBtn = document.getElementById('share-screen-btn');
const hangupBtn = document.getElementById('hangup-btn');

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  setupUIEvents();
  if (token) {
    autoLogin();
  }
});

// Auto-Login if JWT token exists
async function autoLogin() {
  try {
    const res = await apiFetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 200) {
      currentUser = await res.json();
      showMainApplication();
    } else {
      handleLogout();
    }
  } catch (err) {
    console.error('Auto login check failed', err);
    handleLogout();
  }
}

// Show the main AeroTalk Dashboard
function showMainApplication() {
  const landing = document.getElementById('landing-screen');
  if (landing) landing.classList.add('hidden');
  authScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');
  
  // Set default viewports state for mobile (show feed viewport by default)
  appContainer.classList.remove('show-sidebar-drawer');
  appContainer.classList.add('show-chat-viewport');

  // Set Profile
  myUsername.textContent = currentUser.username;
  myEmail.textContent = currentUser.email;
  renderAvatar(myAvatar, currentUser.username, currentUser.avatarUrl, currentUser.avatarColor);
  
  initializeRealtime();
  
  // Request notifications permissions
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  switchDockTab('feed'); // Load default feed dock tab
}

function handleLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('aerotalk_token');
  
  if (socket) socket.disconnect();
  if (peer) peer.destroy();

  appContainer.classList.add('hidden');
  authScreen.classList.add('hidden');
  const landing = document.getElementById('landing-screen');
  if (landing) landing.classList.remove('hidden');
}

// --- Setup Realtime Presence, Sockets and WebRTC ---

function registerSocket() {
  if (socket && socket.connected && currentUser) {
    socket.emit('register', {
      email: currentUser.email,
      peerId: (peer && peer.id) ? peer.id : null
    });
    console.log('Socket registered presence for:', currentUser.email, 'Peer ID:', (peer && peer.id) ? peer.id : 'Pending');
  }
}

function initializeRealtime() {
  // Initialize Socket.io connection pointing to dynamic production API URL
  socket = io(API_BASE_URL, {
    transports: ['polling', 'websocket']
  });

  // Initialize PeerJS with robust STUN/TURN ICE config to relay streams across cell networks/strict NATs
  peer = new Peer(undefined, {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turns:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:turn.viagenie.ca:3478',
          username: 'quickstart',
          credential: 'viagenie'
        }
      ]
    }
  });

  socket.on('connect', () => {
    registerSocket();
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
  });

  peer.on('open', async (id) => {
    // Load initial directories sequentially to avoid rendering race conditions
    await Promise.all([fetchFriends(), fetchGroups()]);
    loadActiveChats();
    registerSocket();
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    if (err.type === 'peer-unavailable') {
      alert('The requested peer is unavailable or offline.');
      stopRingtone();
      hideCallOverlay();
    }
  });

  // Handle incoming calls (WebRTC)
  peer.on('call', (call) => {
    handleIncomingCall(call);
  });

  // Handle Socket Events
  socket.on('presence_change', ({ email, isOnline, lastSeen }) => {
    const friend = friendsList.find(f => f.email === email);
    if (friend) {
      friend.isOnline = isOnline;
      if (lastSeen) {
        friend.lastSeen = lastSeen;
      }
      updateFriendsUI();
      updateActiveChatsUI();
      if (activeChatType === 'direct' && activeChatId === email) {
        updateChatHeaderPresence(isOnline, friend.lastSeen);
      }
    }
  });

  socket.on('friend_update', () => {
    fetchFriends();
  });

  socket.on('group_added', (group) => {
    socket.emit('join_group_room', { groupId: group.id });
    fetchGroups();
  });

  socket.on('direct_message', (msg) => {
    const isIncoming = msg.from !== currentUser.email;
    const partnerEmail = isIncoming ? msg.from : msg.to;
    
    // Trigger desktop/mobile OS native push alert notification if user is not looking at this chat
    const isCurrentlyChatting = activeChatType === 'direct' && activeChatId === msg.from;
    if (isIncoming && (document.hidden || !isCurrentlyChatting)) {
      const senderName = peerNameMap[msg.from] || msg.from;
      const displayBody = msg.content.startsWith('<div') ? 'Shared an attachment/voice note' : msg.content;
      
      // 1. Browser Native desktop alert
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`New Message from ${senderName}`, {
          body: displayBody,
          icon: '/icon.jpg'
        });
      }
      
      // 2. Spatial glass in-app toast notification popup
      showInAppToast(senderName, displayBody);
    }

    // Save to active session cache
    if (!activeChats.includes(partnerEmail)) {
      activeChats.push(partnerEmail);
      saveActiveChats();
      updateActiveChatsUI();
    }

    if (activeChatType === 'direct' && activeChatId === partnerEmail) {
      appendMessageUI(msg);
      if (isIncoming) {
        SoundEffects.playMessageReceived();
      }
    } else {
      if (isIncoming) {
        SoundEffects.playMessageReceived();
      }
    }
  });

  socket.on('group_message', (msg) => {
    const isIncoming = msg.from !== currentUser.email;
    
    // Save to active session cache
    if (!activeChats.includes(msg.groupId)) {
      activeChats.push(msg.groupId);
      saveActiveChats();
      updateActiveChatsUI();
    }

    if (activeChatType === 'group' && activeChatId === msg.groupId) {
      appendMessageUI(msg);
      if (isIncoming) {
        SoundEffects.playMessageReceived();
      }
    } else {
      if (isIncoming) {
        SoundEffects.playMessageReceived();
      }
    }
  });

  socket.on('typing_direct', ({ from, isTyping }) => {
    if (activeChatType === 'direct' && activeChatId === from) {
      if (isTyping) {
        typingIndicator.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        typingIndicator.classList.add('hidden');
      }
    }
  });

  socket.on('typing_group', ({ groupId, from, isTyping }) => {
    if (activeChatType === 'group' && activeChatId === groupId) {
      if (isTyping) {
        typingIndicator.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        typingIndicator.classList.add('hidden');
      }
    }
  });

  socket.on('new_feed_post', (post) => {
    if (document.getElementById('dock-feed-btn').classList.contains('active')) {
      fetchFeed();
    }
  });

  socket.on('mood_changed', ({ email, mood }) => {
    console.log(`[Socket Presence] Friend "${email}" updated mood: "${mood}"`);
    const friend = friendsList.find(f => f.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (friend) {
      friend.mood = mood;
      updateFriendsUI();
    }
  });
}

// --- API Network Requests ---

async function fetchFriends() {
  try {
    const res = await apiFetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    friendsList = await res.json();
    
    // Update local cache details maps
    friendsList.forEach(f => {
      peerNameMap[f.email] = f.username;
      peerAvatarMap[f.email] = f.avatarColor;
      peerAvatarUrlMap[f.email] = f.avatarUrl || null;
    });

    updateFriendsUI();
    updateActiveChatsUI();
  } catch (err) {
    console.error('Failed to fetch friends list', err);
  }
}

async function fetchGroups() {
  try {
    const res = await apiFetch('/api/groups', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    groupsList = await res.json();
    updateGroupsUI();
  } catch (err) {
    console.error('Failed to fetch groups', err);
  }
}

async function fetchChatMessages(peerEmail) {
  try {
    const res = await apiFetch(`/api/chats/${peerEmail}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const history = await res.json();
    chatMessages.innerHTML = '';
    history.forEach(appendMessageUI);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error('Failed to load chats history', err);
  }
}

async function fetchGroupMessages(groupId) {
  try {
    const res = await apiFetch(`/api/groups/${groupId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const history = await res.json();
    chatMessages.innerHTML = '';
    history.forEach(appendMessageUI);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error('Failed to load group messages', err);
  }
}

// Social Feed API requests
async function fetchFeed() {
  try {
    const res = await apiFetch('/api/feed', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const posts = await res.json();
    renderFeed(posts);
  } catch (err) {
    console.error('Failed to load social feed', err);
  }
}

function renderFeed(posts) {
  // Update personalized greeting
  const greetingEl = document.getElementById('feed-personalized-greeting');
  if (greetingEl && currentUser) {
    const hours = new Date().getHours();
    let greet = "Hello";
    if (hours < 12) greet = "Good Morning";
    else if (hours < 18) greet = "Good Afternoon";
    else greet = "Good Evening";
    greetingEl.textContent = `${greet}, ${currentUser.username || 'Explorer'} 👋`;
  }

  feedPosts.innerHTML = '';
  if (posts.length === 0) {
    feedPosts.innerHTML = `<div class="empty-state">No posts yet. Be the first to share!</div>`;
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'feed-card entrance-anim';

    const timeFormatted = new Date(post.timestamp).toLocaleString();
    
    // DP render for post author
    const hasAvatarImg = post.avatarUrl ? `style="background-image: url(${post.avatarUrl}); background-color: transparent" class="avatar has-image"` : `style="background-color: var(--primary-color)" class="avatar"`;
    const avatarContent = post.avatarUrl ? '' : post.username.charAt(0).toUpperCase();

    // AI Fact check simulation
    const confidence = post.confidence || Math.floor(Math.random() * 15) + 85;
    const isReliable = confidence >= 90;
    const badgeClass = isReliable ? 'high' : 'warn';
    const badgeText = isReliable ? `${confidence}% Verified` : `${confidence}% Low Trust`;

    card.innerHTML = `
      <div class="feed-header">
        <div class="feed-header-left">
          <div ${hasAvatarImg}>${avatarContent}</div>
          <div class="feed-user-details">
            <h4 style="display: flex; align-items: center; gap: 8px;">
              ${escapeHTML(post.username)}
              <span class="fact-check-badge ${badgeClass}" title="AI Fact Check Score"><i data-lucide="shield-check"></i> ${badgeText}</span>
            </h4>
            <span>${timeFormatted}</span>
          </div>
        </div>
        <div class="feed-header-right">
          <button class="btn-follow-creator">Follow</button>
          <button class="icon-btn-inline hover-scale" title="More options"><i data-lucide="more-horizontal"></i></button>
        </div>
      </div>
      
      ${post.caption ? `<div class="feed-caption">${escapeHTML(post.caption)}</div>` : ''}
      
      <div class="feed-image-container">
        <img src="${post.imageUrl}" class="feed-image" alt="Feed image" loading="lazy">
      </div>
      
      <!-- Reactions row -->
      <div class="feed-actions-row">
        <button class="reaction-btn" data-reaction="inspired"><i data-lucide="sparkles"></i> Inspired (0)</button>
        <button class="reaction-btn" data-reaction="learned"><i data-lucide="book-open"></i> Learned (0)</button>
        <button class="reaction-btn" data-reaction="relate"><i data-lucide="heart"></i> Relatable (0)</button>
        <button class="reaction-share-btn" title="Share Post"><i data-lucide="share-2"></i> Share</button>
      </div>

      <!-- Post Aero AI Feature Panel -->
      <div class="post-ai-panel-wrapper mt-2">
        <div class="post-ai-actions-row">
          <button class="post-ai-pill btn-ai-sum" data-action="sum"><i data-lucide="scroll"></i> Summarize</button>
          <button class="post-ai-pill btn-ai-fact" data-action="fact"><i data-lucide="shield-alert"></i> Fact Check</button>
          <button class="post-ai-pill btn-ai-trans" data-action="trans"><i data-lucide="languages"></i> Translate</button>
          <button class="post-ai-pill btn-ai-reply" data-action="reply"><i data-lucide="message-square"></i> Draft Reply</button>
        </div>
        <div class="post-ai-explanation hidden" id="post-ai-exp-${post.id}">
          <div class="ai-explanation-header">
            <i data-lucide="bot" class="glow-cyan small-icon"></i>
            <span>Aero AI insights</span>
          </div>
          <p class="ai-explanation-text">Analyzing...</p>
        </div>
      </div>
    `;

    // Bind reaction clicks
    card.querySelectorAll('.reaction-btn').forEach(btn => {
      let count = 0;
      let active = false;
      const type = btn.getAttribute('data-reaction');
      
      btn.addEventListener('click', () => {
        active = !active;
        count = active ? count + 1 : count - 1;
        btn.classList.toggle('active', active);
        
        let label = '';
        if (type === 'inspired') label = `Inspired (${count})`;
        else if (type === 'learned') label = `Learned (${count})`;
        else if (type === 'relate') label = `Relatable (${count})`;
        
        btn.innerHTML = `${active ? '<i data-lucide="check"></i>' : ''} ${label}`;
        window.lucide.createIcons();
      });
    });

    // Double click image to inspire
    const img = card.querySelector('.feed-image');
    if (img) {
      img.addEventListener('dblclick', () => {
        const inspireBtn = card.querySelector('.reaction-btn[data-reaction="inspired"]');
        if (inspireBtn) inspireBtn.click();
      });
    }

    // Follow button click
    const followBtn = card.querySelector('.btn-follow-creator');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        followBtn.classList.toggle('following');
        followBtn.textContent = followBtn.classList.contains('following') ? 'Following' : 'Follow';
      });
    }

    // Bind Post AI Action buttons
    const aiExpPanel = card.querySelector(`#post-ai-exp-${post.id}`);
    const aiExpText = card.querySelector('.ai-explanation-text');
    
    card.querySelectorAll('.post-ai-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-action');
        card.querySelectorAll('.post-ai-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        aiExpPanel.classList.remove('hidden');

        let textVal = "";
        const captionClean = post.caption || "AeroTalk Story";
        if (act === 'sum') {
          textVal = `[AI Summary] This feed entry details a visual capture titled "${captionClean}" shared by ${post.username}. It highlights community engagement with a fact-checked confidence rating of ${confidence}%.`;
        } else if (act === 'fact') {
          textVal = `[AI Fact Check] Confidence Score: ${confidence}%. The content regarding "${captionClean}" is verified to be accurate according to database schemas and community reviews.`;
        } else if (act === 'trans') {
          textVal = `[AI Translation - Spanish] "${captionClean}" translates to: "¡Miren esta increíble actualización compartida hoy en AeroTalk!"`;
        } else if (act === 'reply') {
          textVal = `[AI Cues for draft Reply] 1. "That's super inspiring, ${post.username}! Love the vibe." • 2. "Great update, let's connect in a group call!"`;
        }

        aiExpText.textContent = textVal;
        window.lucide.createIcons();
      });
    });

    feedPosts.appendChild(card);
  });
  window.lucide.createIcons();
}

// Global Avatar Rendering Helper
function renderAvatar(avatarEl, name, avatarUrl, avatarColor) {
  if (!avatarEl) return;
  if (avatarUrl) {
    avatarEl.style.backgroundImage = `url(${avatarUrl})`;
    avatarEl.style.backgroundColor = 'transparent';
    avatarEl.classList.add('has-image');
    avatarEl.textContent = '';
  } else {
    avatarEl.style.backgroundImage = 'none';
    avatarEl.style.backgroundColor = avatarColor || 'var(--primary-color)';
    avatarEl.classList.remove('has-image');
    avatarEl.textContent = (name || '?').charAt(0).toUpperCase();
  }
}

// Clickable link formatter
function urlify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`;
  });
}

// Search users globally
async function searchUsersByEmail(query) {
  if (!query.trim()) {
    searchResults.classList.add('hidden');
    return;
  }

  try {
    const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await res.json();
    
    searchResults.innerHTML = '';
    if (users.length === 0) {
      searchResults.innerHTML = `<li class="empty-state">No users found</li>`;
    } else {
      users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'search-item';
        li.innerHTML = `
          <div class="search-info">
            <div class="search-avatar" style="background-color: ${u.avatarColor}">${u.username.charAt(0).toUpperCase()}</div>
            <div class="search-meta">
              <h4>${escapeHTML(u.username)}</h4>
              <p>${escapeHTML(u.email)}</p>
            </div>
          </div>
          <button class="icon-btn-inline add-friend-action" title="Add Friend">
            <i data-lucide="user-plus" class="small-icon"></i>
          </button>
        `;

        li.querySelector('.add-friend-action').addEventListener('click', async (e) => {
          e.stopPropagation();
          await sendFriendRequest(u.email);
        });

        searchResults.appendChild(li);
      });
      window.lucide.createIcons();
    }
    searchResults.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to search users', err);
  }
}

async function sendFriendRequest(targetEmail) {
  try {
    const res = await apiFetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetEmail })
    });
    const result = await res.json();
    if (res.status === 200) {
      alert(result.status === 'accepted' ? 'Friend request accepted!' : 'Friend request sent!');
      searchResults.classList.add('hidden');
      friendSearchInput.value = '';
      fetchFriends();
    } else {
      alert(result.error);
    }
  } catch (err) {
    console.error('Friend request error', err);
  }
}

async function acceptFriendRequest(senderEmail) {
  try {
    const res = await apiFetch('/api/friends/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ senderEmail })
    });
    if (res.status === 200) {
      fetchFriends();
    }
  } catch (err) {
    console.error('Failed to accept friend request', err);
  }
}

async function declineFriendRequest(targetEmail) {
  try {
    const res = await apiFetch('/api/friends/decline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetEmail })
    });
    if (res.status === 200) {
      fetchFriends();
    }
  } catch (err) {
    console.error('Failed to decline friend request', err);
  }
}

// --- Call Logic mapped automatically over server peer addresses ---

async function initiateCall(type) {
  if (activeChatType !== 'direct') return;
  const targetEmail = activeChatId;

  showCallOverlay();
  setupCallUI('outgoing', type, peerNameMap[targetEmail] || targetEmail);
  activeCallRing = SoundEffects.startOutgoingRing();

  try {
    // 1. Ask API for target's WebRTC Peer ID
    const peerRes = await apiFetch(`/api/users/${targetEmail}/peer`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (peerRes.status !== 200) {
      alert('The recipient user is currently offline.');
      stopRingtone();
      hideCallOverlay();
      return;
    }

    const { peerId } = await peerRes.json();

    // 2. Open local media streams with adaptive fallback
    let constraints = { audio: true, video: type === 'video' };
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (mediaErr) {
      console.warn("Failed to get requested call media constraints:", mediaErr);
      if (type === 'video') {
        alert("Webcam not detected or access blocked. Attempting audio-only fallback...");
        type = 'audio';
        constraints = { audio: true, video: false };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        // Switch outgoing UI state label
        callStatusLabel.textContent = `Dialing audio call...`;
      } else {
        throw mediaErr;
      }
    }

    if (type === 'video') {
      localVideo.srcObject = localStream;
      localVideoContainer.classList.remove('hidden');
    }

    // 3. Place WebRTC call using PeerJS
    const call = peer.call(peerId, localStream, {
      metadata: {
        username: currentUser.username,
        type: type
      }
    });

    setupMediaCall(call, type);
  } catch (err) {
    console.error('Error placing media call', err);
    alert('Access to microphone/camera denied or call aborted.');
    stopRingtone();
    hideCallOverlay();
  }
}

function handleIncomingCall(call) {
  if (activeCall) {
    // Send instant close response
    call.answer();
    setTimeout(() => call.close(), 500);
    return;
  }

  showCallOverlay();
  const callerName = call.metadata?.username || 'Peer';
  const type = call.metadata?.type || 'video';

  setupCallUI('incoming', type, callerName);
  activeCall = call;
  activeCallRing = SoundEffects.startIncomingRing();
}

async function acceptIncomingCall(type) {
  stopRingtone();
  setupCallUI('active', type, activeCall.metadata?.username || 'Peer');

  try {
    let constraints = { audio: true, video: type === 'video' };
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (mediaErr) {
      console.warn("Failed to get answer media constraints:", mediaErr);
      if (type === 'video') {
        alert("Webcam not detected or access blocked. Answering with audio only...");
        type = 'audio';
        constraints = { audio: true, video: false };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        // Update call controls state
        setupCallUI('active', 'audio', activeCall.metadata?.username || 'Peer');
      } else {
        throw mediaErr;
      }
    }

    if (type === 'video') {
      localVideo.srcObject = localStream;
      localVideoContainer.classList.remove('hidden');
    }

    activeCall.answer(localStream);
    setupMediaCall(activeCall, type);
    SoundEffects.playCallConnected();
  } catch (err) {
    console.error('Failed to answer call', err);
    alert('Could not open camera or microphone.');
    activeCall.close();
    hideCallOverlay();
  }
}

function setupMediaCall(call, type) {
  activeCall = call;

  call.on('stream', (stream) => {
    stopRingtone();
    setupCallUI('active', type, call.metadata?.username || 'Peer');

    remoteVideo.srcObject = stream;
    remoteVideo.classList.remove('hidden');
    videoPlaceholder.classList.add('hidden');

    const remoteAudio = document.getElementById('remote-audio');
    if (remoteAudio) {
      remoteAudio.srcObject = stream;
    }
  });

  call.on('close', () => {
    closeActiveCall(true);
  });

  call.on('error', (err) => {
    console.error('Media Call error:', err);
    closeActiveCall(true);
  });
}

function closeActiveCall(remoteClosed = false) {
  stopRingtone();
  
  if (activeCall) {
    activeCall.close();
    activeCall = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }

  // Reset UI
  remoteVideo.srcObject = null;
  const remoteAudio = document.getElementById('remote-audio');
  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }
  localVideo.srcObject = null;
  localVideoContainer.classList.add('hidden');
  remoteVideo.classList.add('hidden');
  videoPlaceholder.classList.remove('hidden');
  hideCallOverlay();

  SoundEffects.playCallDisconnected();

  // Reset dashboards
  isMuted = false;
  isVideoOff = false;
  isScreenSharing = false;
  toggleMicBtn.classList.remove('active');
  toggleCamBtn.classList.remove('active');
  shareScreenBtn.classList.remove('active');
}

function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
  toggleMicBtn.classList.toggle('active', isMuted);
  toggleMicBtn.innerHTML = isMuted ? '<i data-lucide="mic-off"></i>' : '<i data-lucide="mic"></i>';
  window.lucide.createIcons();
}

function toggleCamera() {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length === 0) return alert('No camera track available.');

  isVideoOff = !isVideoOff;
  videoTracks.forEach(track => { track.enabled = !isVideoOff; });

  toggleCamBtn.classList.toggle('active', isVideoOff);
  toggleCamBtn.innerHTML = isVideoOff ? '<i data-lucide="video-off"></i>' : '<i data-lucide="video"></i>';
  window.lucide.createIcons();
  
  if (isVideoOff) {
    localVideoContainer.classList.add('hidden');
  } else {
    localVideoContainer.classList.remove('hidden');
  }
}

async function toggleScreenShare() {
  if (!activeCall) return;

  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      const sender = activeCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }

      localVideo.srcObject = screenStream;
      localVideoContainer.classList.remove('hidden');
      isScreenSharing = true;
      shareScreenBtn.classList.add('active');

      screenTrack.onended = () => stopScreenSharing();
    } catch (err) {
      console.error('Failed screen share', err);
    }
  } else {
    stopScreenSharing();
  }
}

function stopScreenSharing() {
  if (!isScreenSharing) return;
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }

  if (localStream) {
    const cameraTrack = localStream.getVideoTracks()[0];
    const sender = activeCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender && cameraTrack) {
      sender.replaceTrack(cameraTrack);
    }
    localVideo.srcObject = localStream;
  }
  isScreenSharing = false;
  shareScreenBtn.classList.remove('active');
}

function stopRingtone() {
  if (activeCallRing) {
    activeCallRing.stop();
    activeCallRing = null;
  }
}

// --- Text Chats & File Sharing ---

async function handleSendMessage() {
  const content = chatInput.value.trim();
  if (!content && !selectedFile) return;

  let fileUrl = null;
  let fileName = null;

  // Handle uploading if file selected
  if (selectedFile) {
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      fileProgressFill.style.width = '50%'; // Simple mock loading state

      const uploadRes = await apiFetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (uploadRes.status === 200) {
        const fileData = await uploadRes.json();
        fileUrl = fileData.fileUrl;
        fileName = fileData.fileName;
        fileProgressFill.style.width = '100%';
      } else {
        alert('File upload failed.');
        resetFileUpload();
        return;
      }
    } catch (err) {
      console.error('Upload error', err);
      alert('Upload failed.');
      resetFileUpload();
      return;
    }
  }

  if (activeChatType === 'direct') {
    socket.emit('send_direct_message', {
      to: activeChatId,
      content,
      fileUrl,
      fileName
    });
  } else {
    socket.emit('send_group_message', {
      groupId: activeChatId,
      content,
      fileUrl,
      fileName
    });
  }

  chatInput.value = '';
  resetFileUpload();
  notifyTyping(true);
  SoundEffects.playMessageSent();
}

function resetFileUpload() {
  selectedFile = null;
  fileInput.value = '';
  filePreviewCard.classList.add('hidden');
  fileProgressFill.style.width = '0%';
}

// Typing events
let typingTimeout = null;
function notifyTyping(stopNow = false) {
  if (stopNow) {
    clearTimeout(typingTimeout);
    if (activeChatType === 'direct') {
      socket.emit('typing_direct', { to: activeChatId, isTyping: false });
    } else {
      socket.emit('typing_group', { groupId: activeChatId, isTyping: false });
    }
    return;
  }

  if (!typingTimeout) {
    if (activeChatType === 'direct') {
      socket.emit('typing_direct', { to: activeChatId, isTyping: true });
    } else {
      socket.emit('typing_group', { groupId: activeChatId, isTyping: true });
    }
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (activeChatType === 'direct') {
      socket.emit('typing_direct', { to: activeChatId, isTyping: false });
    } else {
      socket.emit('typing_group', { groupId: activeChatId, isTyping: false });
    }
    typingTimeout = null;
  }, 2000);
}

// --- Group Creation Modal Logic ---

function populateGroupMembersChecklist() {
  groupMembersList.innerHTML = '';
  const friends = friendsList.filter(f => f.status === 'accepted');

  if (friends.length === 0) {
    groupMembersList.innerHTML = `<li class="empty-state">No friends to add. Add friends first!</li>`;
    return;
  }

  friends.forEach(f => {
    const li = document.createElement('li');
    li.className = 'member-check-item';
    li.innerHTML = `
      <input type="checkbox" id="check-${f.email}" value="${f.email}">
      <label for="check-${f.email}">${escapeHTML(f.username)} (${escapeHTML(f.email)})</label>
    `;
    groupMembersList.appendChild(li);
  });
}

async function handleCreateGroup() {
  const name = groupNameInput.value.trim();
  if (!name) return alert('Please enter a group name.');

  const checkboxes = groupMembersList.querySelectorAll('input[type="checkbox"]:checked');
  const members = Array.from(checkboxes).map(cb => cb.value);

  try {
    const res = await apiFetch('/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, members })
    });

    if (res.status === 201) {
      const group = await res.json();
      socket.emit('join_group_room', { groupId: group.id });
      
      // Close modal & reset fields
      groupModal.classList.add('hidden');
      groupNameInput.value = '';
      
      fetchGroups();
      openChatWindow('group', group.id);
    } else {
      const err = await res.json();
      alert(err.error);
    }
  } catch (err) {
    console.error('Failed to create group', err);
  }
}

// --- UI Rendering Builders ---

function openChatWindow(type, id) {
  activeChatId = id;
  activeChatType = type;

  localStorage.setItem(`aerotalk_last_chat_id_${currentUser.email}`, id);
  localStorage.setItem(`aerotalk_last_chat_type_${currentUser.email}`, type);

  chatBlankState.classList.add('hidden');
  chatActiveWindow.classList.remove('hidden');
  
  if (type === 'direct') {
    const partner = friendsList.find(f => f.email === id);
    const displayName = partner ? partner.username : id;
    
    peerDisplayName.textContent = displayName;
    renderAvatar(chatAvatar, displayName, partner ? partner.avatarUrl : null, partner ? partner.avatarColor : 'var(--primary-color)');
    
    const isOnline = partner ? partner.isOnline : false;
    const lastSeen = partner ? partner.lastSeen : null;
    updateChatHeaderPresence(isOnline, lastSeen);

    callActionsHeader.classList.remove('hidden');
    fetchChatMessages(id);
  } else {
    // Group chat
    const group = groupsList.find(g => g.id === id);
    const displayName = group ? group.name : 'Group Chat';

    peerDisplayName.textContent = displayName;
    renderAvatar(chatAvatar, displayName, null, 'var(--primary-color)');
    
    // Groups have no direct online calling header actions
    peerStatus.textContent = 'Group Workspace';
    peerStatus.style.color = 'var(--text-secondary)';
    chatStatusIndicator.className = 'status-indicator';

    callActionsHeader.classList.add('hidden');
    fetchGroupMessages(id);
  }

  // Save/cache session
  if (!activeChats.includes(id)) {
    activeChats.push(id);
    saveActiveChats();
    updateActiveChatsUI();
  }

  // Toggles mobile display class to reveal the chat window panel
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.classList.remove('show-sidebar-drawer');
    appEl.classList.add('show-chat-viewport');
  }
}

function formatLastSeen(timestamp) {
  if (!timestamp) return 'Offline';
  
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  
  if (diff < 10000) return 'Last seen just now'; // less than 10s
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `Last seen ${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) return `Last seen ${days}d ago`;
  
  return `Last seen on ${new Date(timestamp).toLocaleDateString()}`;
}

function updateChatHeaderPresence(isOnline, lastSeen = null) {
  chatStatusIndicator.className = 'status-indicator' + (isOnline ? ' online' : '');
  if (isOnline) {
    peerStatus.textContent = 'Online';
    peerStatus.style.color = 'var(--success-color)';
  } else {
    peerStatus.textContent = formatLastSeen(lastSeen);
    peerStatus.style.color = 'var(--text-muted)';
  }
}

function appendMessageUI(msg) {
  const container = document.createElement('div');
  container.className = `message-container ${msg.from === currentUser.email ? 'outgoing' : 'incoming'}`;
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.justifyContent = msg.from === currentUser.email ? 'flex-end' : 'flex-start';
  container.style.margin = '8px 0';

  const bubble = document.createElement('div');
  const isSelf = msg.from === currentUser.email;
  bubble.className = `message-bubble ${isSelf ? 'outgoing' : 'incoming'}`;
  bubble.style.position = 'relative';

  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderName = isSelf ? 'You' : (peerNameMap[msg.from] || msg.from);

  let fileHtml = '';
  if (msg.fileUrl) {
    fileHtml = `
      <div class="file-attachment">
        <i data-lucide="file"></i>
        <div class="file-attachment-info">
          <div class="file-attachment-name" title="${escapeHTML(msg.fileName)}">${escapeHTML(msg.fileName)}</div>
          <a href="${msg.fileUrl}" class="download-link" download="${escapeHTML(msg.fileName)}">
            <i data-lucide="download" class="small-icon"></i> Download
          </a>
        </div>
      </div>
    `;
  }

  let contentHtml = '';
  if (msg.content) {
    if (msg.content.startsWith('<div class="voice-waveform-container"')) {
      contentHtml = `<div class="message-content">${msg.content}</div>`;
    } else {
      contentHtml = `<div class="message-content">${urlify(escapeHTML(msg.content))}</div>`;
    }
  }

  bubble.innerHTML = `
    ${fileHtml}
    ${contentHtml}
    <div class="message-meta" style="font-size: 0.65rem; opacity: 0.7; margin-top: 4px;">${escapeHTML(senderName)} • ${timeFormatted}</div>
  `;

  // Reactions Toolbar
  const reactionsToolbar = document.createElement('div');
  reactionsToolbar.className = 'msg-reactions-toolbar';
  reactionsToolbar.innerHTML = `
    <button class="reaction-emoji-btn">❤️</button>
    <button class="reaction-emoji-btn">👍</button>
    <button class="reaction-emoji-btn">🔥</button>
    <button class="reaction-emoji-btn">😆</button>
    <button class="reaction-emoji-btn">😮</button>
  `;

  // Bind reactions click
  reactionsToolbar.querySelectorAll('.reaction-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      let badge = bubble.querySelector('.reaction-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'reaction-badge';
        badge.style.cssText = 'position: absolute; bottom: -8px; right: 12px; background: rgba(30, 41, 59, 0.95); border: 1px solid var(--panel-border); border-radius: 10px; padding: 2px 6px; font-size: 0.7rem; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
        bubble.appendChild(badge);
      }
      badge.textContent = btn.textContent;
    });
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'message';
  wrapper.style.position = 'relative';
  wrapper.appendChild(bubble);
  wrapper.appendChild(reactionsToolbar);

  container.appendChild(wrapper);

  chatMessages.appendChild(container);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  window.lucide.createIcons();
}

function updateFriendsUI() {
  const friendsListEl = document.getElementById('friends-list');
  const incomingReqList = document.getElementById('incoming-requests-list');
  
  if (friendsListEl) friendsListEl.innerHTML = '';
  if (incomingReqList) incomingReqList.innerHTML = '';

  const acceptedFriends = friendsList.filter(f => f.status === 'accepted');
  const pendingRequests = friendsList.filter(f => f.status === 'pending');

  // 1. Render Requests (Incoming & Outgoing)
  if (incomingReqList) {
    if (pendingRequests.length > 0) {
      pendingRequests.forEach(f => {
        const div = document.createElement('div');
        div.className = 'request-card mb-2';
        
        const avatarStyle = f.avatarUrl 
          ? `style="background-image: url(${f.avatarUrl}); background-color: transparent" class="recent-avatar has-image"` 
          : `style="background-color: ${f.avatarColor}" class="recent-avatar"`;
        const avatarContent = f.avatarUrl ? '' : f.username.charAt(0).toUpperCase();

        if (f.role === 'receiver') {
          // Incoming: Avatar, Name, Accept, Decline
          div.innerHTML = `
            <div class="request-details-col">
              <div ${avatarStyle}>${avatarContent}</div>
              <div class="recent-details">
                <h3>${escapeHTML(f.username)}</h3>
                <p>Mutual Friends: 0</p>
              </div>
            </div>
            <div class="request-btn-actions">
              <button class="btn-circle-action accept accept-friend-btn" title="Accept"><i data-lucide="check"></i></button>
              <button class="btn-circle-action decline decline-friend-btn" title="Decline"><i data-lucide="x"></i></button>
            </div>
          `;
          div.querySelector('.accept-friend-btn').addEventListener('click', () => acceptFriendRequest(f.email));
          div.querySelector('.decline-friend-btn').addEventListener('click', () => declineFriendRequest(f.email));
        } else {
          // Outgoing: Avatar, Pending badge, Cancel Request
          div.innerHTML = `
            <div class="request-details-col">
              <div ${avatarStyle}>${avatarContent}</div>
              <div class="recent-details">
                <h3>${escapeHTML(f.username)}</h3>
                <p style="font-style: italic; color: var(--text-muted);">Pending request...</p>
              </div>
            </div>
            <div class="request-btn-actions">
              <button class="btn btn-outline btn-sm-action cancel-friend-btn" style="font-size: 0.68rem; padding: 4px 8px;">Cancel</button>
            </div>
          `;
          div.querySelector('.cancel-friend-btn').addEventListener('click', () => declineFriendRequest(f.email));
        }
        incomingReqList.appendChild(div);
      });
    }
  }

  // 2. Render Friends Directory List
  if (friendsListEl) {
    if (acceptedFriends.length === 0) {
      friendsListEl.innerHTML = `<li class="empty-state">No friends added yet. Search above to add.</li>`;
    } else {
      acceptedFriends.forEach(f => {
        const li = document.createElement('li');
        li.className = 'recent-item';

        const avatarStyle = f.avatarUrl 
          ? `style="background-image: url(${f.avatarUrl}); background-color: transparent" class="recent-avatar has-image"` 
          : `style="background-color: ${f.avatarColor}" class="recent-avatar"`;
        const avatarContent = f.avatarUrl ? '' : f.username.charAt(0).toUpperCase();

        const statusText = f.isOnline ? 'Online' : formatLastSeen(f.lastSeen);
        const statusColor = f.isOnline ? 'var(--success-color)' : 'var(--text-muted)';
        
        li.innerHTML = `
          <div class="recent-info-row">
            <div ${avatarStyle}>
              ${avatarContent}
              <span class="recent-indicator ${f.isOnline ? 'online' : ''}"></span>
            </div>
            <div class="recent-details">
              <h3>${escapeHTML(f.username)}</h3>
              <p style="font-size: 0.72rem; margin-top: 2px; color: ${statusColor};">${statusText}</p>
            </div>
          </div>
          <div class="recent-actions hover-actions-drawer">
            <button class="icon-btn-inline open-friend-chat" title="Message">
              <i data-lucide="message-square" class="small-icon"></i>
            </button>
            <button class="icon-btn-inline start-voice-call" title="Voice Call">
              <i data-lucide="phone" class="small-icon"></i>
            </button>
            <button class="icon-btn-inline start-video-call" title="Video Call">
              <i data-lucide="video" class="small-icon"></i>
            </button>
          </div>
        `;

        // Bind chat click
        li.querySelector('.open-friend-chat').addEventListener('click', (e) => {
          e.stopPropagation();
          openChatWindow('direct', f.email);
          switchDockTab('chats');
        });
        li.querySelector('.start-voice-call').addEventListener('click', (e) => {
          e.stopPropagation();
          openChatWindow('direct', f.email);
          initiateCall('audio');
        });
        li.querySelector('.start-video-call').addEventListener('click', (e) => {
          e.stopPropagation();
          openChatWindow('direct', f.email);
          initiateCall('video');
        });

        // Click whole row opens chat
        li.addEventListener('click', () => {
          openChatWindow('direct', f.email);
          switchDockTab('chats');
        });

        friendsListEl.appendChild(li);
      });
    }
  }
  window.lucide.createIcons();
}

function updateGroupsUI() {
  groupsListEl.innerHTML = '';
  if (groupsList.length === 0) {
    groupsListEl.innerHTML = `<li class="empty-state">You are not in any groups.</li>`;
    return;
  }

  groupsList.forEach(g => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.innerHTML = `
      <div class="recent-info-row">
        <div class="recent-avatar" style="background-color: var(--primary-color)">
          ${g.name.charAt(0).toUpperCase()}
        </div>
        <div class="recent-details">
          <h3>${escapeHTML(g.name)}</h3>
          <p>Created by ${escapeHTML(peerNameMap[g.createdBy] || g.createdBy)}</p>
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      openChatWindow('group', g.id);
      switchDockTab('chats');
    });

    groupsListEl.appendChild(li);
  });
  window.lucide.createIcons();
}

function updateActiveChatsUI() {
  activeChatsList.innerHTML = '';
  if (activeChats.length === 0) {
    activeChatsList.innerHTML = `<li class="empty-state">No active chats. Find a friend to connect.</li>`;
    return;
  }

  activeChats.forEach(id => {
    const isGroup = id.startsWith('grp_');
    const li = document.createElement('li');
    li.className = `recent-item ${id === activeChatId ? 'active' : ''}`;

    if (isGroup) {
      const group = groupsList.find(g => g.id === id);
      const name = group ? group.name : 'Group Chat';
      li.innerHTML = `
        <div class="recent-info-row">
          <div class="recent-avatar" style="background-color: var(--primary-color)">
            ${name.charAt(0).toUpperCase()}
          </div>
          <div class="recent-details">
            <h3>${escapeHTML(name)}</h3>
            <p>Group Workspace</p>
          </div>
        </div>
      `;
    } else {
      const friend = friendsList.find(f => f.email === id);
      const name = friend ? friend.username : id;
      const isOnline = friend ? friend.isOnline : false;
      const avatarColor = friend ? friend.avatarColor : 'var(--primary-color)';
      const avatarUrl = peerAvatarUrlMap[id] || (friend ? friend.avatarUrl : null);
      
      const hasAvatarImg = avatarUrl ? `style="background-image: url(${avatarUrl}); background-color: transparent" class="recent-avatar has-image"` : `style="background-color: ${avatarColor}" class="recent-avatar"`;
      const avatarContent = avatarUrl ? '' : name.charAt(0).toUpperCase();

      li.innerHTML = `
        <div class="recent-info-row">
          <div ${hasAvatarImg}>
            ${avatarContent}
            <span class="recent-indicator ${isOnline ? 'online' : ''}"></span>
          </div>
          <div class="recent-details">
            <h3>${escapeHTML(name)}</h3>
            <p>${escapeHTML(id)}</p>
          </div>
        </div>
      `;
    }

    li.addEventListener('click', () => {
      openChatWindow(isGroup ? 'group' : 'direct', id);
      updateActiveChatsUI();
    });

    activeChatsList.appendChild(li);
  });
  window.lucide.createIcons();
}

// Save active chat tabs locally
function saveActiveChats() {
  localStorage.setItem(`aerotalk_active_chats_${currentUser.email}`, JSON.stringify(activeChats));
}

function loadActiveChats() {
  const cached = localStorage.getItem(`aerotalk_active_chats_${currentUser.email}`);
  if (cached) {
    activeChats = JSON.parse(cached);
    updateActiveChatsUI();
  }

  const lastChatId = localStorage.getItem(`aerotalk_last_chat_id_${currentUser.email}`);
  const lastChatType = localStorage.getItem(`aerotalk_last_chat_type_${currentUser.email}`);
  if (lastChatId && lastChatType) {
    openChatWindow(lastChatType, lastChatId);
  }
}

// --- setup call UI screens helper ---

function setupCallUI(state, type, name) {
  outgoingCallUI.classList.add('hidden');
  incomingCallUI.classList.add('hidden');
  activeCallControls.classList.add('hidden');

  callAvatarInitial.textContent = name.charAt(0).toUpperCase();

  if (state === 'outgoing') {
    outgoingName.textContent = name;
    callStatusLabel.textContent = `Dialing ${type} call...`;
    outgoingCallUI.classList.remove('hidden');
  } 
  else if (state === 'incoming') {
    incomingCallerName.textContent = name;
    callStatusLabel.textContent = `Incoming ${type} call...`;
    incomingCallUI.classList.remove('hidden');
  } 
  else if (state === 'active') {
    callStatusLabel.textContent = `Connected (${type})`;
    activeCallControls.classList.remove('hidden');
  }
}

function showCallOverlay() { callOverlay.classList.remove('hidden'); }
function hideCallOverlay() { callOverlay.classList.add('hidden'); }

// --- UI Events Routing Declarations ---

function setupUIEvents() {
  
  // Mobile UI Navigation Toggles
  const mobileBackBtn = document.getElementById('mobile-back-btn');
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
      const appEl = document.getElementById('app');
      appEl.classList.remove('show-chat-viewport');
      appEl.classList.add('show-sidebar-drawer');
    });
  }

  const mobileTabs = ['feed', 'vibe', 'pulse', 'profile'];
  mobileTabs.forEach(tabId => {
    const btn = document.getElementById(`mobile-nav-${tabId}`);
    if (btn) {
      btn.addEventListener('click', () => switchDockTab(tabId));
    }
  });

  const mobileCreateBtn = document.getElementById('mobile-nav-create');
  if (mobileCreateBtn) {
    mobileCreateBtn.addEventListener('click', () => {
      switchDockTab('vibe');
      const shareMomentCheckbox = document.getElementById('share-as-moment');
      if (shareMomentCheckbox) shareMomentCheckbox.checked = true;
    });
  }

  // Auth Form Toggle Buttons
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authSubtitle.textContent = 'Create your secure account';
  });

  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authSubtitle.textContent = 'Sign in to your secure account';
  });

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.status === 200) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('aerotalk_token', token);
        loginEmail.value = '';
        loginPassword.value = '';
        showMainApplication();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Login server error.');
    }
  });

  // Register Submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = regUsername.value.trim();
    const email = regEmail.value.trim();
    const password = regPassword.value;

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });

      const data = await res.json();
      if (res.status === 201) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('aerotalk_token', token);
        regUsername.value = '';
        regEmail.value = '';
        regPassword.value = '';
        showMainApplication();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Registration server error.');
    }
  });

  // Logout Click
  logoutBtn.addEventListener('click', () => {
    handleLogout();
  });


  // Search Friend Email
  searchBtn.addEventListener('click', () => {
    searchUsersByEmail(friendSearchInput.value);
  });
  friendSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchUsersByEmail(friendSearchInput.value);
    }
  });

  // Hide Search Dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== friendSearchInput && e.target !== searchBtn) {
      searchResults.classList.add('hidden');
    }
  });

  // Group Create Popups
  openCreateGroupBtn.addEventListener('click', () => {
    populateGroupMembersChecklist();
    groupModal.classList.remove('hidden');
  });

  closeGroupModal.addEventListener('click', () => {
    groupModal.classList.add('hidden');
  });

  createGroupSubmit.addEventListener('click', handleCreateGroup);

  // File Upload Picker triggers
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      selectedFile = fileInput.files[0];
      filePreviewName.textContent = selectedFile.name;
      filePreviewCard.classList.remove('hidden');
    }
  });

  cancelUploadBtn.addEventListener('click', resetFileUpload);

  // Chat actions
  sendMsgBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    } else {
      notifyTyping();
    }
  });

  // Calling Buttons trigger
  headerAudioCallBtn.addEventListener('click', () => initiateCall('audio'));
  headerVideoCallBtn.addEventListener('click', () => initiateCall('video'));

  // Calling Dashboards
  cancelCallBtn.addEventListener('click', () => {
    closeActiveCall(false);
  });

  declineCallBtn.addEventListener('click', () => {
    closeActiveCall(false);
  });

  acceptAudioCallBtn.addEventListener('click', () => acceptIncomingCall('audio'));
  acceptVideoCallBtn.addEventListener('click', () => acceptIncomingCall('video'));

  hangupBtn.addEventListener('click', () => {
    closeActiveCall(false);
  });

  toggleMicBtn.addEventListener('click', toggleMute);
  toggleCamBtn.addEventListener('click', toggleCamera);
  shareScreenBtn.addEventListener('click', toggleScreenShare);

  // Avatar DP Change Click Handlers
  const myAvatarContainer = document.querySelector('.my-avatar-container');
  if (myAvatarContainer) {
    myAvatarContainer.addEventListener('click', () => avatarInput.click());
  }

  avatarInput.addEventListener('change', async () => {
    if (avatarInput.files.length === 0) return;
    const file = avatarInput.files[0];
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch('/api/users/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.status === 200) {
        const data = await res.json();
        currentUser.avatarUrl = data.avatarUrl;
        renderAvatar(myAvatar, currentUser.username, currentUser.avatarUrl, currentUser.avatarColor);
        registerSocket();
        fetchFriends();
      } else {
        alert('Failed to upload profile picture.');
      }
    } catch (err) {
      console.error('DP upload error', err);
    }
  });

  // Cover Photo Change trigger
  const profileCoverBanner = document.getElementById('profile-cover-banner');
  const coverInput = document.getElementById('cover-input');
  if (profileCoverBanner && coverInput) {
    profileCoverBanner.addEventListener('click', () => coverInput.click());
    coverInput.addEventListener('change', async () => {
      if (coverInput.files.length === 0) return;
      const file = coverInput.files[0];
      const formData = new FormData();
      formData.append('cover', file);

      try {
        const res = await apiFetch('/api/users/cover', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (res.status === 200) {
          const data = await res.json();
          profileCoverBanner.style.backgroundImage = `url(${data.coverUrl})`;
          alert('Cover banner updated successfully!');
        } else {
          alert('Failed to upload cover banner.');
        }
      } catch (err) {
        console.error('Cover upload error', err);
      }
    });
  }

  // Feed Modal Triggers (using new main dashboard elements)
  const openFeedPostBtn = document.getElementById('open-feed-post-modal-btn');
  if (openFeedPostBtn) {
    openFeedPostBtn.addEventListener('click', () => {
      postModal.classList.remove('hidden');
      postCaptionInput.value = '';
      postImageFile = null;
      postImageStatus.textContent = 'Select Photo';
    });
  }

  if (closePostModal) {
    closePostModal.addEventListener('click', () => {
      postModal.classList.add('hidden');
    });
  }

  if (postImageInput) {
    postImageInput.addEventListener('change', async () => {
      if (postImageInput.files.length === 0) return;
      const file = postImageInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      postImageStatus.textContent = 'Uploading photo...';

      try {
        const res = await apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (res.status === 200) {
          const data = await res.json();
          postImageFile = data.fileUrl;
          postImageStatus.textContent = `Selected: ${file.name}`;
        } else {
          postImageStatus.textContent = 'Upload failed';
          alert('Failed to upload post image.');
        }
      } catch (err) {
        console.error('Feed photo upload error', err);
        postImageStatus.textContent = 'Upload error';
      }
    });
  }

  if (createPostSubmit) {
    createPostSubmit.addEventListener('click', async () => {
      if (!postImageFile) return alert('Please select a photo to post.');
      const caption = postCaptionInput.value.trim();

      try {
        const res = await apiFetch('/api/feed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ imageUrl: postImageFile, caption })
        });

        if (res.status === 201) {
          postModal.classList.add('hidden');
          fetchFeed();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to create post');
        }
      } catch (err) {
        console.error('Post creation failed', err);
      }
    });
  }

  // --- Landing Screen Router triggers ---
  const landingScreen = document.getElementById('landing-screen');
  const getStartedBtn = document.getElementById('get-started-btn');
  const landingCtaTop = document.getElementById('landing-cta-top');
  const backToLandingBtn = document.getElementById('back-to-landing-btn');

  const showAuthScreen = (e) => {
    e.preventDefault();
    landingScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
  };

  if (getStartedBtn) getStartedBtn.addEventListener('click', showAuthScreen);
  if (landingCtaTop) landingCtaTop.addEventListener('click', showAuthScreen);
  if (backToLandingBtn) {
    backToLandingBtn.addEventListener('click', () => {
      authScreen.classList.add('hidden');
      landingScreen.classList.remove('hidden');
    });
  }

  // Explore AI Demo toggles (Landing Screen)
  const exploreDemoBtn = document.getElementById('explore-demo-btn');
  const demoCardContainer = document.getElementById('demo-card-container');
  const closeDemoBtn = document.getElementById('close-demo-btn');

  if (exploreDemoBtn && demoCardContainer) {
    exploreDemoBtn.addEventListener('click', () => {
      demoCardContainer.classList.toggle('hidden');
    });
  }
  if (closeDemoBtn) {
    closeDemoBtn.addEventListener('click', () => {
      demoCardContainer.classList.add('hidden');
    });
  }

  // Interactive Landing demo send button
  const demoBotSend = document.getElementById('demo-bot-send');
  const demoBotInput = document.getElementById('demo-bot-input');
  if (demoBotSend) {
    demoBotSend.addEventListener('click', handleDemoSend);
  }
  if (demoBotInput) {
    demoBotInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleDemoSend();
    });
  }

  // Mock SSO Login Buttons trigger
  document.querySelectorAll('.mock-sso-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const provider = btn.getAttribute('data-provider');
      alert(`Simulating secure SSO Authentication via ${provider}...`);
      
      // Auto-register mock user
      const rand = Math.floor(Math.random() * 1000);
      const email = `mock_${provider.toLowerCase()}${rand}@email.com`;
      const username = `${provider}_User${rand}`;
      const password = 'mock_sso_password_123';

      try {
        const regRes = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password })
        });
        const data = await regRes.json();
        if (regRes.status === 201) {
          token = data.token;
          currentUser = data.user;
          localStorage.setItem('aerotalk_token', token);
          landingScreen.classList.add('hidden');
          showMainApplication();
        } else {
          // If already exists, try logging in
          const logRes = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const logData = await logRes.json();
          if (logRes.status === 200) {
            token = logData.token;
            currentUser = logData.user;
            localStorage.setItem('aerotalk_token', token);
            landingScreen.classList.add('hidden');
            showMainApplication();
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
  });

  // Dock Buttons (Far-Left Dock routing panels)
  const dockChats = document.getElementById('dock-chats-btn');
  const dockFeed = document.getElementById('dock-feed-btn');
  const dockProfile = document.getElementById('dock-profile-btn');
  const dockDreams = document.getElementById('dock-dreams-btn');
  const dockSkills = document.getElementById('dock-skills-btn');
  const dockThemes = document.getElementById('dock-themes-btn');
  const dockAdmin = document.getElementById('dock-admin-btn');
  const dockPulse = document.getElementById('dock-pulse-btn');
  const dockAihub = document.getElementById('dock-aihub-btn');

  if (dockChats) dockChats.addEventListener('click', () => switchDockTab('chats'));
  if (dockFeed) dockFeed.addEventListener('click', () => switchDockTab('feed'));
  if (dockProfile) dockProfile.addEventListener('click', () => switchDockTab('profile'));
  if (dockDreams) dockDreams.addEventListener('click', () => switchDockTab('dreams'));
  if (dockSkills) dockSkills.addEventListener('click', () => switchDockTab('skills'));
  if (dockThemes) dockThemes.addEventListener('click', () => switchDockTab('themes'));
  if (dockAdmin) dockAdmin.addEventListener('click', () => switchDockTab('admin'));
  if (dockPulse) dockPulse.addEventListener('click', () => switchDockTab('pulse'));
  if (dockAihub) dockAihub.addEventListener('click', () => switchDockTab('aihub'));

  // Profiles Edit bio forms
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const profileBioText = document.getElementById('profile-bio-text');
  const profileBioEdit = document.getElementById('profile-bio-edit');

  if (editProfileBtn && saveProfileBtn && profileBioText && profileBioEdit) {
    editProfileBtn.addEventListener('click', () => {
      profileBioEdit.value = profileBioText.textContent;
      profileBioText.classList.add('hidden');
      profileBioEdit.classList.remove('hidden');
      editProfileBtn.classList.add('hidden');
      saveProfileBtn.classList.remove('hidden');
    });

    saveProfileBtn.addEventListener('click', async () => {
      const newBio = profileBioEdit.value.trim();
      try {
        const res = await apiFetch('/api/users/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ bio: newBio })
        });

        if (res.status === 200) {
          currentUser = await res.json();
          profileBioText.textContent = currentUser.bio;
          profileBioEdit.classList.add('hidden');
          profileBioText.classList.remove('hidden');
          saveProfileBtn.classList.add('hidden');
          editProfileBtn.classList.remove('hidden');
          
          document.getElementById('my-rep-score').textContent = currentUser.reputationScore;
        } else {
          alert('Failed to update bio.');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // AI Twin Chat Send
  const twinChatSend = document.getElementById('twin-chat-send');
  const twinChatInput = document.getElementById('twin-chat-input');
  if (twinChatSend) {
    twinChatSend.addEventListener('click', handleTwinChatSend);
  }
  if (twinChatInput) {
    twinChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleTwinChatSend();
    });
  }

  // Goals board constructor triggers
  const addGoalBtn = document.getElementById('add-goal-btn');
  const goalCreatorCard = document.getElementById('goal-creator-card');
  const saveNewGoalBtn = document.getElementById('save-new-goal');

  if (addGoalBtn && goalCreatorCard) {
    addGoalBtn.addEventListener('click', () => {
      goalCreatorCard.classList.toggle('hidden');
    });
  }

  if (saveNewGoalBtn) {
    saveNewGoalBtn.addEventListener('click', async () => {
      const title = document.getElementById('new-goal-title').value.trim();
      const category = document.getElementById('new-goal-category').value;
      if (!title) return alert('Goal description is required.');

      try {
        const res = await apiFetch('/api/goals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, category })
        });

        if (res.status === 201) {
          document.getElementById('new-goal-title').value = '';
          goalCreatorCard.classList.add('hidden');
          fetchGoalsAndCapsules();
        } else {
          alert('Failed to save goal.');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Sealing Time Capsules
  const sealCapsuleBtn = document.getElementById('seal-capsule-btn');
  if (sealCapsuleBtn) {
    sealCapsuleBtn.addEventListener('click', async () => {
      const message = document.getElementById('capsule-message').value.trim();
      const openDate = document.getElementById('capsule-date').value;
      if (!message || !openDate) return alert('Message and Unlock Date are required.');

      try {
        const res = await apiFetch('/api/capsules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message, openDate })
        });

        if (res.status === 201) {
          document.getElementById('capsule-message').value = '';
          document.getElementById('capsule-date').value = '';
          alert('Time Capsule sealed and scheduled for opening!');
          fetchGoalsAndCapsules();
        } else {
          alert('Failed to seal time capsule.');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // --- AeroTalk Premium Redesign Interactive Bindings ---

  // 1. Collapsable Navigation Sidebar toggle
  const leftNavSidebar = document.getElementById('left-nav-sidebar');
  const toggleSidebarExpand = document.getElementById('toggle-sidebar-expand');
  if (leftNavSidebar && toggleSidebarExpand) {
    toggleSidebarExpand.addEventListener('click', () => {
      leftNavSidebar.classList.toggle('collapsed');
      const icon = toggleSidebarExpand.querySelector('i') || toggleSidebarExpand.querySelector('svg');
      if (leftNavSidebar.classList.contains('collapsed')) {
        toggleSidebarExpand.title = "Expand Menu";
        if (icon) icon.setAttribute('data-lucide', 'chevrons-right');
      } else {
        toggleSidebarExpand.title = "Collapse Menu";
        if (icon) icon.setAttribute('data-lucide', 'chevrons-left');
      }
      window.lucide.createIcons();
    });
  }

  // 2. Extra navigation buttons (Home & Privacy)
  const dockHome = document.getElementById('dock-home-btn');
  const dockPrivacy = document.getElementById('dock-privacy-btn');
  if (dockHome) {
    dockHome.addEventListener('click', () => switchDockTab('chats'));
  }
  if (dockPrivacy) {
    dockPrivacy.addEventListener('click', () => {
      alert("AeroTalk Privacy Engine is Active.\n\nAll WebRTC HD calling data is routed directly Peer-to-Peer using secure WebSockets signaling. Text messages and credentials are fully encrypted in DB transactions.");
    });
  }

  // 3. Welcome pane quick actions
  const welcomeChatBtn = document.getElementById('welcome-chat-btn');
  const welcomeGroupBtn = document.getElementById('welcome-group-btn');
  const welcomeFeedBtn = document.getElementById('welcome-feed-btn');
  const welcomeAiBtn = document.getElementById('welcome-ai-btn');

  if (welcomeChatBtn) {
    welcomeChatBtn.addEventListener('click', () => {
      const searchInput = document.getElementById('friend-search-input');
      if (searchInput) searchInput.focus();
    });
  }
  if (welcomeGroupBtn) {
    welcomeGroupBtn.addEventListener('click', () => {
      const openCreateBtn = document.getElementById('open-create-group-btn');
      if (openCreateBtn) openCreateBtn.click();
    });
  }
  if (welcomeFeedBtn) {
    welcomeFeedBtn.addEventListener('click', () => switchDockTab('feed'));
  }
  if (welcomeAiBtn) {
    welcomeAiBtn.addEventListener('click', () => switchDockTab('profile'));
  }

  // Empty Group shortcut
  const emptyCreateGroupBtn = document.getElementById('empty-create-group-btn');
  if (emptyCreateGroupBtn) {
    emptyCreateGroupBtn.addEventListener('click', () => {
      const openCreateBtn = document.getElementById('open-create-group-btn');
      if (openCreateBtn) openCreateBtn.click();
    });
  }

  // 4. Collapsible Right AI Panel drawer
  const headerAiCopilotBtn = document.getElementById('header-ai-copilot-btn');
  const chatAiPanel = document.getElementById('chat-ai-panel');
  if (headerAiCopilotBtn && chatAiPanel) {
    headerAiCopilotBtn.addEventListener('click', () => {
      chatAiPanel.classList.toggle('hidden');
      headerAiCopilotBtn.classList.toggle('active', !chatAiPanel.classList.contains('hidden'));
    });
  }

  // 5. AI Assistant Copilot actions
  const aiBtnSummarize = document.getElementById('ai-btn-summarize');
  const aiBtnTranslate = document.getElementById('ai-btn-translate');
  const aiBtnRewrite = document.getElementById('ai-btn-rewrite');
  const aiBtnGrammar = document.getElementById('ai-btn-grammar');
  const aiBtnSuggest = document.getElementById('ai-btn-suggest');
  
  const aiResponseBox = document.getElementById('ai-response-box');
  const aiResponseText = document.getElementById('ai-response-text');

  const showAiOutput = (text) => {
    if (aiResponseBox && aiResponseText) {
      aiResponseBox.classList.remove('hidden');
      aiResponseText.textContent = text;
    }
  };

  if (aiBtnSummarize) {
    aiBtnSummarize.addEventListener('click', () => {
      // Fetch some recent messages content
      const msgs = Array.from(document.querySelectorAll('.message-content')).map(el => el.textContent);
      if (msgs.length === 0) {
        showAiOutput("No conversation history detected to summarize yet. Send a few text messages first!");
      } else {
        showAiOutput(`[Aero AI Summary] Analyzed last ${msgs.length} messages. The conversation centers on connecting streams, trading feedback on UI changes, and general project status.`);
      }
    });
  }

  if (aiBtnTranslate) {
    aiBtnTranslate.addEventListener('click', () => {
      const msgs = Array.from(document.querySelectorAll('.message-content')).map(el => el.textContent);
      if (msgs.length === 0) {
        showAiOutput("Nothing to translate. Send a message first!");
      } else {
        const lastMsg = msgs[msgs.length - 1];
        showAiOutput(`[Translation Output - Spanish] "${lastMsg}" translates to: "Hola, ¿cómo estás con las nuevas actualizaciones del sistema?"`);
      }
    });
  }

  if (aiBtnRewrite) {
    aiBtnRewrite.addEventListener('click', () => {
      showAiOutput("[Aero AI Rewrite Suggestion] 'Hey, I checked the platform changes, looks awesome!' -> 'Greetings, I have successfully reviewed the platform upgrades. The changes present a modern aesthetic!'");
    });
  }

  if (aiBtnGrammar) {
    aiBtnGrammar.addEventListener('click', () => {
      showAiOutput("[Aero AI Grammar Engine] Scanned context. No spelling or grammatical mistakes detected in active chat session buffers.");
    });
  }

  if (aiBtnSuggest) {
    aiBtnSuggest.addEventListener('click', () => {
      showAiOutput("[Smart Suggestions] 1. 'Sounds like a plan!' • 2. 'Can we start a voice call to debug?' • 3. 'Let's check the social feed updates.'");
    });
  }

  // 6. Right-hand Sidebar AI Widget listener
  const widgetAiTrendsBtn = document.getElementById('widget-ai-trends-btn');
  if (widgetAiTrendsBtn) {
    widgetAiTrendsBtn.addEventListener('click', () => {
      alert("Aero AI Trend Insights:\n\n1. #AeroTalkUpgrades is trending with 1200+ comments reflecting enthusiastic design feedback.\n2. #AITwinsIdentity is experiencing 850 active simulator questions.\n3. #PioneerClub milestones are growing rapidly with 420 completed boards.");
    });
  }

  // Suggested Creators quick adds
  document.querySelectorAll('.add-suggested-friend').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email');
      btn.disabled = true;
      btn.textContent = "Adding...";
      await sendFriendRequest(email);
      btn.textContent = "Added";
    });
  });

  // --- AeroTalk Futuristic UI Redesign Interactive Bindings ---

  // Mood selector chips click handler
  const moodChips = document.querySelectorAll('.mood-chip');
  moodChips.forEach(chip => {
    chip.addEventListener('click', () => {
      moodChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const moodSelected = chip.getAttribute('data-mood');
      console.log('User mood updated:', moodSelected);
      
      if (socket && socket.connected) {
        socket.emit('mood_update', { mood: moodSelected });
      }
    });
  });

  // Stickers selector panel toggling
  const chatStickerBtn = document.getElementById('chat-sticker-btn');
  const stickersPanel = document.getElementById('stickers-panel');
  const closeStickersBtn = document.getElementById('close-stickers-btn');

  if (chatStickerBtn && stickersPanel) {
    chatStickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stickersPanel.classList.toggle('hidden');
    });
  }
  if (closeStickersBtn && stickersPanel) {
    closeStickersBtn.addEventListener('click', () => {
      stickersPanel.classList.add('hidden');
    });
  }
  // Close stickers panel when clicking outside
  document.addEventListener('click', (e) => {
    if (stickersPanel && !stickersPanel.classList.contains('hidden') && !stickersPanel.contains(e.target) && e.target !== chatStickerBtn) {
      stickersPanel.classList.add('hidden');
    }
  });

  // Send Sticker on click
  document.querySelectorAll('.sticker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sticker = btn.getAttribute('data-sticker');
      if (sticker && activeChatId) {
        chatInput.value = sticker;
        handleSendMessage();
        if (stickersPanel) stickersPanel.classList.add('hidden');
      } else {
        alert("Select a chat first to send a sticker!");
      }
    });
  });

  // Mic Waveform Simulator trigger
  const chatVoiceBtn = document.getElementById('chat-voice-btn');
  if (chatVoiceBtn) {
    chatVoiceBtn.addEventListener('click', () => {
      if (activeChatId) {
        const voiceMessageHtml = `
          <div class="voice-waveform-container">
            <div class="waveform-bar"></div>
            <div class="waveform-bar"></div>
            <div class="waveform-bar"></div>
            <div class="waveform-bar"></div>
            <div class="waveform-bar"></div>
            <div class="waveform-bar"></div>
          </div>
          <span class="voice-duration" style="font-size:0.7rem; font-weight:700; opacity:0.8; margin-left:8px;">0:08</span>
        `;
        chatInput.value = voiceMessageHtml.replace(/\s+/g, ' ').trim();
        handleSendMessage();
      } else {
        alert("Select a chat first to send a simulated voice message!");
      }
    });
  }

  // AI Hub Widgets Actions
  const aiHubBrainstormBtn = document.getElementById('ai-hub-btn-brainstorm');
  const aiHubMoodBtn = document.getElementById('ai-hub-btn-mood');
  const aiHubPostBtn = document.getElementById('ai-hub-btn-post');
  const aiHubGrammarBtn = document.getElementById('ai-hub-btn-grammar');
  
  const aiHubOutputBox = document.getElementById('ai-hub-output-box');
  const aiHubOutputText = document.getElementById('ai-hub-output-text');

  const showAiHubOutput = (text) => {
    if (aiHubOutputBox && aiHubOutputText) {
      aiHubOutputBox.classList.remove('hidden');
      aiHubOutputText.textContent = text;
    }
  };

  if (aiHubBrainstormBtn) {
    aiHubBrainstormBtn.addEventListener('click', () => {
      showAiHubOutput("[Aero AI Brainstorm Engine] Cosmic Post Topics:\n\n1. The convergence of Quantum computing and Decentralized networks.\n2. Glassmorphism and the transition to Spatial UI layouts.\n3. Digital presence: why AI Twins will replace traditional email signatures.");
    });
  }

  if (aiHubMoodBtn) {
    aiHubMoodBtn.addEventListener('click', () => {
      const activeInput = document.getElementById('chat-input').value.trim();
      if (!activeInput) {
        showAiHubOutput("[Aero AI Mood Sentiment] Type a message draft in the chat input area first to analyze its emotional tone!");
      } else {
        showAiHubOutput(`[Aero AI Mood Sentiment] Analyzed: "${activeInput}"\n\nTone Weight: Positive (85%), Creative (70%)\nDominant state: Cosmic excitement 🚀`);
      }
    });
  }

  if (aiHubPostBtn) {
    aiHubPostBtn.addEventListener('click', () => {
      showAiHubOutput("[Aero AI Post Draft] Ready to publish on the Universe Feed:\n\n'Stepping into the future of spatial design. AeroTalk's new Cosmic glassmorphic system makes networking feel like operating an interface from a nebula. #SpatialUI #CosmicOS 🌌'");
    });
  }

  if (aiHubGrammarBtn) {
    aiHubGrammarBtn.addEventListener('click', () => {
      const activeInput = document.getElementById('chat-input');
      if (activeInput && activeInput.value.trim()) {
        const text = activeInput.value.trim();
        showAiHubOutput(`[Aero AI Grammar Engine] Analyzed: "${text}"\n\nOptimized Rewrite: "I checked the live server logs; it looks flawless!"`);
      } else {
        showAiHubOutput("[Aero AI Grammar Engine] Active chat input buffer is empty. Type a draft to analyze grammar.");
      }
    });
  }
}

// HTML Escaper
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// --- Dynamic Simulation Engines ---

// 1. Landing Page Chat Bot Concierge
function handleDemoSend() {
  const inputEl = document.getElementById('demo-bot-input');
  const logEl = document.getElementById('demo-bot-log');
  if (!inputEl || !logEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'user-msg';
  userMsg.textContent = text;
  logEl.appendChild(userMsg);
  inputEl.value = '';
  logEl.scrollTop = logEl.scrollHeight;

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'bot-msg';
    const query = text.toLowerCase();
    let reply = "I am AeroTalk's AI concierge. I can verify that AeroTalk features WebRTC HD calling, Fact-Checked Feeds, Dream goal boards, and custom profile twins!";
    
    if (query.includes('feed') || query.includes('post')) {
      reply = "AeroTalk's Smart Feed checks posts through a simulated AI Fact Checker to prevent spam/clickbait, and matches content by category and user mood!";
    } else if (query.includes('call') || query.includes('webrtc') || query.includes('video') || query.includes('voice')) {
      reply = "Calling on AeroTalk is secured by WebRTC. We map user socket presence to establish peer connections. Twilio and OpenRelay TURN servers ensure NAT bypass.";
    } else if (query.includes('twin') || query.includes('ai')) {
      reply = "Every user gets their own conversational AI Twin! Visitors ask it questions in profile view to learn about your portfolio and timeline safely.";
    } else if (query.includes('dream') || query.includes('goal') || query.includes('capsule')) {
      reply = "The Dream Board tracks your goals with progress bars. You can also seal Time Capsules to reveal messages at a future graduation or birthday!";
    }
    
    botMsg.textContent = reply;
    logEl.appendChild(botMsg);
    logEl.scrollTop = logEl.scrollHeight;
  }, 700);
}

// 2. AI Twin Profile Chat simulator
function handleTwinChatSend() {
  const inputEl = document.getElementById('twin-chat-input');
  const logEl = document.getElementById('twin-chat-log');
  if (!inputEl || !logEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'twin-msg user';
  userMsg.textContent = text;
  logEl.appendChild(userMsg);
  inputEl.value = '';
  logEl.scrollTop = logEl.scrollHeight;

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'twin-msg bot';
    const query = text.toLowerCase();
    
    // Extracted Profile data
    const uName = currentUser.username;
    const bio = currentUser.bio || 'Exploring AeroTalk...';
    const skills = currentUser.skills?.join(', ') || 'Networking, Public Speaking';
    const interests = currentUser.interests?.join(', ') || 'Tech, AI, Photography';
    const teachList = currentUser.teach?.join(', ') || 'Python, UI Design';
    const learnList = currentUser.learn?.join(', ') || 'Photography, Music';
    const exp = currentUser.experience || 'Digital Enthusiast';
    const edu = currentUser.education || 'AeroTalk Academy';
    const rep = currentUser.reputationScore || 100;
    
    let reply = "";

    // Specific profile matches
    if (query.includes('bio') || query.includes('who are you') || query.includes('introduce') || query.includes('about yourself')) {
      reply = `Hello! I am the AI Twin of ${uName}. Speaking on behalf of them: "${bio}"`;
    } 
    else if (query.includes('skill') || query.includes('talent') || query.includes('expert') || query.includes('what can you do')) {
      reply = `${uName} has expertise in: ${skills}. On AeroTalk, they currently teach: [${teachList}] and are looking to learn: [${learnList}].`;
    } 
    else if (query.includes('teach') || query.includes('learn') || query.includes('class') || query.includes('course') || query.includes('music') || query.includes('python')) {
      reply = `For exchange: ${uName} teaches ${teachList} and wants to learn ${learnList}. Feel free to drop a message to schedule a call!`;
    } 
    else if (query.includes('work') || query.includes('job') || query.includes('experience') || query.includes('company') || query.includes('career')) {
      reply = `According to ${uName}'s digital timeline, they work as a ${exp} and completed education at ${edu}.`;
    } 
    else if (query.includes('interest') || query.includes('hobby') || query.includes('hobbies') || query.includes('like to do')) {
      reply = `In their spare time, ${uName} focuses on ${interests}. They also enjoy participating in AeroTalk communities!`;
    } 
    else if (query.includes('badge') || query.includes('reputation') || query.includes('score')) {
      reply = `${uName} has an AeroTalk Trust Score of ${rep}/200 and has earned badges: [Pioneer, Verified].`;
    }
    // Conversational topics
    else if (query.includes('joke') || query.includes('funny')) {
      const jokes = [
        "Why do programmers wear glasses? Because they can't C#!",
        "Why did the database administrator leave the restaurant? Because there were too many table joins!",
        "There are 10 types of people in the world: those who understand binary, and those who don't."
      ];
      reply = jokes[Math.floor(Math.random() * jokes.length)];
    }
    else if (query.includes('book') || query.includes('read') || query.includes('recommendation')) {
      reply = `Since ${uName} is passionate about ${interests}, I highly recommend reading 'Life 3.0' by Max Tegmark or 'Atomic Habits' by James Clear!`;
    }
    else if (query.includes('ai') || query.includes('twin') || query.includes('bot')) {
      reply = `As ${uName}'s AI Twin, I think AI is the ultimate bridge for digital presence! I represent their public bio securely so they don't have to manual-answer every visitor request.`;
    }
    else if (query.includes('hello') || query.includes('hi ') || query.includes('hey')) {
      reply = `Hi there! I am ${uName}'s AI Twin. I'm ready to answer any questions about their timeline, skills, matches, or thoughts!`;
    }
    else if (query.includes('thank') || query.includes('cool') || query.includes('awesome')) {
      reply = `You're welcome! Let me know if you want to explore more about ${uName}'s milestones.`;
    }
    // Smart Generative Fallbacks - answers ANY question by weaving profile details
    else {
      const fallbacks = [
        `That's an interesting question! While ${uName} hasn't written a specific timeline entry for that, their interest in ${interests} and focus on ${skills} suggests they'd have a positive view on it.`,
        `Regarding that, ${uName} is currently exploring topics in ${learnList}. I'd say it aligns well with their growth mindset!`,
        `As ${uName}'s AI Twin, I can share that their core values revolve around ${bio}. That guides how they approach questions like yours!`,
        `I don't have a direct database match for '${text}' in ${uName}'s timeline, but they are very active in ${teachList}. You could send a direct message to ask them yourself!`
      ];
      reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    botMsg.textContent = reply;
    logEl.appendChild(botMsg);
    logEl.scrollTop = logEl.scrollHeight;
  }, 700);
}

// 3. Main Dashboard Tab dock switcher
function switchDockTab(tabId) {
  document.querySelectorAll('.dock-btn, .nav-item-btn').forEach(btn => btn.classList.remove('active'));
  
  // Resolve desktop sidebar button IDs
  let dockBtnId = `dock-${tabId}-btn`;
  if (tabId === 'feed') dockBtnId = 'dock-home-btn';
  if (tabId === 'vibe') dockBtnId = 'dock-vibe-btn';
  
  const activeBtn = document.getElementById(dockBtnId);
  if (activeBtn) activeBtn.classList.add('active');

  // Sync mobile bottom-nav tabs
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
  
  const mobileBtnId = `mobile-nav-${tabId}`;
  const activeMobileBtn = document.getElementById(mobileBtnId);
  if (activeMobileBtn) activeMobileBtn.classList.add('active');

  // Scoped layout toggling for mobile viewports
  const appEl = document.getElementById('app');
  if (appEl) {
    if (tabId === 'chats') {
      appEl.classList.remove('show-chat-viewport');
      appEl.classList.add('show-sidebar-drawer');
    } else {
      appEl.classList.remove('show-sidebar-drawer');
      appEl.classList.add('show-chat-viewport');
    }
  }

  document.querySelectorAll('.sidebar-drawer-content').forEach(el => el.classList.add('hidden'));
  const targetDrawer = document.getElementById(`drawer-${tabId}`);
  if (targetDrawer) targetDrawer.classList.remove('hidden');

  document.querySelectorAll('.viewport-pane').forEach(el => el.classList.add('hidden'));
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) targetPane.classList.remove('hidden');

  if (tabId === 'feed') {
    fetchFeed();
    fetchMoments(); // Refresh 24h moments at the top of feed
  } else if (tabId === 'profile') {
    renderMainProfile();
  } else if (tabId === 'dreams') {
    fetchGoalsAndCapsules();
  } else if (tabId === 'skills') {
    renderSkillExchangeMatches();
  } else if (tabId === 'admin') {
    refreshAdminConsole();
    renderThemeGallery(); // Consolidated Theme Customizer initialization!
  } else if (tabId === 'themes') {
    renderThemeGallery();
  }
}

// 4. Render Profile Hub main view
function renderMainProfile() {
  document.getElementById('profile-display-name-tag').textContent = currentUser.username;
  document.getElementById('profile-email-tag').textContent = currentUser.email;
  document.getElementById('profile-bio-text').textContent = currentUser.bio;
  document.getElementById('my-rep-score').textContent = currentUser.reputationScore;
  
  const mainAvatar = document.getElementById('profile-avatar');
  renderAvatar(mainAvatar, currentUser.username, currentUser.avatarUrl, currentUser.avatarColor);

  const coverBanner = document.getElementById('profile-cover-banner');
  if (currentUser.coverUrl) {
    coverBanner.style.backgroundImage = `url(${currentUser.coverUrl})`;
  } else {
    coverBanner.style.backgroundImage = 'none';
  }

  // Draw timeline dynamically
  const timelineList = document.getElementById('profile-timeline-list');
  timelineList.innerHTML = '';
  const timeline = currentUser.timeline || [
    { title: 'Joined AeroTalk', description: 'Created secure digital identity', date: '2026' }
  ];

  timeline.forEach(item => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.innerHTML = `
      <div class="timeline-bullet"></div>
      <div class="timeline-content">
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.description)}</p>
        <span>${escapeHTML(item.date)}</span>
      </div>
    `;
    timelineList.appendChild(el);
  });
}

// 5. Goals & Time capsules requests
async function fetchGoalsAndCapsules() {
  try {
    const goalsRes = await apiFetch('/api/goals', { headers: { 'Authorization': `Bearer ${token}` } });
    const goals = await goalsRes.json();
    renderGoalsBoard(goals);

    const capRes = await apiFetch('/api/capsules', { headers: { 'Authorization': `Bearer ${token}` } });
    const capsules = await capRes.json();
    renderCapsulesBoard(capsules);
  } catch (err) {
    console.error(err);
  }
}

function renderGoalsBoard(goals) {
  const listEl = document.getElementById('dreams-goals-list');
  listEl.innerHTML = '';
  if (goals.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No goals created. Add your first goal above!</div>`;
    return;
  }

  goals.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <h4>${escapeHTML(goal.title)}</h4>
        <span class="goal-category-tag">${escapeHTML(goal.category)}</span>
      </div>
      <div class="goal-progress-row">
        <input type="range" class="goal-slider" min="0" max="100" value="${goal.progress}">
        <span class="goal-percentage">${goal.progress}%</span>
      </div>
    `;

    // Bind slider progress update REST query
    const slider = card.querySelector('.goal-slider');
    const label = card.querySelector('.goal-percentage');
    slider.addEventListener('change', async () => {
      const progress = slider.value;
      label.textContent = `${progress}%`;
      
      try {
        await apiFetch(`/api/goals/${goal.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ progress })
        });
      } catch (err) {
        console.error(err);
      }
    });

    listEl.appendChild(card);
  });
}

function renderCapsulesBoard(capsules) {
  const listEl = document.getElementById('capsules-list');
  listEl.innerHTML = '';
  if (capsules.length === 0) {
    listEl.innerHTML = `<li class="empty-state">No capsules sealed yet.</li>`;
    return;
  }

  capsules.forEach(cap => {
    const li = document.createElement('li');
    li.className = 'vault-item-row';
    li.innerHTML = `
      <div>
        <h5>${escapeHTML(cap.message)}</h5>
        <span>Unlocks: ${escapeHTML(cap.openDate)}</span>
      </div>
      <i data-lucide="lock" class="small-icon"></i>
    `;
    listEl.appendChild(li);
  });
  window.lucide.createIcons();
}

// 6. Skill matches dynamic rendering
function renderSkillExchangeMatches() {
  const gridEl = document.getElementById('skills-exchange-list');
  gridEl.innerHTML = '';
  
  // Custom mock exchange list
  const mockMatches = [
    { name: 'Alice Smith', email: 'alice@email.com', teach: 'Photography, Music', learn: 'Python', matchPercent: 95 },
    { name: 'Bob Johnson', email: 'bob@email.com', teach: 'Music', learn: 'UI Design', matchPercent: 88 }
  ];

  mockMatches.forEach(m => {
    const card = document.createElement('div');
    card.className = 'skills-match-card';
    card.innerHTML = `
      <div class="match-header">
        <div class="avatar" style="background-color: var(--accent-color)">${m.name.charAt(0)}</div>
        <div>
          <h4>${escapeHTML(m.name)}</h4>
          <span class="goal-category-tag text-success">${m.matchPercent}% Match Rating</span>
        </div>
      </div>
      <div class="match-skills-block">
        <div><strong>Teaches:</strong> ${escapeHTML(m.teach)}</div>
        <div><strong>Learns:</strong> ${escapeHTML(m.learn)}</div>
      </div>
      <button class="btn btn-primary btn-sm-action match-connect-btn">Connect Partner</button>
    `;

    card.querySelector('.match-connect-btn').addEventListener('click', () => {
      // Auto open chat window in Chats
      switchDockTab('chats');
      openChatWindow('direct', m.email);
    });

    gridEl.appendChild(card);
  });
}

// 7. Admin diagnostics logger simulator
let adminLoggerInterval = null;
function refreshAdminConsole() {
  const consoleEl = document.getElementById('admin-live-logs');
  if (!consoleEl) return;

  // Track socket registrations count
  const socketsCountEl = document.getElementById('admin-sockets-count');
  if (socketsCountEl && socket) {
    socketsCountEl.textContent = socket.connected ? '2 Active' : '0 Offline';
  }

  // Clear previous intervals to avoid duplication
  if (adminLoggerInterval) clearInterval(adminLoggerInterval);

  adminLoggerInterval = setInterval(() => {
    if (!consoleEl) return;
    const line = document.createElement('div');
    line.className = 'console-line';
    
    const events = [
      `[REST DB] Transaction commit successful. Saved new state.`,
      `[Socket.io] Ping keepalive sent. RTT: 12ms`,
      `[WebRTC Signaling] Ice Candidate registered from peer router.`,
      `[Admin Monitor] CPU usage metrics collected: 1.2% load.`,
      `[REST API] GET /api/feed served to authorized node.`
    ];
    const randEvent = events[Math.floor(Math.random() * events.length)];
    line.textContent = `[${new Date().toLocaleTimeString()}] ${randEvent}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;

    // Cap logs lines
    if (consoleEl.children.length > 50) {
      consoleEl.removeChild(consoleEl.firstChild);
    }
  }, 3500);
}

// --- Aero Themes Premium Personalization System ---

const BUILTIN_THEMES = {
  aerodark: {
    name: "Aero Dark (Default)",
    designer: "AeroTeam",
    description: "Modern dark interface with cyan highlights.",
    isDark: true,
    colors: {
      'bg-color': '#0b0c10',
      'panel-bg': 'rgba(21, 23, 33, 0.75)',
      'panel-border': 'rgba(255, 255, 255, 0.08)',
      'accent-color': '#00ffd2',
      'accent-color-glow': 'rgba(0, 255, 210, 0.3)',
      'primary-color': '#8a2be2',
      'primary-color-glow': 'rgba(138, 43, 226, 0.35)',
      'text-primary': '#f5f6f8',
      'text-secondary': '#94a3b8',
      'text-muted': '#64748b'
    }
  },
  midnight: {
    name: "Midnight Black",
    designer: "AeroTeam",
    description: "Pure AMOLED black with subtle blue accents.",
    isDark: true,
    colors: {
      'bg-color': '#000000',
      'panel-bg': 'rgba(10, 10, 10, 0.85)',
      'panel-border': 'rgba(255, 255, 255, 0.05)',
      'accent-color': '#2563eb',
      'accent-color-glow': 'rgba(37, 99, 235, 0.3)',
      'primary-color': '#1d4ed8',
      'primary-color-glow': 'rgba(29, 78, 216, 0.35)',
      'text-primary': '#f8fafc',
      'text-secondary': '#cbd5e1',
      'text-muted': '#475569'
    }
  },
  ocean: {
    name: "Ocean Blue",
    designer: "AeroTeam",
    description: "Deep navy with ocean cyan gradients.",
    isDark: true,
    colors: {
      'bg-color': '#0f172a',
      'panel-bg': 'rgba(30, 41, 59, 0.8)',
      'panel-border': 'rgba(6, 182, 212, 0.15)',
      'accent-color': '#06b6d4',
      'accent-color-glow': 'rgba(6, 182, 212, 0.3)',
      'primary-color': '#0284c7',
      'primary-color-glow': 'rgba(2, 132, 199, 0.35)',
      'text-primary': '#f1f5f9',
      'text-secondary': '#94a3b8',
      'text-muted': '#475569'
    }
  },
  aurora: {
    name: "Aurora Borealis",
    designer: "NorthernLights",
    description: "Purple, cyan, and blue gradients inspired by the aurora.",
    isDark: true,
    colors: {
      'bg-color': '#0d0d1e',
      'panel-bg': 'rgba(26, 15, 46, 0.75)',
      'panel-border': 'rgba(0, 255, 210, 0.12)',
      'accent-color': '#00ffcc',
      'accent-color-glow': 'rgba(0, 255, 204, 0.3)',
      'primary-color': '#d946ef',
      'primary-color-glow': 'rgba(217, 70, 239, 0.35)',
      'text-primary': '#fdf4ff',
      'text-secondary': '#e9d5ff',
      'text-muted': '#a21caf'
    }
  },
  sunset: {
    name: "Sunset Glow",
    designer: "AeroTeam",
    description: "Orange, pink, and purple gradients.",
    isDark: true,
    colors: {
      'bg-color': '#1c0f1b',
      'panel-bg': 'rgba(45, 20, 36, 0.75)',
      'panel-border': 'rgba(244, 63, 94, 0.15)',
      'accent-color': '#fb7185',
      'accent-color-glow': 'rgba(251, 113, 133, 0.3)',
      'primary-color': '#f59e0b',
      'primary-color-glow': 'rgba(245, 158, 11, 0.35)',
      'text-primary': '#fff1f2',
      'text-secondary': '#fecdd3',
      'text-muted': '#9f1239'
    }
  },
  forest: {
    name: "Calm Forest",
    designer: "EcoDesign",
    description: "Green tones with a calm natural appearance.",
    isDark: true,
    colors: {
      'bg-color': '#0a1c14',
      'panel-bg': 'rgba(15, 38, 28, 0.75)',
      'panel-border': 'rgba(52, 211, 153, 0.12)',
      'accent-color': '#10b981',
      'accent-color-glow': 'rgba(16, 185, 129, 0.3)',
      'primary-color': '#047857',
      'primary-color-glow': 'rgba(4, 120, 87, 0.35)',
      'text-primary': '#ecfdf5',
      'text-secondary': '#a7f3d0',
      'text-muted': '#064e3b'
    }
  },
  glass: {
    name: "Frosty Glass",
    designer: "AeroTeam",
    description: "Glassmorphism with transparent cards and heavy blurs.",
    isDark: true,
    colors: {
      'bg-color': '#111827',
      'panel-bg': 'rgba(255, 255, 255, 0.05)',
      'panel-border': 'rgba(255, 255, 255, 0.18)',
      'accent-color': '#38bdf8',
      'accent-color-glow': 'rgba(56, 189, 248, 0.3)',
      'primary-color': '#ffffff',
      'primary-color-glow': 'rgba(255, 255, 255, 0.15)',
      'text-primary': '#f9fafb',
      'text-secondary': '#d1d5db',
      'text-muted': '#9ca3af'
    }
  },
  minimal: {
    name: "Minimal White",
    designer: "AppleWay",
    description: "Clean light white interface inspired by Cupertino.",
    isDark: false,
    colors: {
      'bg-color': '#f8fafc',
      'panel-bg': 'rgba(255, 255, 255, 0.95)',
      'panel-border': 'rgba(15, 23, 42, 0.08)',
      'accent-color': '#0f172a',
      'accent-color-glow': 'rgba(15, 23, 42, 0.15)',
      'primary-color': '#3b82f6',
      'primary-color-glow': 'rgba(59, 130, 246, 0.2)',
      'text-primary': '#0f172a',
      'text-secondary': '#475569',
      'text-muted': '#94a3b8'
    }
  },
  cyber: {
    name: "Cyber Neon",
    designer: "Netrunner",
    description: "Dark interface with neon glowing highlights.",
    isDark: true,
    colors: {
      'bg-color': '#05050a',
      'panel-bg': 'rgba(10, 10, 20, 0.9)',
      'panel-border': 'rgba(244, 63, 94, 0.25)',
      'accent-color': '#f43f5e',
      'accent-color-glow': 'rgba(244, 63, 150, 0.4)',
      'primary-color': '#00ffff',
      'primary-color-glow': 'rgba(0, 255, 255, 0.45)',
      'text-primary': '#ffffff',
      'text-secondary': '#a5b4fc',
      'text-muted': '#4f46e5'
    }
  },
  space: {
    name: "Cosmic Space",
    designer: "AeroTeam",
    description: "Dark cosmic background with stars and nebula glows.",
    isDark: true,
    colors: {
      'bg-color': '#020205',
      'panel-bg': 'rgba(15, 12, 30, 0.75)',
      'panel-border': 'rgba(139, 92, 246, 0.15)',
      'accent-color': '#c084fc',
      'accent-color-glow': 'rgba(192, 132, 252, 0.3)',
      'primary-color': '#4f46e5',
      'primary-color-glow': 'rgba(79, 70, 229, 0.35)',
      'text-primary': '#f5f3ff',
      'text-secondary': '#ddd6fe',
      'text-muted': '#6d28d9'
    }
  },
  vintage: {
    name: "Vintage Paper",
    designer: "Writer",
    description: "Warm beige interface resembling an antique notebook.",
    isDark: false,
    colors: {
      'bg-color': '#fcf6eb',
      'panel-bg': 'rgba(247, 239, 224, 0.95)',
      'panel-border': 'rgba(120, 85, 45, 0.15)',
      'accent-color': '#78552d',
      'accent-color-glow': 'rgba(120, 85, 45, 0.2)',
      'primary-color': '#8b5a2b',
      'primary-color-glow': 'rgba(139, 90, 43, 0.25)',
      'text-primary': '#4a2c11',
      'text-secondary': '#78552d',
      'text-muted': '#a07850'
    }
  }
};

let userCustomThemes = JSON.parse(localStorage.getItem('aerotalk_custom_themes')) || {};

function renderThemeGallery() {
  const gridEl = document.getElementById('theme-gallery-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const allThemes = { ...BUILTIN_THEMES, ...userCustomThemes };

  Object.entries(allThemes).forEach(([key, theme]) => {
    const card = document.createElement('div');
    card.className = 'theme-card';
    
    // Thumbnail preview bar
    const bgCol = theme.colors['bg-color'];
    const primaryCol = theme.colors['primary-color'];
    const accentCol = theme.colors['accent-color'];
    const textCol = theme.colors['text-primary'];

    card.innerHTML = `
      <div class="theme-thumbnail" style="background-color: ${bgCol}; border: 1px solid var(--panel-border)">
        <div class="thumb-header" style="background: rgba(255,255,255,0.05); height: 8px;"></div>
        <div class="thumb-body">
          <div class="thumb-line" style="background: ${textCol}; width: 60%; height: 3px; border-radius: 2px;"></div>
          <div class="thumb-line mt-1" style="background: ${textCol}; width: 40%; height: 3px; opacity: 0.5; border-radius: 2px;"></div>
        </div>
        <div class="thumb-palette">
          <span class="palette-dot" style="background: ${primaryCol}"></span>
          <span class="palette-dot" style="background: ${accentCol}"></span>
        </div>
      </div>
      <div class="theme-card-details mt-2">
        <div class="theme-header-row">
          <h4>${escapeHTML(theme.name)}</h4>
          <span class="theme-indicator-tag">${theme.isDark ? 'Dark' : 'Light'}</span>
        </div>
        <p class="small-text text-muted mt-1">${escapeHTML(theme.description)}</p>
        <span class="theme-designer">Designer: ${escapeHTML(theme.designer)}</span>
        <div class="theme-card-actions mt-3">
          <button class="btn btn-accent btn-sm-action apply-theme-btn" data-theme-key="${key}">Apply Theme</button>
          <button class="icon-btn-inline fav-theme-btn" title="Add to Favorites"><i data-lucide="star" class="small-icon"></i></button>
        </div>
      </div>
    `;

    card.querySelector('.apply-theme-btn').addEventListener('click', () => {
      applyThemeColors(theme.colors);
      localStorage.setItem('aerotalk_applied_theme_key', key);
      alert(`Applied Theme: ${theme.name}`);
    });

    gridEl.appendChild(card);
  });
  window.lucide.createIcons();
  setupThemeCreatorAndCustomizers();
}

function applyThemeColors(colors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

function setupThemeCreatorAndCustomizers() {
  // Density switcher
  const densitySelect = document.getElementById('theme-density-select');
  if (densitySelect) {
    densitySelect.addEventListener('change', () => {
      const root = document.documentElement;
      const density = densitySelect.value;
      if (density === 'compact') {
        root.style.setProperty('--border-radius-lg', '8px');
        root.style.setProperty('--border-radius-md', '6px');
        document.body.style.fontSize = '0.92rem';
      } else if (density === 'spacious') {
        root.style.setProperty('--border-radius-lg', '24px');
        root.style.setProperty('--border-radius-md', '16px');
        document.body.style.fontSize = '1.08rem';
      } else {
        root.style.setProperty('--border-radius-lg', '20px');
        root.style.setProperty('--border-radius-md', '12px');
        document.body.style.fontSize = '1rem';
      }
    });
  }

  // Font switcher
  const fontSelect = document.getElementById('theme-font-select');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      document.documentElement.style.setProperty('--font-family', fontSelect.value);
    });
  }

  // Border radius switcher
  const radiusSelect = document.getElementById('theme-radius-select');
  if (radiusSelect) {
    radiusSelect.addEventListener('change', () => {
      const root = document.documentElement;
      const rad = radiusSelect.value;
      if (rad === 'sharp') {
        root.style.setProperty('--border-radius-lg', '0px');
        root.style.setProperty('--border-radius-md', '0px');
      } else if (rad === 'extra') {
        root.style.setProperty('--border-radius-lg', '24px');
        root.style.setProperty('--border-radius-md', '16px');
      } else if (rad === 'pill') {
        root.style.setProperty('--border-radius-lg', '40px');
        root.style.setProperty('--border-radius-md', '24px');
      } else {
        root.style.setProperty('--border-radius-lg', '20px');
        root.style.setProperty('--border-radius-md', '12px');
      }
    });
  }

  // Live color pickers binds
  const cpBg = document.getElementById('cp-bg');
  const cpPanel = document.getElementById('cp-panel');
  const cpAccent = document.getElementById('cp-accent');
  const cpPrimary = document.getElementById('cp-primary');
  const cpText = document.getElementById('cp-text');

  const updateColorLive = (key, colorVal) => {
    document.documentElement.style.setProperty(`--${key}`, colorVal);
  };

  if (cpBg) cpBg.addEventListener('input', () => updateColorLive('bg-color', cpBg.value));
  if (cpPanel) cpPanel.addEventListener('input', () => updateColorLive('panel-bg', cpPanel.value));
  if (cpAccent) cpAccent.addEventListener('input', () => updateColorLive('accent-color', cpAccent.value));
  if (cpPrimary) cpPrimary.addEventListener('input', () => updateColorLive('primary-color', cpPrimary.value));
  if (cpText) cpText.addEventListener('input', () => updateColorLive('text-primary', cpText.value));

  // Open theme creator scrolling shortcut
  const creatorBtn = document.getElementById('open-theme-creator-btn');
  if (creatorBtn) {
    creatorBtn.addEventListener('click', () => {
      switchDockTab('themes');
      const box = document.getElementById('theme-creator-box');
      if (box) box.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Save custom theme preset
  const saveThemeBtn = document.getElementById('save-custom-theme-btn');
  if (saveThemeBtn) {
    saveThemeBtn.addEventListener('click', () => {
      const name = document.getElementById('custom-theme-name').value.trim();
      if (!name) return alert("Please enter a custom theme name!");

      const customKey = 'custom_' + Date.now();
      const customTheme = {
        name: name,
        designer: currentUser ? currentUser.username : "Creator",
        description: "Custom user-generated theme preset.",
        isDark: true,
        colors: {
          'bg-color': cpBg ? cpBg.value : '#0b0c10',
          'panel-bg': cpPanel ? cpPanel.value : '#151721',
          'panel-border': 'rgba(255,255,255,0.08)',
          'accent-color': cpAccent ? cpAccent.value : '#00ffd2',
          'accent-color-glow': 'rgba(0, 255, 210, 0.3)',
          'primary-color': cpPrimary ? cpPrimary.value : '#8a2be2',
          'primary-color-glow': 'rgba(138, 43, 226, 0.35)',
          'text-primary': cpText ? cpText.value : '#f5f6f8',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b'
        }
      };

      userCustomThemes[customKey] = customTheme;
      localStorage.setItem('aerotalk_custom_themes', JSON.stringify(userCustomThemes));
      document.getElementById('custom-theme-name').value = '';
      alert(`Theme preset "${name}" saved to your Gallery!`);
      renderThemeGallery();
    });
  }

  // Export Theme preset
  const exportBtn = document.getElementById('theme-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const activeKey = localStorage.getItem('aerotalk_applied_theme_key') || 'aerodark';
      const allThemes = { ...BUILTIN_THEMES, ...userCustomThemes };
      const activeTheme = allThemes[activeKey];
      
      const exportedStr = JSON.stringify(activeTheme);
      navigator.clipboard.writeText(exportedStr).then(() => {
        alert("Aero Theme export JSON code copied to clipboard! Share it with friends.");
      }).catch(err => {
        alert("Export Code: " + exportedStr);
      });
    });
  }

  // Import Theme preset
  const importBtn = document.getElementById('theme-import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const inputStr = prompt("Paste your Aero Theme JSON code here:");
      if (!inputStr) return;

      try {
        const theme = JSON.parse(inputStr);
        if (!theme.name || !theme.colors) throw new Error("Invalid structure");

        const customKey = 'imported_' + Date.now();
        userCustomThemes[customKey] = theme;
        localStorage.setItem('aerotalk_custom_themes', JSON.stringify(userCustomThemes));
        
        applyThemeColors(theme.colors);
        alert(`Successfully imported and applied theme: ${theme.name}`);
        renderThemeGallery();
      } catch (err) {
        alert("Failed to parse theme code. Make sure it is valid JSON.");
      }
    });
  }

  // --- Vibe Post / Moment sharing bindings ---
  const vibeImageInput = document.getElementById('vibe-image-input');
  const vibeImageStatus = document.getElementById('vibe-image-status');
  const vibePublishBtn = document.getElementById('vibe-publish-btn');
  let selectedVibeFile = null;

  if (vibeImageInput && vibeImageStatus) {
    vibeImageInput.addEventListener('change', () => {
      if (vibeImageInput.files.length > 0) {
        selectedVibeFile = vibeImageInput.files[0];
        vibeImageStatus.textContent = selectedVibeFile.name;
      }
    });
  }

  if (vibePublishBtn) {
    vibePublishBtn.addEventListener('click', async () => {
      const caption = document.getElementById('vibe-caption-input').value.trim();
      const isMoment = document.getElementById('share-as-moment').checked;
      
      if (!selectedVibeFile && !caption) {
        return alert("Please select an image/video or type a caption to share your vibe!");
      }

      vibePublishBtn.disabled = true;
      vibePublishBtn.textContent = "Publishing...";

      let imageUrl = '';
      if (selectedVibeFile) {
        try {
          const formData = new FormData();
          formData.append('file', selectedVibeFile);

          const uploadRes = await apiFetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          if (uploadRes.status === 200) {
            const fileData = await uploadRes.json();
            imageUrl = fileData.fileUrl;
          } else {
            alert('Vibe media upload failed.');
            vibePublishBtn.disabled = false;
            vibePublishBtn.textContent = "Broadcast Vibe";
            return;
          }
        } catch (err) {
          console.error(err);
          vibePublishBtn.disabled = false;
          vibePublishBtn.textContent = "Broadcast Vibe";
          return;
        }
      }

      try {
        const postRes = await apiFetch('/api/feed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            imageUrl: imageUrl || '/icon.jpg', // Fallback to logo if text-only vibe
            caption,
            isMoment
          })
        });

        if (postRes.status === 201) {
          // Clear inputs
          document.getElementById('vibe-caption-input').value = '';
          if (vibeImageInput) vibeImageInput.value = '';
          if (vibeImageStatus) vibeImageStatus.textContent = 'Upload Image or Video';
          selectedVibeFile = null;

          alert(isMoment ? 'Your 24h Moment has been published!' : 'Your post has been broadcast to the Universe!');
          switchDockTab('feed'); // Go back to Home Feed
        } else {
          alert('Failed to publish vibe.');
        }
      } catch (err) {
        console.error(err);
      } finally {
        vibePublishBtn.disabled = false;
        vibePublishBtn.textContent = "Broadcast Vibe";
      }
    });
  }

  // Bind top header chat toggle click
  const feedChatBtn = document.getElementById('header-feed-chat-btn');
  if (feedChatBtn) {
    feedChatBtn.addEventListener('click', () => {
      switchDockTab('chats');
    });
  }

  // Bind add moment shortcut button click
  const addMomentBtn = document.getElementById('add-moment-shortcut-btn');
  if (addMomentBtn) {
    addMomentBtn.addEventListener('click', () => {
      switchDockTab('vibe');
      const shareMomentCheckbox = document.getElementById('share-as-moment');
      if (shareMomentCheckbox) shareMomentCheckbox.checked = true;
    });
  }
}

// Fetch and render unexpired 24h PWA moments
async function fetchMoments() {
  const container = document.getElementById('dynamic-moments-row');
  if (!container) return;
  
  try {
    const res = await apiFetch('/api/moments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status !== 200) return;
    const list = await res.json();
    container.innerHTML = '';
    
    if (list.length === 0) {
      // Inject some mock placeholders if no moments are online
      container.innerHTML = `
        <div class="moment-item" title="Bob's Vibe">
          <div class="moment-ring-border">
            <div class="moment-avatar" style="background-color: var(--primary-color)">B</div>
          </div>
          <span>Bob W.</span>
        </div>
        <div class="moment-item" title="Alice's Vibe">
          <div class="moment-ring-border">
            <div class="moment-avatar" style="background-color: var(--accent-color)">A</div>
          </div>
          <span>Alice</span>
        </div>
      `;
    } else {
      list.forEach(m => {
        const div = document.createElement('div');
        div.className = 'moment-item';
        div.title = `${m.username}'s Moment`;
        
        let avatarStyle = '';
        if (m.imageUrl) {
          avatarStyle = `background-image: url(${m.imageUrl});`;
        }
        
        div.innerHTML = `
          <div class="moment-ring-border">
            <div class="moment-avatar" style="${avatarStyle}">
              ${m.imageUrl ? '' : m.username[0].toUpperCase()}
            </div>
          </div>
          <span>${m.username}</span>
        `;
        container.appendChild(div);
      });
    }
    window.lucide.createIcons();
  } catch (err) {
    console.error('[Moments Engine] Error fetching stories', err);
  }
}

// Display in-app glassmorphic alert notifications
function showInAppToast(sender, text) {
  let toastContainer = document.getElementById('in-app-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'in-app-toast-container';
    toastContainer.style = 'position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'glass-panel card';
  toast.style = 'padding: 16px 20px; min-width: 280px; max-width: 360px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(18, 24, 39, 0.95); backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); pointer-events: auto; animation: slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;';
  
  toast.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center;">
      <div class="avatar" style="width: 36px; height: 36px; background-color: var(--secondary-color); font-size: 0.8rem; font-weight: 700; color:#fff; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
        ${sender[0].toUpperCase()}
      </div>
      <div style="flex-grow: 1;">
        <h4 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: #fff;">${sender}</h4>
        <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${text}</p>
      </div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Play message arrival sound effect
  if (window.SoundEffects) {
    window.SoundEffects.playMessageReceived();
  }
  
  // Remove toast container after slide-out animation delay
  setTimeout(() => {
    toast.style.animation = 'slideOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}
