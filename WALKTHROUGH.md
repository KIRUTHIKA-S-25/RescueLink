# RescueLink — Developer Walkthrough

> **Intelligent Animal Rescue Coordination System**
> A full-stack college project built incrementally across phases.
> This document covers everything you need to understand, set up, and run the project as it currently stands.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [First-Time Setup](#5-first-time-setup)
6. [Running the App](#6-running-the-app)
7. [Environment Variables](#7-environment-variables)
8. [Authentication Flow](#8-authentication-flow)
9. [API Reference](#9-api-reference)
10. [Test Credentials](#10-test-credentials)
11. [Seed Script](#11-seed-script)
12. [Frontend Pages](#12-frontend-pages)
13. [Role-Based Access Control](#13-role-based-access-control)
14. [Development Tips](#14-development-tips)
15. [Phase Roadmap](#15-phase-roadmap)

---

## 1. Project Overview

RescueLink connects citizens who spot animals in distress with trained rescue responders. A citizen files a report → the system scores its priority → a nearby available responder is matched → real-time tracking begins → the case is verified and closed.

**Current status:** Phases 1–3 complete (infrastructure, database, authentication).

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Routing | React Router v6 |
| HTTP client | Axios |
| Backend | Node.js + Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT + bcryptjs + RBAC |
| Real-time | Socket.IO *(Phase 5)* |
| Images | Cloudinary *(Phase 4)* |

---

## 3. Project Structure

```
RescueLink/
├── client/                        ← React + Vite frontend
│   ├── src/
│   │   ├── App.jsx                ← Router shell + AuthProvider wrapper
│   │   ├── main.jsx               ← React entry point
│   │   ├── index.css              ← Tailwind + global styles
│   │   ├── context/
│   │   │   └── AuthContext.jsx    ← Global auth state (user, token, login, logout)
│   │   ├── services/
│   │   │   └── api.js             ← Axios instance (auto-attaches JWT)
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx ← Redirect to /login if not authenticated
│   │   │   └── RoleRoute.jsx      ← Redirect if wrong role
│   │   └── pages/
│   │       ├── Login.jsx          ← Login form
│   │       ├── Register.jsx       ← Registration form (always creates citizen)
│   │       └── Dashboard.jsx      ← Placeholder dashboard (Phase 3)
│   ├── tailwind.config.js
│   ├── vite.config.js             ← Proxy: /api → localhost:5000
│   └── package.json
│
├── server/                        ← Node.js + Express backend
│   ├── server.js                  ← Entry point (loads env → connects DB → listens)
│   ├── app.js                     ← Express setup (middleware, routes, error handler)
│   ├── .env                       ← Secrets (never commit this)
│   ├── .env.example               ← Safe template for .env
│   └── src/
│       ├── config/
│       │   └── db.js              ← Mongoose connection + DNS fix
│       ├── models/
│       │   ├── User.js            ← User schema (citizen/responder/admin)
│       │   ├── RescueCase.js      ← Rescue case schema
│       │   ├── ResponderProfile.js← Responder metadata + availability
│       │   └── Notification.js    ← In-app notifications
│       ├── controllers/
│       │   └── authController.js  ← register / login / getCurrentUser
│       ├── middleware/
│       │   ├── authMiddleware.js  ← JWT verification → req.user
│       │   └── roleMiddleware.js  ← authorizeRoles() → 403 if wrong role
│       ├── routes/
│       │   ├── authRoutes.js      ← /api/auth/*
│       │   └── testRoutes.js      ← /api/test/* (dev only)
│       └── utils/
│           ├── apiResponse.js     ← sendSuccess() / sendError() helpers
│           └── seedUsers.js       ← Creates 3 test users (citizen/responder/admin)
│
├── atlas-credentials.env          ← Atlas credentials (never commit)
├── .gitignore
├── README.md
└── WALKTHROUGH.md                 ← This file
```

---

## 4. Prerequisites

Make sure these are installed:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 18 | `node -v` |
| npm | >= 9 | `npm -v` |
| Git | any | `git --version` |

You also need:
- A **MongoDB Atlas** account with a free cluster (already configured for this project)
- The cluster IP whitelist must include your current IP address

---

## 5. First-Time Setup

### Step 1 — Clone the repo

```bash
git clone <your-repo-url>
cd RescueLink
```

### Step 2 — Install backend dependencies

```bash
cd server
npm install
```

### Step 3 — Set up backend environment variables

```bash
# Copy the template
cp .env.example .env
```

Then open `server/.env` and fill in:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rescuelink
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

> **Never commit `.env` or `atlas-credentials.env` to Git.**

### Step 4 — Install frontend dependencies

```bash
cd ../client
npm install
```

### Step 5 — Seed the database (first time only)

```bash
cd ../server
node src/utils/seedUsers.js
```

This creates three test accounts — one for each role. See [Test Credentials](#10-test-credentials).

---

## 6. Running the App

You need **two terminals** running simultaneously:

### Terminal 1 — Backend

```bash
cd server
node server.js
```

Expected output:
```
[DB] MongoDB connected successfully → ac-xxxxx.v8ksoal.mongodb.net

╔══════════════════════════════════════╗
║      RescueLink API Server           ║
║      Running on port 5000            ║
║      Environment: development        ║
╚══════════════════════════════════════╝

  Health check: http://localhost:5000/api/health
```

> For auto-restart on file changes, use: `npx nodemon server.js`

### Terminal 2 — Frontend

```bash
cd client
npm run dev
```

Expected output:
```
VITE v8.x  ready in xxxms
=> Local: http://localhost:5173/
```

Then open **http://localhost:5173** in your browser.

---

## 7. Environment Variables

### `server/.env`

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for signing JWTs | 64-char hex string |
| `JWT_EXPIRES_IN` | JWT lifetime | `7d` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `SEED_CITIZEN_EMAIL` | Seed script citizen email | `citizen@rescuelink.dev` |
| `SEED_CITIZEN_PASSWORD` | Seed script citizen password | `Citizen@123` |
| `SEED_RESPONDER_EMAIL` | Seed script responder email | `responder@rescuelink.dev` |
| `SEED_RESPONDER_PASSWORD` | Seed script responder password | `Responder@123` |
| `SEED_ADMIN_EMAIL` | Seed script admin email | `admin@rescuelink.dev` |
| `SEED_ADMIN_PASSWORD` | Seed script admin password | `Admin@123` |

### `client/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## 8. Authentication Flow

### How it works end-to-end

```
User fills Register form
        |
POST /api/auth/register
        |
Server validates input
  -> Forces role = "citizen" (ignores any role in request body)
  -> Hashes password with bcryptjs
  -> Saves user to MongoDB
  -> Returns safe user object (no password)
        |
User is redirected to /login
        |
User fills Login form
        |
POST /api/auth/login
        |
Server finds user by email
  -> Checks isActive flag
  -> Compares password hash with bcryptjs
  -> Issues JWT (payload: userId + role)
        |
Frontend stores JWT in localStorage as "rescuelink_token"
AuthContext updates with user data
        |
User is redirected to /dashboard
        |
On every API request:
  -> Axios interceptor reads "rescuelink_token" from localStorage
  -> Attaches as: Authorization: Bearer <token>
        |
On browser refresh:
  -> AuthContext calls GET /api/auth/me with stored token
  -> Session is restored automatically
        |
On logout:
  -> "rescuelink_token" removed from localStorage
  -> User state cleared
  -> Redirect to /login
```

### JWT Structure

```json
{
  "userId": "64abc...",
  "role": "citizen",
  "iat": 1234567890,
  "exp": 1234567890
}
```

> The payload intentionally contains only `userId` and `role` — nothing sensitive.

---

## 9. API Reference

### Health Check

```
GET /api/health
```

Response:
```json
{
  "success": true,
  "message": "RescueLink API is running",
  "environment": "development",
  "database": "connected",
  "timestamp": "2026-09-29T06:00:00.000Z"
}
```

---

### Auth Routes

#### Register (public)

```
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "MyPassword123!",
  "phone": "9876543210"
}
```

- Password must be **>= 8 characters**
- Role is **always forced to `citizen`** regardless of what you send
- Returns `201` on success, `409` on duplicate email, `400` on validation error

#### Login (public)

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "MyPassword123!"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "64abc...",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "citizen"
    }
  }
}
```

#### Get Current User (protected)

```
GET /api/auth/me
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "64abc...",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "9876543210",
    "role": "citizen",
    "isActive": true
  }
}
```

---

### Dev Test Routes (development only)

> These routes only work when `NODE_ENV=development`. Use them to verify RBAC.

```
GET /api/test/protected         -> Any authenticated user (401 if no token)
GET /api/test/citizen           -> citizen role only     (403 for others)
GET /api/test/responder         -> responder role only   (403 for others)
GET /api/test/admin             -> admin role only       (403 for others)
```

---

### Standard API Response Format

Every response follows this shape:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { "..." : "..." }
}
```

Error responses may also include:
```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "errors": ["Name is required", "Password too short"]
}
```

---

## 10. Test Credentials

Created by running the seed script. Use these to test all three roles:

| Role | Email | Password |
|------|-------|----------|
| **Citizen** | `citizen@rescuelink.dev` | `Citizen@123` |
| **Responder** | `responder@rescuelink.dev` | `Responder@123` |
| **Admin** | `admin@rescuelink.dev` | `Admin@123` |

> Public registration always creates **citizens**. Responder/admin accounts can only be created via the seed script (in later phases: through a controlled admin UI).

---

## 11. Seed Script

The seed script creates/updates all three test users in MongoDB Atlas.

```bash
cd server
node src/utils/seedUsers.js
```

- **Safe to run multiple times** — uses upsert, will not create duplicates
- Passwords are **bcrypt-hashed** before saving
- Credentials are read from `server/.env` (the `SEED_*` variables)
- Never prints passwords to the console

---

## 12. Frontend Pages

| Route | Page | Auth Required | Description |
|-------|------|---------------|-------------|
| `/` | — | — | Redirects to `/dashboard` |
| `/register` | `Register.jsx` | No | Create a citizen account |
| `/login` | `Login.jsx` | No | Log in with email + password |
| `/dashboard` | `Dashboard.jsx` | Yes | Placeholder dashboard (Phase 3) |

### Register page
- Fields: Name, Email, Phone (optional), Password, Confirm Password
- No role selector — all accounts become citizens
- Validates email format, password length (>= 8), password confirmation
- Redirects to `/login` on success

### Login page
- Fields: Email, Password
- Shows clear error messages on failure
- Redirects to `/dashboard` on success

### Dashboard page
- Shows user name, email, role badge
- Logout button clears the token and redirects to `/login`
- Session survives browser refresh (token restored from localStorage)

---

## 13. Role-Based Access Control

### Three roles

| Role | Description | Created via |
|------|-------------|-------------|
| `citizen` | Reports rescues | Public registration |
| `responder` | Handles rescue cases | Seed script / admin panel *(Phase 6)* |
| `admin` | Manages platform | Seed script / controlled mechanism |

### Backend enforcement

```javascript
// Any authenticated user
router.get('/resource', protect, handler);

// Responders and admins only
router.get('/resource', protect, authorizeRoles('responder', 'admin'), handler);

// Admins only
router.get('/resource', protect, authorizeRoles('admin'), handler);
```

### Frontend guards

```jsx
// Any authenticated user
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// Specific role
<RoleRoute allowedRoles={['admin']}>
  <AdminPanel />
</RoleRoute>
```

> Frontend guards are UX only. The backend middleware is the real security layer.

### HTTP status codes

| Code | Meaning |
|------|---------|
| `401` | Not authenticated (missing/invalid/expired token) |
| `403` | Authenticated but role is not permitted |
| `409` | Conflict (e.g. duplicate email) |

---

## 14. Development Tips

### Common issues

**Port 5000 already in use (PowerShell):**
```powershell
$proc = Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | Select-Object -First 1
Stop-Process -Id $proc -Force
```

**MongoDB SRV DNS error (`querySrv ECONNREFUSED`):**
- Your IP is not whitelisted in Atlas
  → go to **Atlas → Security → Network Access → Add IP Address**
- Or your network DNS doesn't support SRV records
  → `db.js` already applies the fix with `dns.setServers(['8.8.8.8', '8.8.4.4'])`

**JWT expired error on frontend:**
- Click logout and log back in, or clear `rescuelink_token` from
  browser DevTools → Application → Local Storage

### Useful commands

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Check what's running on port 5000
Get-NetTCPConnection -LocalPort 5000
```

### API testing with curl

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"Pass1234!"}'

# Login (copy the token from the response)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Pass1234!"}'

# Use the token
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <paste-token-here>"
```

---

## 15. Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | Done | Project setup (React + Vite + Tailwind + Express + Proxy) |
| **Phase 2** | Done | MongoDB Atlas + Mongoose + database models |
| **Phase 3** | Done | Authentication (JWT + bcrypt + RBAC + login/register UI) |
| **Phase 4** | Next | Rescue case reporting + Cloudinary image upload |
| **Phase 5** | Planned | Priority algorithm + Haversine responder matching |
| **Phase 6** | Planned | Socket.IO real-time tracking |
| **Phase 7** | Planned | Escalation + duplicate detection |
| **Phase 8** | Planned | Rescue verification + case lifecycle |
| **Phase 9** | Planned | Admin dashboard + analytics |
| **Phase 10** | Planned | Deployment (Render) |

---

*Last updated: Phase 3 complete — September 2026*
