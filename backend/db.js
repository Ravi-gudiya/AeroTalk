// Hybrid database layer: routes dynamically between Supabase Cloud or Local JSON fallback
import { supabase } from './services/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data.json');

const INITIAL_DATA = {
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

// Check if database exists, create if not
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
}

function readLocalData() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_DATA;
  }
}

function writeLocalData(data) {
  try {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (err) {
    return false;
  }
}

const isSupabaseActive = () => {
  return !!supabase;
};

export const DB = {
  // --- User / Profile Operations ---
  
  async createUser(email, username, passwordHash) {
    const cleanEmail = email.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: newUser, error } = await supabase
        .from('profiles')
        .insert([{
          email: cleanEmail,
          username: username.trim(),
          password_hash: passwordHash,
          display_name: username.trim(),
          theme: 'Aero Dark',
          online_status: 'offline',
          reputation: 100
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Supabase createUser error:', error);
        return null;
      }
      return {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        passwordHash: newUser.password_hash,
        avatarColor: '#8A2BE2'
      };
    } else {
      const data = readLocalData();
      if (data.users.some(u => u.email === cleanEmail)) return null;
      
      const colors = ['#8A2BE2', '#00FFD2', '#FF1744', '#00E676', '#FF9100', '#2979FF', '#FF007F'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newUser = {
        id: 'usr_' + Math.random().toString(36).substr(2, 9),
        email: cleanEmail,
        username: username.trim(),
        passwordHash,
        avatarColor,
        bio: 'Conversations that go beyond.',
        reputationScore: 100,
        timeline: [{ title: 'Joined AeroTalk', description: 'Created secure digital identity on the platform', date: new Date().toLocaleDateString() }],
        teach: ['Python', 'UI Design'],
        learn: ['Photography', 'Music'],
        lastSeen: Date.now()
      };
      
      data.users.push(newUser);
      writeLocalData(data);
      return newUser;
    }
  },

  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
        
      if (error || !user) return null;
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        avatarColor: '#8A2BE2',
        avatarUrl: user.profile_photo || null,
        coverUrl: user.cover_photo || null,
        bio: user.bio,
        skills: user.skills || [],
        interests: user.interests || [],
        education: user.education,
        experience: user.experience,
        portfolioUrl: user.portfolio_url,
        reputationScore: user.reputation,
        achievementBadges: user.verified ? ['verified'] : ['pioneer'],
        lastSeen: user.last_seen
      };
    } else {
      const data = readLocalData();
      const user = data.users.find(u => u.email === cleanEmail);
      return user || null;
    }
  },

  async searchUsers(query, excludeEmail) {
    const cleanQuery = query.toLowerCase().trim();
    const cleanExclude = excludeEmail.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', cleanExclude);
        
      if (error || !list) return [];
      
      return list
        .filter(u => u.email.includes(cleanQuery) || u.username.toLowerCase().includes(cleanQuery))
        .map(u => ({
          email: u.email,
          username: u.username,
          avatarColor: '#8A2BE2',
          avatarUrl: u.profile_photo || null,
          bio: u.bio || '',
          reputationScore: u.reputation || 100,
          teach: u.skills || [],
          learn: u.interests || []
        }));
    } else {
      const data = readLocalData();
      return data.users
        .filter(u => u.email !== cleanExclude && (u.email.includes(cleanQuery) || u.username.toLowerCase().includes(cleanQuery)))
        .map(u => ({
          email: u.email,
          username: u.username,
          avatarColor: u.avatarColor,
          avatarUrl: u.avatarUrl || null,
          bio: u.bio || '',
          reputationScore: u.reputationScore || 100,
          teach: u.teach || [],
          learn: u.learn || []
        }));
    }
  },

  async updateUserProfile(email, updateData) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          username: updateData.username,
          bio: updateData.bio,
          skills: updateData.skills,
          interests: updateData.interests,
          education: updateData.education,
          experience: updateData.experience,
          portfolio_url: updateData.portfolioUrl
        })
        .eq('email', cleanEmail)
        .select()
        .single();
        
      if (error) return null;
      return {
        email: profile.email,
        username: profile.username,
        bio: profile.bio,
        skills: profile.skills,
        interests: profile.interests,
        education: profile.education,
        experience: profile.experience,
        portfolioUrl: profile.portfolio_url
      };
    } else {
      const data = readLocalData();
      const user = data.users.find(u => u.email === cleanEmail);
      if (!user) return null;
      
      user.username = updateData.username || user.username;
      user.bio = updateData.bio || user.bio;
      user.skills = updateData.skills || user.skills;
      user.interests = updateData.interests || user.interests;
      user.education = updateData.education || user.education;
      user.experience = updateData.experience || user.experience;
      user.portfolioUrl = updateData.portfolioUrl || user.portfolioUrl;
      
      writeLocalData(data);
      return user;
    }
  },

  async updateUserCover(email, coverUrl) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_photo: coverUrl })
        .eq('email', cleanEmail);
      return !error;
    } else {
      const data = readLocalData();
      const user = data.users.find(u => u.email === cleanEmail);
      if (!user) return false;
      user.coverUrl = coverUrl;
      writeLocalData(data);
      return true;
    }
  },

  async updateUserAvatar(email, avatarUrl) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_photo: avatarUrl })
        .eq('email', cleanEmail);
      return !error;
    } else {
      const data = readLocalData();
      const user = data.users.find(u => u.email === cleanEmail);
      if (!user) return false;
      user.avatarUrl = avatarUrl;
      writeLocalData(data);
      return true;
    }
  },

  async updateLastSeen(email) {
    const cleanEmail = email.toLowerCase().trim();
    const timestamp = new Date().toISOString();
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('profiles')
        .update({ last_seen: timestamp })
        .eq('email', cleanEmail);
      return !error;
    } else {
      const data = readLocalData();
      const user = data.users.find(u => u.email === cleanEmail);
      if (user) {
        user.lastSeen = Date.now();
        writeLocalData(data);
        return true;
      }
      return false;
    }
  },

  // --- Friend Operations ---
  
  async sendFriendRequest(senderEmail, receiverEmail) {
    const sender = senderEmail.toLowerCase().trim();
    const receiver = receiverEmail.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('friends')
        .insert([{ sender_email: sender, receiver_email: receiver, status: 'pending' }]);
      if (error) return { error: 'Friend request already exists or user does not exist.' };
      return { success: true };
    } else {
      const data = readLocalData();
      const receiverExists = data.users.some(u => u.email === receiver);
      if (!receiverExists) return { error: 'User does not exist.' };
      
      const existing = data.friends.find(f => 
        (f.senderEmail === sender && f.receiverEmail === receiver) ||
        (f.senderEmail === receiver && f.receiverEmail === sender)
      );
      if (existing) return { error: 'Request already exists.' };
      
      data.friends.push({ senderEmail: sender, receiverEmail: receiver, status: 'pending' });
      writeLocalData(data);
      return { success: true };
    }
  },

  async acceptFriendRequest(receiverEmail, senderEmail) {
    const receiver = receiverEmail.toLowerCase().trim();
    const sender = senderEmail.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('sender_email', sender)
        .eq('receiver_email', receiver);
      return !error;
    } else {
      const data = readLocalData();
      const req = data.friends.find(f => f.senderEmail === sender && f.receiverEmail === receiver);
      if (!req) return false;
      req.status = 'accepted';
      writeLocalData(data);
      return true;
    }
  },

  async deleteFriendRequest(email1, email2) {
    const e1 = email1.toLowerCase().trim();
    const e2 = email2.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(sender_email.eq.${e1},receiver_email.eq.${e2}),and(sender_email.eq.${e2},receiver_email.eq.${e1})`);
      return !error;
    } else {
      const data = readLocalData();
      const initialLength = data.friends.length;
      data.friends = data.friends.filter(f => 
        !((f.senderEmail === e1 && f.receiverEmail === e2) || (f.senderEmail === e2 && f.receiverEmail === e1))
      );
      writeLocalData(data);
      return data.friends.length < initialLength;
    }
  },

  async getFriends(email) {
    const cleanEmail = email.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: friendships, error } = await supabase
        .from('friends')
        .select('*, sender:profiles!friends_sender_email_fkey(*), receiver:profiles!friends_receiver_email_fkey(*)')
        .or(`sender_email.eq.${cleanEmail},receiver_email.eq.${cleanEmail}`);
        
      if (error || !friendships) return [];
      
      return friendships.map(f => {
        const isSender = f.sender_email === cleanEmail;
        const friendProfile = isSender ? f.receiver : f.sender;
        return {
          email: friendProfile.email,
          username: friendProfile.username,
          avatarColor: '#8A2BE2',
          avatarUrl: friendProfile.profile_photo || null,
          status: f.status,
          role: isSender ? 'sender' : 'receiver',
          lastSeen: friendProfile.last_seen
        };
      });
    } else {
      const data = readLocalData();
      const friendships = data.friends.filter(f => 
        (f.senderEmail === cleanEmail || f.receiverEmail === cleanEmail)
      );
      const friendsList = [];
      friendships.forEach(f => {
        const isSender = f.senderEmail === cleanEmail;
        const targetEmail = isSender ? f.receiverEmail : f.senderEmail;
        const user = data.users.find(u => u.email === targetEmail);
        if (user) {
          friendsList.push({
            email: user.email,
            username: user.username,
            avatarColor: user.avatarColor,
            avatarUrl: user.avatarUrl || null,
            status: f.status,
            role: isSender ? 'sender' : 'receiver',
            lastSeen: user.lastSeen || null
          });
        }
      });
      return friendsList;
    }
  },

  // --- Chat Operations ---
  
  async saveMessage(from, to, content, fileUrl = null, fileName = null) {
    const sender = from.toLowerCase().trim();
    const receiver = to.toLowerCase().trim();
    const timestamp = Date.now();
    
    if (isSupabaseActive()) {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert([{
          sender,
          receiver,
          content,
          file_url: fileUrl,
          file_name: fileName
        }])
        .select()
        .single();
        
      if (error) return null;
      return {
        from: newMsg.sender,
        to: newMsg.receiver,
        content: newMsg.content,
        fileUrl: newMsg.file_url,
        fileName: newMsg.file_name,
        timestamp: new Date(newMsg.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const newMsg = {
        from: sender,
        to: receiver,
        content,
        fileUrl,
        fileName,
        timestamp
      };
      data.messages.push(newMsg);
      writeLocalData(data);
      return newMsg;
    }
  },

  async getChatHistory(email1, email2) {
    const e1 = email1.toLowerCase().trim();
    const e2 = email2.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender.eq.${e1},receiver.eq.${e2}),and(sender.eq.${e2},receiver.eq.${e1})`)
        .order('created_at', { ascending: true });
        
      if (error || !list) return [];
      return list.map(m => ({
        from: m.sender,
        to: m.receiver,
        content: m.content,
        fileUrl: m.file_url,
        fileName: m.file_name,
        timestamp: new Date(m.created_at).getTime()
      }));
    } else {
      const data = readLocalData();
      return data.messages.filter(m => 
        (m.from === e1 && m.to === e2) || (m.from === e2 && m.to === e1)
      );
    }
  },

  // --- Group Chats Operations ---
  
  async createGroup(name, creatorEmail, memberEmails) {
    const creator = creatorEmail.toLowerCase().trim();
    
    if (isSupabaseActive()) {
      const { data: newGroup, error } = await supabase
        .from('groups')
        .insert([{ name: name.trim(), created_by: creator }])
        .select()
        .single();
        
      if (error) return null;
      
      const allMembers = memberEmails.concat(creator).map(m => ({
        group_id: newGroup.id,
        email: m.toLowerCase().trim()
      }));
      
      await supabase.from('group_members').insert(allMembers);
      return {
        id: newGroup.id,
        name: newGroup.name,
        createdBy: newGroup.created_by
      };
    } else {
      const data = readLocalData();
      const newGroup = {
        id: 'group_' + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        createdBy: creator
      };
      data.groups.push(newGroup);
      
      memberEmails.concat(creator).forEach(email => {
        data.groupMembers.push({ groupId: newGroup.id, email: email.toLowerCase().trim() });
      });
      
      writeLocalData(data);
      return newGroup;
    }
  },

  async getGroupsForUser(email) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: memberships, error } = await supabase
        .from('group_members')
        .select('*, group:groups(*)')
        .eq('email', cleanEmail);
        
      if (error || !memberships) return [];
      return memberships.map(m => ({
        id: m.group.id,
        name: m.group.name,
        createdBy: m.group.created_by
      }));
    } else {
      const data = readLocalData();
      const memberGroupIds = data.groupMembers
        .filter(m => m.email === cleanEmail)
        .map(m => m.groupId);
      return data.groups.filter(g => memberGroupIds.includes(g.id));
    }
  },

  async saveGroupMessage(groupId, from, content, fileUrl = null, fileName = null) {
    const sender = from.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: newMsg, error } = await supabase
        .from('group_messages')
        .insert([{
          group_id: groupId,
          sender,
          content,
          file_url: fileUrl,
          file_name: fileName
        }])
        .select()
        .single();
        
      if (error) return null;
      return {
        groupId: newMsg.group_id,
        from: newMsg.sender,
        content: newMsg.content,
        fileUrl: newMsg.file_url,
        fileName: newMsg.file_name,
        timestamp: new Date(newMsg.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const newMsg = {
        groupId,
        from: sender,
        content,
        fileUrl,
        fileName,
        timestamp: Date.now()
      };
      data.groupMessages.push(newMsg);
      writeLocalData(data);
      return newMsg;
    }
  },

  async getGroupMessages(groupId) {
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
        
      if (error || !list) return [];
      return list.map(m => ({
        groupId: m.group_id,
        from: m.sender,
        content: m.content,
        fileUrl: m.file_url,
        fileName: m.file_name,
        timestamp: new Date(m.created_at).getTime()
      }));
    } else {
      const data = readLocalData();
      return data.groupMessages.filter(m => m.groupId === groupId);
    }
  },

  async getGroupChatHistory(groupId) {
    return this.getGroupMessages(groupId);
  },

  // --- Post Social Feed Operations ---
  
  async createPost(email, username, avatarUrl, imageUrl, caption) {
    const cleanEmail = email.toLowerCase().trim();
    const confidence = Math.floor(Math.random() * 15) + 85;
    
    if (isSupabaseActive()) {
      const { data: newPost, error } = await supabase
        .from('posts')
        .insert([{
          email: cleanEmail,
          username,
          avatar_url: avatarUrl,
          image_url: imageUrl,
          caption,
          confidence
        }])
        .select()
        .single();
        
      if (error) return null;
      return {
        id: newPost.id,
        email: newPost.email,
        username: newPost.username,
        avatarUrl: newPost.avatar_url,
        imageUrl: newPost.image_url,
        caption: newPost.caption,
        confidence: newPost.confidence,
        timestamp: new Date(newPost.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const newPost = {
        id: 'post_' + Math.random().toString(36).substr(2, 9),
        email: cleanEmail,
        username,
        avatarUrl,
        imageUrl,
        caption,
        confidence,
        timestamp: Date.now()
      };
      
      data.posts.push(newPost);
      writeLocalData(data);
      return newPost;
    }
  },

  async getFeed() {
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error || !list) return [];
      return list.map(p => ({
        id: p.id,
        email: p.email,
        username: p.username,
        avatarUrl: p.avatar_url,
        imageUrl: p.image_url,
        caption: p.caption,
        confidence: p.confidence,
        timestamp: new Date(p.created_at).getTime()
      }));
    } else {
      const data = readLocalData();
      return data.posts.sort((a, b) => b.timestamp - a.timestamp);
    }
  },

  // --- Goal Operations ---
  
  async createGoal(email, title, category) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: newGoal, error } = await supabase
        .from('goals')
        .insert([{
          email: cleanEmail,
          title,
          category,
          progress: 0
        }])
        .select()
        .single();
        
      if (error) return null;
      return {
        id: newGoal.id,
        email: newGoal.email,
        title: newGoal.title,
        category: newGoal.category,
        progress: newGoal.progress,
        timestamp: new Date(newGoal.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const newGoal = {
        id: 'goal_' + Math.random().toString(36).substr(2, 9),
        email: cleanEmail,
        title: title.trim(),
        category: category.trim(),
        progress: 0,
        timestamp: Date.now()
      };
      data.goals.push(newGoal);
      writeLocalData(data);
      return newGoal;
    }
  },

  async updateGoalProgress(goalId, progress) {
    if (isSupabaseActive()) {
      const { data: goal, error } = await supabase
        .from('goals')
        .update({ progress: Number(progress) })
        .eq('id', goalId)
        .select()
        .single();
        
      if (error) return null;
      return {
        id: goal.id,
        email: goal.email,
        title: goal.title,
        category: goal.category,
        progress: goal.progress,
        timestamp: new Date(goal.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const goal = data.goals.find(g => g.id === goalId);
      if (!goal) return false;
      goal.progress = Number(progress);
      writeLocalData(data);
      return goal;
    }
  },

  async getGoals(email) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('goals')
        .select('*')
        .eq('email', cleanEmail)
        .order('created_at', { ascending: false });
        
      if (error || !list) return [];
      return list.map(g => ({
        id: g.id,
        email: g.email,
        title: g.title,
        category: g.category,
        progress: g.progress,
        timestamp: new Date(g.created_at).getTime()
      }));
    } else {
      const data = readLocalData();
      return data.goals.filter(g => g.email === cleanEmail);
    }
  },

  // --- Time Capsules Operations ---
  
  async createCapsule(email, message, openDate) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: cap, error } = await supabase
        .from('capsules')
        .insert([{
          email: cleanEmail,
          message,
          open_date: openDate,
          is_opened: false
        }])
        .select()
        .single();
        
      if (error) return null;
      return {
        id: cap.id,
        email: cap.email,
        message: cap.message,
        openDate: cap.open_date,
        isOpened: cap.is_opened,
        timestamp: new Date(cap.created_at).getTime()
      };
    } else {
      const data = readLocalData();
      const newCapsule = {
        id: 'cap_' + Math.random().toString(36).substr(2, 9),
        email: cleanEmail,
        message: message.trim(),
        openDate,
        isOpened: false,
        timestamp: Date.now()
      };
      data.capsules.push(newCapsule);
      writeLocalData(data);
      return newCapsule;
    }
  },

  async getCapsules(email) {
    const cleanEmail = email.toLowerCase().trim();
    if (isSupabaseActive()) {
      const { data: list, error } = await supabase
        .from('capsules')
        .select('*')
        .eq('email', cleanEmail)
        .order('created_at', { ascending: false });
        
      if (error || !list) return [];
      return list.map(c => ({
        id: c.id,
        email: c.email,
        message: c.message,
        openDate: c.open_date,
        isOpened: c.is_opened,
        timestamp: new Date(c.created_at).getTime()
      }));
    } else {
      const data = readLocalData();
      return data.capsules.filter(c => c.email === cleanEmail);
    }
  }
};
