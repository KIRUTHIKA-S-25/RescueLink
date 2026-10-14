# RescueLink — Server-Side Architecture & Codebase Reference (`server.md`)

RescueLink's backend is a production-grade RESTful API built on **Node.js** and **Express 4**, integrated with **MongoDB Atlas (Mongoose ODM)**, **Cloudinary Media Storage**, **Google Gemini AI**, and **JSON Web Tokens (JWT)**. It features an automated background escalation engine, atomic concurrency locks, geospatial dispatch algorithms, and automated audit logging.

---

## 1. Directory Tree Overview

```
server/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── activityController.js
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   ├── notificationController.js
│   │   └── rescueController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── rateLimitMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── uploadMiddleware.js
│   ├── models/
│   │   ├── AuditLog.js
│   │   ├── Notification.js
│   │   ├── RescueActivity.js
│   │   ├── RescueCase.js
│   │   ├── ResponderProfile.js
│   │   └── User.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── rescueRoutes.js
│   │   └── testRoutes.js
│   ├── services/
│   │   ├── chatService.js
│   │   ├── cloudinaryService.js
│   │   ├── duplicateDetectionService.js
│   │   ├── escalationService.js
│   │   └── notificationService.js
│   └── utils/
│       ├── apiResponse.js
│       ├── geoUtils.js
│       ├── seedNamedUsers.js
│       ├── seedUsers.js
│       └── triageUtils.js
├── app.js
├── server.js
├── package.json
├── .env
├── .env.example
├── test_e2e_full.js
├── testApiWorkflow.js
├── testPhases13to16.js
├── testTriageUtils.js
└── testWorkflows.js
```

---

## 2. Server Root Files & Entry Points

| File | Purpose | What It Contains & Does in the Project |
| :--- | :--- | :--- |
| **`server.js`** | Runtime entry point & process orchestrator | Initializes `dotenv`, connects to MongoDB via `connectDB()`, launches the background escalation worker (`startEscalationWorker(30000)`), starts the HTTP server on `PORT 5000`, and handles graceful process termination (`SIGINT`, `SIGTERM`). |
| **`app.js`** | Express application configuration | Sets up middleware (`cors`, `express.json()`, `express.urlencoded()`, `morgan`), mounts static uploads (`/uploads`), configures route rate limiters (`authLimiter`, `reportLimiter`, `chatLimiter`), mounts all API subrouters (`/api/auth`, `/api/rescues`, `/api/notifications`, `/api/admin`, `/api/chat`), and defines the global error-handling middleware. |
| **`package.json`** | Backend dependencies & scripts | Declares runtime dependencies (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`, `multer`, `cloudinary`, `morgan`, `express-async-errors`), development dependencies (`nodemon`), and scripts (`start`, `dev`). |
| **`.env` / `.env.example`** | Environment configuration | Stores credentials: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `ESCALATION_TIMEOUT_MS`, `CLIENT_URL`. |

---

## 3. `src/config/` Folder

### Purpose
Contains external connection configurations and client initializers.

### Files:
1. **`db.js`**:
   - **Purpose**: Establishes and manages the connection to MongoDB Atlas.
   - **What it Contains**:
     - Connects using `mongoose.connect(process.env.MONGODB_URI)` with auto-reconnect options.
     - Event listeners for `connected`, `error`, and `disconnected`.
     - Fails fast and terminates the process if the initial connection cannot be established, preventing broken server operations.

---

## 4. `src/models/` Folder

### Purpose
Contains Mongoose data schemas, model definitions, field validations, indexes, and custom schema methods.

### Files:
1. **`User.js`**:
   - **Purpose**: Citizen, Responder, and Administrator account records.
   - **What it Contains**:
     - Fields: `name`, `email` (unique, lowercase), `password` (bcrypt hashed), `phone`, `role` (`citizen`, `responder`, `admin`), `avatar`, `isActive`.
     - Methods: Password hashing pre-save hook (`bcrypt.hash`), and `comparePassword(candidatePassword)` method.
2. **`ResponderProfile.js`**:
   - **Purpose**: Professional field responder profile linked to a `User`.
   - **What it Contains**:
     - Fields: `user` (ref: User), `isVerified` (boolean), `vehicleType` (e.g. `Animal Ambulance Van`, `Bike`), `capacity` (max concurrent cases, default 3), `currentLoad` (active cases counter), `isOnDuty` (boolean), `lastLocation` (GeoJSON Point).
3. **`RescueCase.js`**:
   - **Purpose**: Core animal distress incident model.
   - **What it Contains**:
     - Fields: `caseId` (human-readable string e.g. `RC-1791922259517-UE8C`), `animalType` (Dog, Cat, Cattle, Bird, etc.), `conditionDescription`, `photos` (array of Cloudinary URLs), `locationAddress`, `location` (GeoJSON Point with 2dsphere index `[lng, lat]`), `priority` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `status` (`PENDING`, `ACCEPTED`, `IN_PROGRESS`, `RESCUED`, `CANCELLED`), `reportedBy` (ref: User), `assignedResponder` (ref: User), `isEscalated` (boolean), `resolutionNotes`, `handoverClinic`, `feedbackRating` (1-5), `feedbackComments`.
     - Static Method: `findByIdOrCaseId(idOrCaseId)` allowing polymorphic lookup by 24-character hex MongoDB `_id` or human-readable `caseId`.
4. **`RescueActivity.js`**:
   - **Purpose**: Chronological milestone audit trail for every rescue case.
   - **What it Contains**:
     - Fields: `rescueCase` (ref: RescueCase), `action` (e.g., `REPORTED`, `ACCEPTED`, `TRANSIT_STARTED`, `PROGRESS_NOTE`, `RESCUED`), `actor` (ref: User), `notes`, `metadata`, `createdAt`.
     - Drives the visual tracking milestone timeline in `CaseDetails.jsx`.
5. **`Notification.js`**:
   - **Purpose**: User alert notifications.
   - **What it Contains**:
     - Fields: `recipient` (ref: User), `title`, `message`, `type` (`DISPATCH`, `STATUS_CHANGE`, `ESCALATION`, `SYSTEM`), `link`, `isRead`, `createdAt`.
6. **`AuditLog.js`**:
   - **Purpose**: System-wide administrative security logging.
   - **What it Contains**:
     - Fields: `action` (e.g. `AUTH_LOGIN`, `CASE_CREATE`, `CASE_STATUS_CHANGE`), `actor` (ref: User), `ipAddress`, `userAgent`, `details`, `timestamp`.

---

## 5. `src/controllers/` Folder

### Purpose
Contains the core business logic handling incoming HTTP requests and generating API responses.

### Files:
1. **`authController.js`**:
   - **Purpose**: User registration, login, profile retrieval, and JWT issuance.
   - **Functions**:
     - `register()`: Validates input, prevents duplicate emails, hashes password, creates `User`, optionally creates `ResponderProfile`, generates JWT token.
     - `login()`: Authenticates credentials, generates token, logs audit event.
     - `getMe()`: Returns currently logged-in user profile with responder details if applicable.
2. **`rescueController.js`**:
   - **Purpose**: Incident reporting, dispatch matching, status lifecycles, and resolution.
   - **Functions**:
     - `createRescue()`: Scores urgency via Triage Urgency Scoring (TUS), checks for duplicates via `duplicateDetectionService`, uploads media to Cloudinary, creates `RescueCase` with unique `caseId`, logs activity milestone, notifies nearby responders.
     - `getRescues()`: Filterable listing by status, urgency, species, or geospatial proximity.
     - `getMyRescues()`: Retrieves cases reported by or assigned to the authenticated user.
     - `getRescueById()`: Fetches deep case details with populated references.
     - `updateRescueStatus()`: Manages status progression (`ACCEPTED` → `IN_PROGRESS` → `RESCUED`), performs atomic capacity checks on responders, records completion proofs, and updates responder load.
     - `submitFeedback()`: Records citizen satisfaction star rating and comments upon case resolution.
3. **`activityController.js`**:
   - **Purpose**: Milestone and timeline tracking for individual cases.
   - **Functions**:
     - `getActivitiesByCase()`: Fetches chronological history milestones for a given case ID.
     - `addActivityNote()`: Enables responders on scene to append operational progress notes.
4. **`adminController.js`**:
   - **Purpose**: Administrative dashboard analytics, KPIs, rescuer monitoring, and report exports.
   - **Functions**:
     - `getAnalytics()`: Computes total cases, resolution rate, average response time, species breakdowns, and geo-distributions.
     - `getRescuerPerformance()`: Lists all registered responders with active caseloads, completed counts, and verification status.
     - `getAuditLogs()`: Paginated list of security audit trail events.
     - `exportCsv()`: Generates and streams a CSV document of all rescue records.
     - `exportPdf()`: Formats and streams an executive PDF incident summary.
5. **`chatController.js`**:
   - **Purpose**: AI Chat Assistant interface endpoint.
   - **Functions**:
     - `handleChat()`: Receives citizen or responder queries, passes them to `chatService.processChatMessage()`, and returns the intelligent response with structured action buttons.
6. **`notificationController.js`**:
   - **Purpose**: Alert notification queries and read state updates.
   - **Functions**:
     - `getMyNotifications()`: Fetches recent notifications for the logged-in user.
     - `markAsRead()`: Marks an individual alert as read.
     - `markAllAsRead()`: Bulk marks all user alerts as read.

---

## 6. `src/services/` Folder

### Purpose
Houses modular business services and external third-party API integrations.

### Files:
1. **`chatService.js`**:
   - **Purpose**: Dual-engine AI chatbot powering the RescueLink assistant.
   - **What it Contains**:
     - Emergency keyword detection (`bleeding`, `hit by car`, `unconscious`, `fracture`) to display urgent warning banners.
     - Case ID pattern extraction (`extractCaseId`) to query live MongoDB records for 100% verified status truth.
     - Role-aware prompt grounding injecting verified DB context into Google Gemini LLM API (`gemini-3.1-flash-lite-preview`, `gemini-3.8-flash`).
     - Zero-hallucination deterministic fallback engine that runs if external AI APIs are offline or unreachable.
     - Automated action suggestion generator (e.g. *"View Case & History Details"*).
2. **`cloudinaryService.js`**:
   - **Purpose**: Cloud media storage and image optimization.
   - **What it Contains**:
     - Uploads incident and completion proof photos to Cloudinary using secure buffers.
     - Applies automatic image optimization, compression, and thumbnail generation.
     - Graceful local filesystem fallback (`/uploads`) if Cloudinary credentials are not configured.
3. **`duplicateDetectionService.js`**:
   - **Purpose**: Intelligent incident deduplication engine.
   - **What it Contains**:
     - Checks new reports against existing open incidents within 100 meters reported in the last 2 hours for the same animal category.
     - Prevents duplicate dispatches and warns citizens if an active rescue is already underway for that animal.
4. **`escalationService.js`**:
   - **Purpose**: Automated background SLA escalation engine.
   - **What it Contains**:
     - Runs a background worker checking for cases in `PENDING` state that exceed the timeout limit (default: 5 minutes, configurable via `ESCALATION_TIMEOUT_MS`).
     - Flags overdue cases as `isEscalated: true` and doubles the dispatch broadcast radius from 15 km to 30 km to reach regional response teams.
     - Sends escalation alerts to administrators and regional rescue units.
5. **`notificationService.js`**:
   - **Purpose**: Centralized alert delivery service.
   - **What it Contains**:
     - Creates database notification records (`Notification` model) for dispatch events, assignments, status transitions, and escalations.

---

## 7. `src/middleware/` Folder

### Purpose
Contains Express middleware functions executed before controllers to enforce authentication, authorization, rate limiting, and file parsing.

### Files:
1. **`authMiddleware.js`**:
   - **Purpose**: Verifies JWT bearer tokens.
   - **What it Does**: Extracts token from `Authorization: Bearer <token>`, verifies signature using `process.env.JWT_SECRET`, decodes `userId` and `role`, attaches user to `req.user`, and rejects invalid/expired tokens with `401 Unauthorized`.
2. **`roleMiddleware.js`**:
   - **Purpose**: Role-Based Access Control (RBAC) guard.
   - **What it Does**: Accepts allowed roles (e.g. `authorizeRoles('responder', 'admin')`). Compares `req.user.role` and throws `403 Forbidden` if unauthorized.
3. **`rateLimitMiddleware.js`**:
   - **Purpose**: In-memory IP rate limiter protecting against brute-force attacks and spam.
   - **What it Does**: Limits requests per IP within sliding time windows (applied on `/api/auth`, `/api/rescues`, `/api/chat`).
4. **`uploadMiddleware.js`**:
   - **Purpose**: Multi-part form data parser for image uploads.
   - **What it Does**: Configures `multer` with memory storage and 5MB size limit to intercept image uploads and pass buffer to `cloudinaryService`.

---

## 8. `src/utils/` Folder

### Purpose
Reusable algorithmic helpers, math calculations, response formatters, and seed data scripts.

### Files:
1. **`triageUtils.js`**:
   - **Purpose**: Triage Urgency Scoring (TUS) mathematical algorithm.
   - **What it Does**: Computes a numerical score based on animal species weights, condition severity factors, mobility status, environmental hazards, and age. Maps scores to SLA tiers:
     - Score ≥ 80: `CRITICAL` (15 min SLA)
     - Score 50–79: `HIGH` (30 min SLA)
     - Score 25–49: `MEDIUM` (2 hr SLA)
     - Score < 25: `LOW` (6 hr SLA)
2. **`geoUtils.js`**:
   - **Purpose**: Geospatial distance calculations and coordinate utilities.
   - **What it Does**: Implements Haversine spherical distance formula in kilometers and provides bounding box calculations for spatial proximity queries.
3. **`apiResponse.js`**:
   - **Purpose**: Consistent JSON response formatting standard.
   - **What it Does**: Exports `sendSuccess(res, data, message, statusCode)` and `sendError(res, message, statusCode, errors)` ensuring all API responses conform to `{ success, message, data, timestamp }`.
4. **`seedNamedUsers.js`**:
   - **Purpose**: Test persona seeder.
   - **What it Does**: Seeds designated test users into MongoDB Atlas:
     - **Kavin** (`citizen`): `kavin@rescuelink.dev` / `Kavin@123`
     - **Shavini** (`responder`): `shavini@rescuelink.dev` / `Shavini@123`
     - **Raksha** (`admin`): `raksha@rescuelink.dev` / `Raksha@123`
5. **`seedUsers.js`**:
   - **Purpose**: General development mock data generator for mass users and responder profiles.

---

## 9. Automated Testing Scripts in `server/`

| Test Script | Focus & Scope |
| :--- | :--- |
| **`test_e2e_full.js`** | **Comprehensive End-to-End System Audit (20 Scenarios)**: Tests Kavin, Shavini, and Raksha through full auth, incident creation, AI bot tracking with action buttons, atomic assignment lock, field notes, verified completion, 5-star feedback, and admin analytics/CSV/PDF exports. |
| **`testTriageUtils.js`** | Unit tests for the Triage Urgency Scoring algorithm verifying edge cases across species and distress factors. |
| **`testPhases13to16.js`** | Integration tests for the Gemini AI chatbot, security audit logging, and administrative CSV/PDF exports. |
| **`testApiWorkflow.js`** | REST API endpoint integration tests validating HTTP status codes and payloads. |
| **`testWorkflows.js`** | State transition validation testing valid and invalid rescue case status lifecycles. |
