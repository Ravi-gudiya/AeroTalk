# AeroTalk — Premium Real-Time Chat & Social Platform

AeroTalk is a production-ready, fully responsive chat, call, and social network application built with React/Vite (frontend) and Node.js/Express (backend), powered by Supabase PostgreSQL for persistent data operations and Socket.io for instantaneous bidirectional events.

---

## 📁 Monorepo Folder Structure

```
AeroTalk/
├── frontend/             # Vite + React (Vanilla JS) application
│   ├── src/              # Logic components, state, media call modules
│   │   ├── main.js       # Core entry and API controller handlers
│   │   └── style.css     # Glassmorphism dark layout styling
│   └── package.json      # Frontend npm package configurations
│
├── backend/              # Node.js + Express application
│   ├── index.js          # REST routing, WebSockets presence server
│   ├── db.js             # Supabase cloud query layer & local fallback
│   ├── services/
│   │   └── supabase.js   # Supabase client instantiation
│   └── package.json      # Express dependencies
│
└── database/
    └── schema.sql        # Database tables DDL schema
```

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` in the root:

```bash
# Server Port configuration
PORT=5000
JWT_SECRET=super_secret_session_key

# Supabase Database Keys
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-role-key

# Production Frontend Address (for CORS configuration)
FRONTEND_URL=https://aerotalk.vercel.app

# Vite Proxy endpoint (used in local development)
VITE_API_URL=http://localhost:5000
```

*Note: If no Supabase URL/Key is supplied, AeroTalk automatically cascades back to a local JSON database engine (`backend/data.json`) so it runs immediately out-of-the-box.*

---

## 🚀 Local Development Setup

To initialize and launch both frontend and backend concurrently:

1. **Clone the repository and install root workspace files:**
   ```bash
   npm install
   ```

2. **Configure dependencies in workspaces:**
   ```bash
   npm install --prefix frontend
   npm install --prefix backend
   ```

3. **Start the applications:**
   * **Start Backend:**
     ```bash
     npm start
     ```
   * **Start Frontend Dev Server:**
     ```bash
     npm run dev
     ```

---

## 🌐 Production Deployment Guide

### Frontend — Vercel
1. Select the **Root Directory** as `frontend`.
2. Configure the Build Command as `npm run build`.
3. Set Output Directory to `dist`.
4. Add the Environment Variable `VITE_API_URL` pointing to your deployed backend URL.

### Backend — Render
1. Select the **Root Directory** as `backend`.
2. Select Environment as `Node`.
3. Set the Build Command as `npm install`.
4. Set the Start Command as `node index.js`.
5. Add environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, and `FRONTEND_URL`.

### Database — Supabase
1. Create a free project at [Supabase](https://supabase.com).
2. Open the SQL Editor in your dashboard, paste the contents of `database/schema.sql`, and run the script to initialize tables.

---

## 🛠️ API & WebRTC Endpoints

AeroTalk supports full authentication, chat pipelines, group structures, social feeds, goals tracker, and time capsules:

* **Authentication**: `POST /api/auth/register` (registration), `POST /api/auth/login` (login)
* **Users Directory**: `GET /api/users/search` (search contacts), `GET /api/users/me` (personal profile)
* **Social Engine**: `POST /api/feed` (post message & image), `GET /api/feed` (chronological feed history)
* **Friends List**: `POST /api/friends/request`, `POST /api/friends/accept`, `GET /api/friends`
* **Realtime signaling**: PeerJS WebRTC handles standard voice/video call coordination.
