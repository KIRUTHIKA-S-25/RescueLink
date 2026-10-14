# RescueLink — Backend Technology & Services Guide (`backend.md`)

This document provides a technical deep-dive into the backend technologies, cloud integrations, database architecture, and background service engines powering **RescueLink**.

---

## 1. Backend Technology Stack Overview

| Layer / Service | Technology Used | Version | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js | v20+ | Asynchronous event-driven execution runtime |
| **Web Application Framework** | Express.js | ^4.22.3 | RESTful routing, middleware pipelines, error handling |
| **Database & ODM** | MongoDB Atlas / Mongoose | ^9.10.2 | Document database with GeoJSON 2dsphere indexing & data modeling |
| **Cloud Media Storage** | Cloudinary SDK v2 | ^2.11.0 | Cloud hosting, optimization, and transformation of incident & resolution photos |
| **Generative AI Engine** | Google Gemini Generative AI | v1beta | Real-time animal triage guidance, natural query answers, and live database-grounded status responses |
| **Authentication & Tokens** | JSON Web Tokens (`jsonwebtoken`) & `bcryptjs` | ^9.0.3 / ^3.0.3 | Salted password hashing and stateless cryptographic token verification |
| **File Upload Handling** | Multer | ^2.4.0 | Multi-part form-data parsing into memory buffers |
| **Background Processing** | Custom Event Loop Timers | Native Node | Automated SLA escalation polling daemon (30s intervals) |
| **Logging & Monitoring** | Morgan & Custom Audit Logs | ^1.12.1 | HTTP request tracing and security audit trail persistence |

---

## 2. Database Architecture: MongoDB & Mongoose ODM

### Why MongoDB for RescueLink?
1. **Dynamic Incident Data**: Animal rescue cases have polymorphic attributes (different species, varying injury types, optional handover clinic details, multi-part evidence media). MongoDB's schema flexibility allows rich document storage without rigid table joins.
2. **Native Geospatial Capabilities**: MongoDB has built-in GeoJSON and `2dsphere` spatial indexes, enabling rapid proximity queries (e.g. finding rescuers or incidents within a given radius).
3. **High Write Throughput**: Emergency reports, live tracking milestones, and status transitions are written with low latency.

### Database Connection Resilience (`src/config/db.js`)
* **Connection Pooling**: Mongoose manages a pool of database connections to serve concurrent API requests.
* **Auto-Reconnect**: Listens to Mongoose events (`connected`, `error`, `disconnected`) to log connection health.
* **Fail-Fast Initialization**: If the database is unreachable on server startup, the process halts immediately with clear diagnostics to avoid serving half-broken traffic.

### Data Models & Schemas

```
┌────────────────┐          ┌────────────────┐
│      User      │◄───1:1───┤ResponderProfile│
└───────┬────────┘          └────────────────┘
        │
    1:N (Reported By / Assigned Responder)
        │
        ▼
┌────────────────┐          ┌────────────────┐
│   RescueCase   │◄───1:N───┤ RescueActivity │ (Milestones)
└───────┬────────┘          └────────────────┘
        │
    1:N (System Alerts)
        │
        ▼
┌────────────────┐          ┌────────────────┐
│  Notification  │          │    AuditLog    │ (Security Trail)
└────────────────┘          └────────────────┘
```

#### 1. `User` Schema
* **Fields**: `name`, `email` (unique, lowercase), `password` (bcrypt hashed), `phone`, `role` (`citizen` \| `responder` \| `admin`), `avatar`, `isActive`.
* **Hooks**: `pre('save')` automatically salts and hashes plain passwords using `bcrypt.hash(..., 10)`.
* **Methods**: `comparePassword(candidate)` for constant-time hash verification.

#### 2. `ResponderProfile` Schema
* **Fields**: `user` (ObjectId ref to User), `isVerified` (Boolean), `vehicleType` (e.g., *Animal Ambulance Van*), `capacity` (maximum concurrent active cases, default: 3), `currentLoad` (number of active cases currently in transit), `isOnDuty` (Boolean), `lastLocation` (GeoJSON Point).

#### 3. `RescueCase` Schema
* **Core Identifiers**: MongoDB `_id` (24-char hex) and `caseId` (human-readable string e.g., `RC-1791922259517-UE8C`).
* **Geospatial Location**: 
  ```javascript
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  }
  ```
  Indexed with `rescueCaseSchema.index({ location: '2dsphere' })`.
* **Polymorphic Lookup Method**:
  ```javascript
  rescueCaseSchema.statics.findByIdOrCaseId = function (identifier) {
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      return this.findOne({ $or: [{ _id: identifier }, { caseId: identifier }] });
    }
    return this.findOne({ caseId: identifier });
  };
  ```
  *This eliminates `CastError: Cast to ObjectId failed` when users or the AI bot pass human-readable IDs.*

#### 4. `RescueActivity` Schema
* Captures immutable milestones (`REPORTED`, `ACCEPTED`, `TRANSIT_STARTED`, `PROGRESS_NOTE`, `RESCUED`) to power the case timeline UI.

#### 5. `Notification` & `AuditLog` Schemas
* **`Notification`**: Real-time alerts for citizens and responders with read/unread states.
* **`AuditLog`**: Compliance tracking capturing IP address, user agent, actor ID, and security action.

---

## 3. Media Cloud Storage: Cloudinary

### Role in the Project
In animal distress emergencies, photographic evidence is vital:
* **Citizen Triage**: Allows responders to view the animal's wounds, size, and surroundings before departing.
* **Resolution Proof**: When responders mark a case as `RESCUED`, they upload completion photos and veterinary handover receipts as proof.

### Upload Flow Architecture
```
[Client / Browser]
       │
       │ (multipart/form-data)
       ▼
[Express Server + Multer MemoryStorage]
       │
       │ (Buffer Stream)
       ▼
[Cloudinary v2 API (cqiw2jt1)]
       │
       │ (Secure HTTPS CDN URL)
       ▼
[MongoDB RescueCase Record]
```

### Implementation Details (`src/services/cloudinaryService.js`)
* **SDK**: `cloudinary.v2`.
* **Zero-Disk Streaming**: Uploads are kept in RAM (`multer.memoryStorage()`) and streamed directly to Cloudinary using `cloudinary.uploader.upload_stream({ folder: 'rescuelink_cases' })`. This prevents local disk bloat on the server.
* **Transformations**: Generates optimized WebP/JPEG formats with responsive widths (`f_auto, q_auto`).
* **Offline Resiliency**: If Cloudinary credentials are not provided or the network is unavailable, the service automatically falls back to storing images in the local `uploads/` directory, ensuring zero failed reports.

---

## 4. Generative AI Engine: Google Gemini

### Role in RescueLink
RescueLink integrates Google Gemini via direct REST calls (`https://generativelanguage.googleapis.com/v1beta/models/...`) inside `src/services/chatService.js`.

### Dual-Engine Architecture
```
               [Incoming User Message]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
[Emergency Keyword Detector]     [Live Case ID Extractor]
            │                           │
            ▼                           ▼
 [Immediate Alert Banner]      [Verified DB Query (MongoDB)]
            │                           │
            └─────────────┬─────────────┘
                          │
          Is GEMINI_API_KEY Available?
                 ├─── YES ───► Model Fallback Chain:
                 │             1. gemini-3.1-flash-lite-preview
                 │             2. gemini-3.8-flash
                 │             3. gemini-3.1-pro-preview
                 │             4. gemini-flash-latest
                 │
                 └─── NO  ───► Deterministic Fallback Engine
                               (Zero-hallucination rule matcher)
```

### Safety & Grounding Guardrails
1. **Grounding in Real Data**: The model is provided with `Live Verified DB Context` in its system instructions. It is explicitly forbidden from hallucinating case statuses.
2. **Veterinary Medical Disclaimer**: Gemini is prompted to provide stabilizing first-aid techniques (pressure on bleeding, immobilization) while strictly warning:
   > *"Human medications like Paracetamol, Ibuprofen, and Diclofenac are LETHAL to dogs and cats. RescueLink is an emergency coordination network, not a substitute for licensed veterinary medical treatment."*
3. **Emergency Interceptor**: If words like `bleeding`, `hit by car`, or `unconscious` are detected, an immediate red banner is injected urging the user to submit an instant emergency report rather than wait for chat replies.
4. **Interactive Action Navigation**: The chatbot automatically outputs structured action buttons (e.g. `[View Case & History Details](/rescues/RC-...)`).

---

## 5. Triage & Urgency Scoring (TUS) Engine

### Algorithm Mechanics (`src/utils/triageUtils.js`)
RescueLink implements an automated triage algorithm to prioritize life-threatening emergencies over minor incidents:

$$\text{TUS Score} = (\text{Base Species Weight}) + (\text{Injury Factors}) + (\text{Mobility Penalty}) + (\text{Hazard Multiplier})$$

* **Species Weights**: Wild animals and protected raptors receive higher coordination priority.
* **Injury Weights**: Heavy bleeding (+35), unconsciousness (+40), suspected fractures (+25).
* **Environmental Hazards**: Trapped in drain (+20), highway traffic risk (+25), severe weather (+15).

### Priority Tiers & Dispatch SLAs
| Score Range | Priority Tier | Color Badge | Dispatch SLA | Escalation Window |
| :--- | :--- | :--- | :--- | :--- |
| **80 – 100** | `CRITICAL` | Neon Red | **15 Minutes** | 5 Minutes |
| **50 – 79** | `HIGH` | Amber Orange | **30 Minutes** | 10 Minutes |
| **25 – 49** | `MEDIUM` | Yellow | **2 Hours** | 30 Minutes |
| **0 – 24** | `LOW` | Emerald Green | **6 Hours** | 2 Hours |

---

## 6. Geospatial Dispatch & Incident Deduplication

### Geospatial Proximity Matching (`src/utils/geoUtils.js`)
* Uses the **Haversine formula** to calculate great-circle distances:
  $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
* **Initial Dispatch Radius**: Automatically alerts all on-duty responders within **15 km**.
* **Escalation Radius**: If an incident is unassigned after the SLA timeout, the radius expands to **30 km** for regional backup.

### Duplicate Detection Engine (`src/services/duplicateDetectionService.js`)
To prevent multiple citizens from triggering separate rescue teams for the same injured animal on a busy road:
* When a report is filed, the system searches for existing open cases where:
  1. `animalType` matches.
  2. Distance is within **100 meters** (`$near` GeoJSON query).
  3. Created within the last **2 hours**.
* If a match is detected, the report links to the active incident and alerts the user that a rescue team has already been notified.

---

## 7. Background SLA Escalation Engine (`src/services/escalationService.js`)

RescueLink does not rely on manual administrative checks to escalate neglected cases. A background worker runs continuously in `server.js`:

1. **Polling Frequency**: Checks MongoDB every **30 seconds** (`startEscalationWorker(30000)`).
2. **Criteria**: Finds cases where `status === 'PENDING'`, `isEscalated === false`, and `createdAt < Date.now() - ESCALATION_TIMEOUT_MS`.
3. **Actions Executed**:
   * Sets `isEscalated: true` on the `RescueCase`.
   * Creates an escalation activity milestone in `RescueActivity`.
   * Expands broadcast radius from 15 km to 30 km.
   * Dispatches high-priority notifications to regional rescue managers and administrators.
4. **Graceful Shutdown**: On `SIGINT`/`SIGTERM`, `stopEscalationWorker()` cleanly clears the active timer interval.

---

## 8. Security & Access Control (RBAC)

### Authentication & Passwords
* **Password Encryption**: Bcrypt with 10 salt rounds.
* **Token Issuance**: JWT signed with HMAC-SHA256 containing `{ userId, role }`. Expired after 7 days (`JWT_EXPIRES_IN=7d`).

### Role-Based Access Control Matrix
| Feature / Route | Guest / Visitor | Citizen | Responder | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Landing & Emergency Guide** | ✅ | ✅ | ✅ | ✅ |
| **Report Emergency Animal** | ✅ | ✅ | ✅ | ✅ |
| **AI First-Aid Chat** | ✅ | ✅ | ✅ | ✅ |
| **My Rescues & Case Timeline** | ❌ | ✅ | ✅ | ✅ |
| **Accept Incident & Transit** | ❌ | ❌ | ✅ | ✅ |
| **Rescuer Concurrency Check** | ❌ | ❌ | ✅ (Max 3) | ✅ |
| **Mark Rescued with Proof** | ❌ | ❌ | ✅ | ✅ |
| **Admin Analytics & KPIs** | ❌ | ❌ | ❌ | ✅ |
| **Security Audit Logs** | ❌ | ❌ | ❌ | ✅ |
| **CSV / PDF Data Export** | ❌ | ❌ | ❌ | ✅ |

### Brute-Force & Abuse Protection (`src/middleware/rateLimitMiddleware.js`)
* Generous in-memory rate limiters protecting against denial-of-service and brute-force attacks:
  * `/api/auth`: 60 requests / minute per IP
  * `/api/rescues`: 40 requests / minute per IP
  * `/api/chat`: 60 requests / minute per IP

---

## 9. Environment Configuration Matrix

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `PORT` | Local HTTP server port | `5000` |
| `NODE_ENV` | Runtime environment mode | `development` or `production` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/rescuelink` |
| `JWT_SECRET` | Cryptographic secret for signing tokens | High-entropy string (e.g. 64 random characters) |
| `JWT_EXPIRES_IN` | Token validity lifespan | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `cqiw2jt1` |
| `CLOUDINARY_API_KEY` | Cloudinary access API key | 15-digit numeric key |
| `CLOUDINARY_API_SECRET` | Cloudinary secure signing secret | Alphanumeric secret |
| `GEMINI_API_KEY` | Google Gemini Generative AI API key | `AQ.Ab8RN6KElpQQ7...` |
| `ESCALATION_TIMEOUT_MS` | Auto-escalation window in milliseconds | `300000` (5 mins) / `30000` for demo |
| `CLIENT_URL` | Allowed origin for Cross-Origin Resource Sharing | `http://localhost:5173` |
