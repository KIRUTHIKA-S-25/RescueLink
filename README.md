# 🐾 RescueLink

<div align="center">

![RescueLink Banner](https://img.shields.io/badge/RescueLink-Animal%20Emergency%20Dispatch-rose?style=for-the-badge&logo=shield)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/atlas)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=flat-square&logo=leaflet)](https://leafletjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Intelligent Animal Rescue Coordination & Emergency Case Management System**  
*A modern full-stack civic emergency dispatch platform connecting citizens, trained rescue teams, and veterinary shelters.*

[Live Features](#-key-features) • [Tech Stack](#-technology-stack) • [Quick Start](#-quick-start-guide) • [Demo Credentials](#-quick-test-demo-credentials) • [API Matrix](#-api-endpoints-summary) • [Architecture Deep Dive](#-architecture--system-flow)

</div>

---

## 📖 Table of Contents
- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture & Lifecycle](#-system-architecture--lifecycle)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Quick-Test Demo Credentials](#-quick-test-demo-credentials)
- [Project Directory Structure](#-project-directory-structure)
- [API Endpoints Summary](#-api-endpoints-summary)
- [Architecture & System Flow](#-architecture--system-flow)
- [Contributing & License](#-contributing--license)

---

## 🎯 Problem Statement

When an animal is injured by vehicles, trapped, or critically ill on streets, citizens face massive friction:
- **Fragmented Helplines:** Unreachable phone numbers or delayed WhatsApp forwarding.
- **Subjective Triage:** Cases are handled randomly rather than by medical severity.
- **Vague Locations:** Verbal directions cause responders to waste crucial minutes locating the animal.
- **Zero Accountability:** Citizens are never updated on whether the animal was rescued or treated.

**RescueLink** transforms animal emergency rescue into an auditable, deterministic dispatch engine.

---

## ✨ Key Features

### 🚨 Low-Friction Emergency Reporting
- **No Forced Sign-In:** Guests and citizens can submit an incident in under 30 seconds.
- **One-Click Browser GPS:** Captures precise `latitude` and `longitude` via HTML5 Geolocation API with manual address fallback.
- **Photo Evidence Upload:** Multipart upload via Multer so responders can evaluate the trauma level before arrival.

### 🧠 Algorithmic Triage & Scoring
- Classifies incidents into **CRITICAL**, **HIGH**, **MEDIUM**, and **LOW** based on animal vulnerability, trauma type, and surrounding hazard.
- Sets automated escalation safeguards if an unassigned case sits past response thresholds.

### 📍 Geospatial Haversine Dispatch
- Real-time distance calculation between on-duty responders and the incident scene using the spherical Haversine formula.
- Shows dynamic `km away` badges on the responder field dashboard.

### 🦺 Dedicated Responder Terminal
- Filterable operational queue (`ALL`, `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `RESCUED`, `CANCELLED`).
- Interactive step-by-step status transitions with automated timestamp logging.
- Field note and medical progress logging directly tied to the case timeline.

### 🗺️ Interactive Leaflet GPS Mapping
- Interactive OpenStreetMap integration with custom markers and direct deep-link navigation into Google Maps.

### 🔔 Live Polling & Notification Engine
- Real-time notification drawer for dispatch alerts, status shifts, and updates.
- 12-second live polling on active case dossiers.

### ⭐ Verification & Citizen Feedback
- Citizens track their reported cases through a 4-stage visual progress timeline.
- Reporter ratings (1–5 stars) and feedback reviews once an animal is safely marked `RESCUED`.

---

## 🛠️ Technology Stack

| Domain | Technology | Description |
|---|---|---|
| **Client Core** | **React 19**, **Vite 6** | Fast Single Page Application with optimized bundle splitting |
| **Routing** | **React Router v7** | Client-side routing with role-based protected wrappers |
| **Styling & UI** | **Tailwind CSS 3.4**, Vanilla CSS | Custom mesh gradients, glassmorphism, and responsive micro-animations |
| **Geospatial & Maps** | **Leaflet**, **React-Leaflet** | OpenStreetMap integration, coordinate pinning, and radius rendering |
| **HTTP & State** | **Axios**, **React Context API** | Interceptor-driven JWT bearer token injection & 401 session recovery |
| **Server Engine** | **Node.js**, **Express.js** | Modular REST API with centralized error and validation middleware |
| **Database & ODM** | **MongoDB Atlas**, **Mongoose** | Cloud NoSQL cluster with TLS connection failovers & DNS SRV resolution |
| **Security & Auth** | **JWT**, **bcryptjs** | Salted hashing (cost factor 10) & Role-Based Access Control (RBAC) |
| **File Storage** | **Multer** | Multipart image parsing and asset serving |

---

## 🔄 System Architecture & Lifecycle

RescueLink enforces an auditable, finite-state machine across every rescue request:

```
[Citizen / Guest] ──► Submits Emergency SOS (/report)
                             │
                             ▼
                     [PENDING CASE] ◄── Escalation Timer (5 mins)
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
  [RESCUER ACCEPTS]                       [ADMIN OVERRIDE]
         │
         ▼
    [ACCEPTED] ──► Responder En Route
         │
         ▼
  [IN_PROGRESS] ──► On Scene / Medical First-Aid
         │
         ▼
     [RESCUED] ──► Proof Uploaded & Animal Secured
         │
         ▼
      [CLOSED] ──► Citizen Rating & Case Archive
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`
- **MongoDB Atlas** cluster URI (or local MongoDB daemon)

---

### Backend Setup

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables (`server/.env`):**
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/rescuelink?retryWrites=true&w=majority
   JWT_SECRET=rescuelink_super_secure_jwt_secret_key_2026
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   ```

4. **Seed Demo Accounts (Optional but Recommended):**
   ```bash
   node src/utils/seedUsers.js
   ```

5. **Start the API Server:**
   ```bash
   npm run dev
   ```
   *The server starts on `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`).*

---

### Frontend Setup

1. **Navigate to the client directory:**
   ```bash
   cd ../client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Open **[http://localhost:5173](http://localhost:5173)** to access the RescueLink Operations Hub.

---

## 🔑 Quick-Test Demo Credentials

For quick evaluation, pre-configured roles are ready to use via the **1-Click Quick Fill** buttons inside the Sign In modal:

| Role | Email | Password | Access Rights |
|---|---|---|---|
| 👤 **Citizen** | `citizen@rescuelink.dev` | `Citizen@123` | File emergency SOS, track `/my-rescues`, leave feedback |
| 🦺 **Responder** | `responder@rescuelink.dev` | `Responder@123` | Access `/rescuer` terminal, accept cases, update medical progress |
| 👑 **Administrator** | `admin@rescuelink.dev` | `Admin@123` | Access `/admin` Command Hub, audit logs, system-wide metrics |

---

## 📂 Project Directory Structure

```
RescueLink/
├── client/                              # React 19 + Vite Frontend
│   ├── public/                          # Static assets and icons
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx            # Unified login/register modal with 1-click demo fill
│   │   │   ├── NotificationBell.jsx     # Live unread counter dropdown with auto-polling
│   │   │   ├── ProtectedRoute.jsx       # Route guard for authenticated users
│   │   │   ├── RescueMap.jsx            # Interactive Leaflet map component
│   │   │   └── RoleRoute.jsx            # Strict RBAC route guard (responder/admin)
│   │   ├── context/
│   │   │   └── AuthContext.jsx          # JWT storage, role state, and login/logout handlers
│   │   ├── pages/
│   │   │   ├── HomeDashboard.jsx        # Public Command Hub, live ticker & first aid guide
│   │   │   ├── Dashboard.jsx            # Member workspace and role dispatcher
│   │   │   ├── ReportRescue.jsx         # Emergency SOS form with GPS capture
│   │   │   ├── MyRescues.jsx            # Citizen incident tracker with animated timeline
│   │   │   ├── RescuerDashboard.jsx     # Responder terminal with Haversine distance
│   │   │   ├── CaseDetails.jsx          # Deep case dossier, Leaflet map & activity feed
│   │   │   ├── AdminDashboard.jsx       # System KPIs and platform audit logs
│   │   │   ├── Notifications.jsx        # Dedicated notification archive inbox
│   │   │   ├── Login.jsx                # Standalone login page
│   │   │   └── Register.jsx             # Standalone registration page
│   │   ├── services/
│   │   │   └── api.js                   # Axios client with automatic Bearer token interceptor
│   │   ├── utils/
│   │   │   └── haversine.js             # Spherical geometry distance calculation
│   │   ├── App.jsx                      # Router declarations & layout wrappers
│   │   ├── index.css                    # Design system, mesh backgrounds & keyframe animations
│   │   └── main.jsx                     # Vite DOM entry point
│   ├── tailwind.config.js               # Tailwind design tokens and responsive breakpoints
│   └── package.json
│
├── server/                              # Node.js + Express REST API Backend
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                    # MongoDB Atlas connection + Google DNS resolver
│   │   ├── controllers/
│   │   │   ├── authController.js        # Register, login, and profile validation
│   │   │   ├── rescueController.js      # CRUD, Haversine matching, status mutation
│   │   │   ├── activityController.js    # Chronological case activity logging
│   │   │   └── adminController.js       # Aggregated KPIs and audit log streaming
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js        # JWT token verification
│   │   │   ├── roleMiddleware.js        # RBAC role authorization check
│   │   │   └── uploadMiddleware.js      # Multer image upload parser
│   │   ├── models/
│   │   │   ├── User.js                  # User schema with bcrypt password hashing
│   │   │   ├── RescueCase.js            # Rescue schema with GPS coordinates and priority
│   │   │   ├── CaseActivity.js          # Activity timeline schema
│   │   │   └── Notification.js          # Notification schema
│   │   ├── routes/
│   │   │   ├── authRoutes.js            # /api/auth endpoints
│   │   │   ├── rescueRoutes.js          # /api/rescues endpoints
│   │   │   ├── adminRoutes.js           # /api/admin endpoints
│   │   │   └── notificationRoutes.js    # /api/notifications endpoints
│   │   └── utils/
│   │       ├── seedUsers.js             # Demo database seeder
│   │       └── triage.js                # Algorithmic priority score calculations
│   ├── uploads/                         # Multipart uploaded evidence photos
│   ├── server.js                        # Express server entry point & middleware pipeline
│   ├── .env                             # Environment configuration secrets
│   └── package.json
│
├── PROJECT_FLOW.md                      # Exhaustive Architectural Deep Dive & Button-by-Button Catalog
└── README.md                            # Project Overview & Setup Documentation
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create new citizen account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return signed JWT |
| `GET` | `/api/auth/me` | Authenticated | Fetch active user session profile |
| `POST` | `/api/rescues` | Public / Auth | Report new emergency incident with photo |
| `GET` | `/api/rescues/my` | Authenticated | Retrieve incidents reported by active user |
| `GET` | `/api/rescues` | Responder / Admin | Retrieve full emergency triage queue |
| `GET` | `/api/rescues/:id` | Authenticated | Fetch case dossier, location, and assigned responder |
| `PATCH` | `/api/rescues/:id/status` | Responder / Admin | Mutate case status (`ACCEPTED`, `IN_PROGRESS`, `RESCUED`) |
| `POST` | `/api/rescues/:id/updates` | Responder / Admin | Post medical / progress note to case timeline |
| `POST` | `/api/rescues/:id/feedback` | Citizen | Submit rating and feedback on rescued animal |
| `GET` | `/api/rescues/:id/activities` | Authenticated | Retrieve full audit trail and activity log |
| `GET` | `/api/notifications` | Authenticated | Retrieve unread and read alerts |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | Authenticated | Mark all notifications as read |
| `GET` | `/api/admin/analytics` | Admin Only | Platform KPI metrics (case volume, recovery rates) |
| `GET` | `/api/admin/audit` | Admin Only | Forensic system audit log |
| `GET` | `/api/health` | Public | Service health & database connectivity check |

---

## 🔬 Architecture & System Flow

For an in-depth, loop-and-corner architectural explanation, refer to:
👉 **[`PROJECT_FLOW.md`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/PROJECT_FLOW.md)**

Inside you will find:
- **Section 3:** Detailed RBAC User Permissions Matrix
- **Section 5:** 10-State Rescue Case Lifecycle State Machine
- **Section 6:** Algorithmic Triage Formulas, Haversine Matching, and Automated Escalation
- **Section 10:** Complete Page-by-Page & Button-by-Button Interactive Catalog
- **Section 11:** Top-to-Bottom User Navigation Flowcharts

---

## 📄 License & Acknowledgments

This project is open-source under the **MIT License**. Developed as part of the **RescueLink Initiative** dedicated to tech-enabled civic animal welfare and emergency response coordination.
