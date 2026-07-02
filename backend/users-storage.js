import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const USERS_JSON_PATH = path.join(DATA_DIR, 'users.json');

// Ensure data folder and users.json exist
function ensureStorageExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_JSON_PATH)) {
    fs.writeFileSync(USERS_JSON_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

// 1. Reading users
export function readUsers() {
  ensureStorageExists();
  try {
    const raw = fs.readFileSync(USERS_JSON_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read users.json storage', err);
    return [];
  }
}

// 2. Writing users
export function writeUsers(users) {
  ensureStorageExists();
  try {
    const tempPath = USERS_JSON_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tempPath, USERS_JSON_PATH);
    return true;
  } catch (err) {
    console.error('Failed to write to users.json storage', err);
    return false;
  }
}

// 3. Finding users by email
export function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  const users = readUsers();
  return users.find(u => u.email === cleanEmail) || null;
}

// 4. Finding users by ID
export function findUserById(id) {
  if (!id) return null;
  const users = readUsers();
  return users.find(u => u.id === id) || null;
}

// 5. Creating users
export function createUser(username, email, passwordHash) {
  const users = readUsers();
  const cleanEmail = email.toLowerCase().trim();

  if (users.some(u => u.email === cleanEmail)) {
    return null; // Duplicate email
  }

  const timestamp = new Date().toISOString();
  const newUser = {
    id: crypto.randomUUID(),
    username: username.trim(),
    displayName: username.trim(),
    email: cleanEmail,
    passwordHash: passwordHash, // Saved for auth compatibility
    profilePhoto: "",
    bio: "New explorer on AeroTalk. Conversations that go beyond.",
    theme: "Aero Dark",
    language: "English",
    onlineStatus: "offline",
    verified: false,
    reputation: 0,
    followers: [],
    following: [],
    friends: [],
    blockedUsers: [],
    savedPosts: [],
    likedPosts: [],
    bookmarks: [],
    notifications: [],
    settings: {
      theme: "Aero Dark",
      appearance: "Dark",
      fontSize: "Medium",
      sidebar: "Expanded",
      animations: true,
      privacy: "Friends"
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };

  users.push(newUser);
  writeUsers(users);
  return newUser;
}

// 6. Updating users
export function updateUser(id, updateData) {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;

  users[idx] = {
    ...users[idx],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  writeUsers(users);
  return users[idx];
}

// 7. Deleting users
export function deleteUser(id) {
  const users = readUsers();
  const initialLen = users.length;
  const filtered = users.filter(u => u.id !== id);
  
  if (filtered.length === initialLen) return false;
  
  writeUsers(filtered);
  return true;
}
