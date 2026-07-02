-- AeroTalk Database Schema (PostgreSQL for Supabase)
-- Exposes tables with foreign key relationships matching AeroTalk's features.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_photo VARCHAR(500) DEFAULT '',
    cover_photo VARCHAR(500) DEFAULT '',
    bio TEXT DEFAULT 'Conversations that go beyond.',
    theme VARCHAR(50) DEFAULT 'Aero Dark',
    language VARCHAR(50) DEFAULT 'English',
    online_status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    reputation INT DEFAULT 100,
    followers TEXT[] DEFAULT '{}',
    following TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{"Networking", "Public Speaking"}',
    interests TEXT[] DEFAULT '{"Tech", "AI", "Photography"}',
    education TEXT DEFAULT 'AeroTalk Academy',
    experience TEXT DEFAULT 'Digital Enthusiast',
    portfolio_url VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Friends Table (Accepted & Pending Friendships)
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    receiver_email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'accepted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sender_email, receiver_email)
);

-- 3. Messages Table (1-to-1 Direct Messaging)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    receiver VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    content TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Groups Table (Communities Workspace)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Group Members Table (Many-to-Many Members Mapping)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, email)
);

-- 6. Group Messages Table
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    content TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Posts Table (Aero Social Feed)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    image_url VARCHAR(500) NOT NULL,
    caption TEXT,
    category VARCHAR(100) DEFAULT 'General',
    confidence INT DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Goals Tracker Table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    progress INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Time Capsules Table
CREATE TABLE IF NOT EXISTS public.capsules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
    message TEXT NOT NULL,
    open_date DATE NOT NULL,
    is_opened BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
