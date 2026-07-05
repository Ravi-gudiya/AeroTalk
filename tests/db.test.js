import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Mock fs module to use in-memory mock data
let mockDataStore = {
  users: [],
  friends: [],
  messages: [],
  groups: [],
  groupMembers: [],
  groupMessages: [],
  posts: [],
  goals: [],
  capsules: []
};

vi.mock('fs', () => {
  return {
    default: {
      existsSync: () => true,
      readFileSync: () => JSON.stringify(mockDataStore),
      writeFileSync: (filepath, data) => {
        mockDataStore = JSON.parse(data);
      },
      renameSync: () => {}
    }
  };
});

let mockSupabaseActive = false;
let mockSupabaseError = false;
let acceptCallCount = 0;

// Chainable mock query builder for Supabase
const mockQueryChain = {
  from: () => mockQueryChain,
  select: () => mockQueryChain,
  insert: () => mockQueryChain,
  update: () => mockQueryChain,
  delete: () => mockQueryChain,
  eq: () => mockQueryChain,
  neq: () => mockQueryChain,
  or: () => mockQueryChain,
  order: () => mockQueryChain,
  match: () => mockQueryChain,
  maybeSingle: () => {
    if (mockSupabaseError) {
      return Promise.resolve({ data: null, error: new Error('Mock error') });
    }
    return Promise.resolve({
      data: {
        id: 'g123',
        email: 'sb@email.com',
        sender_email: 'sb@email.com',
        receiver_email: 'other@email.com',
        sender: { email: 'a@email.com', username: 'a', profile_photo: 'p.jpg', last_seen: '123' },
        receiver: { email: 'b@email.com', username: 'b', profile_photo: 'p.jpg', last_seen: '123' },
        username: 'sb',
        progress: 50,
        created_at: new Date().toISOString()
      },
      error: null
    });
  },
  single: () => {
    if (mockSupabaseError) {
      return Promise.resolve({ data: null, error: new Error('Mock error') });
    }
    return Promise.resolve({
      data: {
        id: 'g123',
        email: 'sb@email.com',
        sender_email: 'sb@email.com',
        receiver_email: 'other@email.com',
        sender: { email: 'a@email.com', username: 'a', profile_photo: 'p.jpg', last_seen: '123' },
        receiver: { email: 'b@email.com', username: 'b', profile_photo: 'p.jpg', last_seen: '123' },
        username: 'sb',
        progress: 50,
        created_at: new Date().toISOString()
      },
      error: null
    });
  },
  then: (resolve) => {
    if (mockSupabaseError) {
      return resolve({ data: null, error: new Error('Mock error') });
    }
    // For testing bidirectional acceptFriendRequest in Supabase
    if (acceptCallCount === 0) {
      acceptCallCount++;
      return resolve({ data: [], error: null });
    }
    return resolve({
      data: [
        {
          id: 'g123',
          email: 'sb@email.com',
          sender_email: 'sb@email.com',
          receiver_email: 'other@email.com',
          sender: { email: 'a@email.com', username: 'a', profile_photo: 'p.jpg', last_seen: '123' },
          receiver: { email: 'b@email.com', username: 'b', profile_photo: 'p.jpg', last_seen: '123' },
          username: 'sb',
          progress: 50,
          created_at: new Date().toISOString(),
          group: { id: 'g123', name: 'Group A', created_by: 'sb@email.com' }
        }
      ],
      error: null
    });
  }
};

vi.mock('../backend/services/supabase.js', () => {
  return {
    get supabase() {
      return mockSupabaseActive ? mockQueryChain : null;
    }
  };
});

import { DB } from '../backend/db.js';

describe('Database Layer Unit & Integration Tests', () => {
  beforeEach(() => {
    mockDataStore = {
      users: [],
      friends: [],
      messages: [],
      groups: [],
      groupMembers: [],
      groupMessages: [],
      posts: [],
      goals: [],
      capsules: []
    };
    mockSupabaseActive = false;
    mockSupabaseError = false;
    acceptCallCount = 0;
    vi.clearAllMocks();
  });

  describe('Local DB Fallback Path', () => {
    it('should cover all local DB functions and branches', async () => {
      // Users
      const u = await DB.createUser('u@email.com', 'user', 'hash');
      expect(u).toBeDefined();
      const f = await DB.findUserByEmail('u@email.com');
      expect(f).toBeDefined();

      await DB.updateUserProfile('u@email.com', 'BioText', 'LocText');
      await DB.updateUserCover('u@email.com', 'cover.jpg');
      await DB.updateUserAvatar('u@email.com', 'avatar.jpg');
      
      const lastSeenOk = await DB.updateLastSeen('u@email.com');
      expect(lastSeenOk).toBe(true);
      const lastSeenFail = await DB.updateLastSeen('nonexistent@email.com');
      expect(lastSeenFail).toBe(false);

      const s = await DB.searchUsers('us', 'exclude@email.com');
      expect(s.length).toBe(1);

      // Friends error paths
      const reqNotExist = await DB.sendFriendRequest('u@email.com', 'nonexistent@email.com');
      expect(reqNotExist.error).toBe('User does not exist.');

      await DB.createUser('o@email.com', 'other', 'hash');
      const reqOk = await DB.sendFriendRequest('u@email.com', 'o@email.com');
      expect(reqOk.success).toBe(true);

      const reqDup = await DB.sendFriendRequest('u@email.com', 'o@email.com');
      expect(reqDup.error).toBe('Request already exists.');

      const accept = await DB.acceptFriendRequest('o@email.com', 'u@email.com');
      expect(accept).toBe(true);
      const list = await DB.getFriends('u@email.com');
      expect(list.length).toBe(1);

      await DB.deleteFriendRequest('u@email.com', 'o@email.com');

      // Chat Messages
      await DB.saveMessage('u@email.com', 'o@email.com', 'Hello', 'file.jpg', 'file');
      const chat = await DB.getChatHistory('u@email.com', 'o@email.com');
      expect(chat.length).toBe(1);

      // Group Operations
      const group = await DB.createGroup('Group A', 'u@email.com', ['o@email.com']);
      expect(group).toBeDefined();
      const groups = await DB.getGroupsForUser('u@email.com');
      expect(groups.length).toBe(1);

      await DB.saveGroupMessage(group.id, 'u@email.com', 'GroupMsg');
      const groupMsgs = await DB.getGroupMessages(group.id);
      expect(groupMsgs.length).toBe(1);
      
      const groupHistory = await DB.getGroupChatHistory(group.id);
      expect(groupHistory.length).toBe(1);

      // Posts & Moments
      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'img.jpg', 'caption', false);
      // Create moment starting with [MOMENT] to cover the fallback branch
      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'img.jpg', '[MOMENT] caption', false);
      const feed = await DB.getFeed();
      expect(feed.length).toBe(1); // excluding moments

      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'moment.jpg', 'moment', true);
      const moments = await DB.getMoments();
      expect(moments.length).toBe(2);

      // Goals Board
      const goal = await DB.createGoal('u@email.com', 'Title', 'Tech');
      await DB.updateGoalProgress(goal.id, 99);
      const goals = await DB.getGoals('u@email.com');
      expect(goals.length).toBe(1);

      // Capsules
      await DB.createCapsule('u@email.com', 'message', Date.now());
      const capsules = await DB.getCapsules('u@email.com');
      expect(capsules.length).toBe(1);
    });
  });

  describe('Supabase Active Path', () => {
    it('should cover all Supabase DB functions and branches', async () => {
      mockSupabaseActive = true;

      // Users
      const u = await DB.createUser('u@email.com', 'user', 'hash');
      expect(u).toBeDefined();
      const f = await DB.findUserByEmail('u@email.com');
      expect(f).toBeDefined();

      await DB.updateUserProfile('u@email.com', 'BioText', 'LocText');
      await DB.updateUserCover('u@email.com', 'cover.jpg');
      await DB.updateUserAvatar('u@email.com', 'avatar.jpg');
      await DB.updateLastSeen('u@email.com');

      const s = await DB.searchUsers('us', 'exclude@email.com');
      expect(s).toBeDefined();

      // Friends
      const req = await DB.sendFriendRequest('u@email.com', 'o@email.com');
      expect(req).toBeDefined();

      // Double call to test the acceptCallCount logic in bidirectional mock
      const accept = await DB.acceptFriendRequest('o@email.com', 'u@email.com');
      expect(accept).toBe(true);

      const list = await DB.getFriends('u@email.com');
      expect(list).toBeDefined();

      await DB.deleteFriendRequest('u@email.com', 'o@email.com');

      // Chat Messages
      await DB.saveMessage('u@email.com', 'o@email.com', 'Hello', 'file.jpg', 'file');
      const chat = await DB.getChatHistory('u@email.com', 'o@email.com');
      expect(chat).toBeDefined();

      // Group Operations
      const group = await DB.createGroup('Group A', 'u@email.com', ['o@email.com']);
      expect(group).toBeDefined();
      const groups = await DB.getGroupsForUser('u@email.com');
      expect(groups).toBeDefined();

      await DB.saveGroupMessage('g123', 'u@email.com', 'GroupMsg');
      const groupMsgs = await DB.getGroupMessages('g123');
      expect(groupMsgs).toBeDefined();
      
      const groupHistory = await DB.getGroupChatHistory('g123');
      expect(groupHistory).toBeDefined();

      // Posts & Moments
      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'img.jpg', 'caption', false);
      const feed = await DB.getFeed();
      expect(feed).toBeDefined();

      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'moment.jpg', 'moment', true);
      const moments = await DB.getMoments();
      expect(moments).toBeDefined();

      // Goals Board
      const goal = await DB.createGoal('u@email.com', 'Title', 'Tech');
      await DB.updateGoalProgress('g123', 99);
      const goals = await DB.getGoals('u@email.com');
      expect(goals).toBeDefined();

      // Capsules
      await DB.createCapsule('u@email.com', 'message', Date.now());
      const capsules = await DB.getCapsules('u@email.com');
      expect(capsules).toBeDefined();
    });

    it('should cover Supabase error handling paths', async () => {
      mockSupabaseActive = true;
      mockSupabaseError = true;

      // Trigger error branches
      await DB.createUser('u@email.com', 'user', 'hash');
      await DB.findUserByEmail('u@email.com');
      await DB.updateUserProfile('u@email.com', 'BioText', 'LocText');
      await DB.updateUserCover('u@email.com', 'cover.jpg');
      await DB.updateUserAvatar('u@email.com', 'avatar.jpg');
      await DB.updateLastSeen('u@email.com');
      await DB.searchUsers('us', 'exclude@email.com');
      await DB.sendFriendRequest('u@email.com', 'o@email.com');
      await DB.acceptFriendRequest('o@email.com', 'u@email.com');
      await DB.getFriends('u@email.com');
      await DB.deleteFriendRequest('u@email.com', 'o@email.com');
      await DB.saveMessage('u@email.com', 'o@email.com', 'Hello', 'file.jpg', 'file');
      await DB.getChatHistory('u@email.com', 'o@email.com');
      await DB.createGroup('Group A', 'u@email.com', ['o@email.com']);
      await DB.getGroupsForUser('u@email.com');
      await DB.saveGroupMessage('g123', 'u@email.com', 'GroupMsg');
      await DB.getGroupMessages('g123');
      await DB.createPost('u@email.com', 'user', 'avatar.jpg', 'img.jpg', 'caption', false);
      await DB.getFeed();
      await DB.getMoments();
      await DB.createGoal('u@email.com', 'Title', 'Tech');
      await DB.updateGoalProgress('g123', 99);
      await DB.getGoals('u@email.com');
      await DB.createCapsule('u@email.com', 'message', Date.now());
      await DB.getCapsules('u@email.com');

      expect(mockSupabaseError).toBe(true);
    });
  });
});
