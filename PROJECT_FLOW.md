# RescueLink — Complete System Flow & Architectural Deep Dive

> **An Exhaustive, Loop-and-Corner Guide to RescueLink**  
> *Intelligent Animal Rescue Coordination and Case Management System*

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [High-Level Architectural Topology](#2-high-level-architectural-topology)
3. [User Roles & Permissions Matrix (RBAC)](#3-user-roles--permissions-matrix-rbac)
4. [Data Models & Schema Relationships](#4-data-models--schema-relationships)
5. [The End-to-End Rescue Case State Machine](#5-the-end-to-end-rescue-case-state-machine)
6. [Detailed Workflow Loops (Corner-by-Corner)](#6-detailed-workflow-loops-corner-by-corner)
   - [Loop A: Incident Ingestion (Public & Authenticated)](#loop-a-incident-ingestion-public--authenticated)
   - [Loop B: Priority Scoring & Triage Calculation](#loop-b-priority-scoring--triage-calculation)
   - [Loop C: Geospatial Matching & Haversine Dispatch](#loop-c-geospatial-matching--haversine-dispatch)
   - [Loop D: Responder Field Action & Live Progression](#loop-d-responder-field-action--live-progression)
   - [Loop E: Medical Verification, Proof, and Closure](#loop-e-medical-verification-proof-and-closure)
   - [Loop F: Automated Escalation & Timeout Safeguards](#loop-f-automated-escalation--timeout-safeguards)
   - [Loop G: Duplicate Incident Detection](#loop-g-duplicate-incident-detection)
7. [Authentication & Session Lifecycle](#7-authentication--session-lifecycle)
8. [Edge Cases, Error Recovery, and Failure Modes](#8-edge-cases-error-recovery-and-failure-modes)
9. [API Route Reference Matrix](#9-api-route-reference-matrix)
10. [Exhaustive Page-by-Page & Button-by-Button Catalog](#10-exhaustive-page-by-page--button-by-button-catalog)
    - [10.1 Public Operations Hub & Landing (`/`)](#101-public-operations-hub--landing-)
    - [10.2 Global Authentication Modal (`AuthModal.jsx`)](#102-global-authentication-modal-authmodaljsx)
    - [10.3 Standalone Login (`/login`) & Register (`/register`)](#103-standalone-login-login--register-register)
    - [10.4 Emergency Rescue SOS Form (`/report`)](#104-emergency-rescue-sos-form-report)
    - [10.5 Member Portal & Role Dispatcher (`/dashboard`)](#105-member-portal--role-dispatcher-dashboard)
    - [10.6 Citizen Case Tracking (`/my-rescues`)](#106-citizen-case-tracking-my-rescues)
    - [10.7 Responder Operations Terminal (`/rescuer`)](#107-responder-operations-terminal-rescuer)
    - [10.8 Case Details, Map & Live Timeline (`/rescues/:id`)](#108-case-details-map--live-timeline-rescuesid)
    - [10.9 System Command Hub (`/admin`)](#109-system-command-hub-admin)
    - [10.10 Notifications Inbox (`/notifications`) & Bell Dropdown](#1010-notifications-inbox-notifications--bell-dropdown)
11. [Top-to-Bottom User Navigation Flows & State Diagrams](#11-top-to-bottom-user-navigation-flows--state-diagrams)
    - [Flow 1: Guest / Citizen Emergency SOS Reporting Flow](#flow-1-guest--citizen-emergency-sos-reporting-flow)
    - [Flow 2: Responder On-Duty Acceptance & Rescue Verification Flow](#flow-2-responder-on-duty-acceptance--rescue-verification-flow)
    - [Flow 3: Citizen Real-Time Tracking & Resolution Feedback Flow](#flow-3-citizen-real-time-tracking--resolution-feedback-flow)
    - [Flow 4: Administrator Audit & Network Oversight Flow](#flow-4-administrator-audit--network-oversight-flow)

---

---

## 1. Executive Summary & Core Philosophy

In traditional animal rescue, reports are chaotic: WhatsApp messages, phone calls with vague directions, no triage scoring, and untracked volunteers. 

**RescueLink** transforms animal emergency management into an intelligent, auditable dispatch engine:
1. **Low Friction Reporting:** Citizens can report without forced login—saving critical minutes.
2. **Deterministic Triage:** Mathematical urgency weighting instead of subjective guessing.
3. **Geospatial Precision:** Auto-captures latitude and longitude via browser GPS or interactive map pinpointing.
4. **Workload-Aware Dispatch:** Matches the closest available responder using the Haversine formula.
5. **Auditable Verification:** Proof of rescue (photos, notes, timestamps) is mandatory before closing an emergency case.

---

## 2. High-Level Architectural Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          CITIZEN / RESPONDER / ADMIN         │
                  │       (Web Browser / Mobile Viewport)        │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │             REACT + VITE CLIENT              │
                  │    • React Router v7   • Tailwind CSS        │
                  │    • Leaflet Maps      • AuthContext         │
                  │    • Axios Interceptor • Responsive Modals   │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTP REST (/api/*)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │            NODE.JS + EXPRESS API             │
                  │  ┌────────────────────────────────────────┐  │
                  │  │ Auth Middleware (JWT Verification)     │  │
                  │  ├────────────────────────────────────────┤  │
                  │  │ RBAC Middleware (Citizen/Resp/Admin)   │  │
                  │  ├────────────────────────────────────────┤  │
                  │  │ Multer File Upload Handler             │  │
                  │  ├────────────────────────────────────────┤  │
                  │  │ Triage & Haversine Dispatch Controller │  │
                  │  └────────────────────────────────────────┘  │
                  └──────────────┬───────────────────────────────┘
                                 │ Mongoose ODM (TLS / SRV)
                                 ▼
                  ┌──────────────────────────────────────────────┐
                  │             MONGODB ATLAS CLOUD              │
                  │  • users               • rescue_cases        │
                  │  • responder_profiles  • notifications       │
                  │  • case_activities     • audit_logs          │
                  └──────────────────────────────────────────────┘
```

---

## 3. User Roles & Permissions Matrix (RBAC)

RescueLink enforces strict Role-Based Access Control via [authMiddleware.js](file:///server/src/middleware/authMiddleware.js) and [roleMiddleware.js](file:///server/src/middleware/roleMiddleware.js).

| Capability | Guest / Public | Citizen | Responder | Admin |
|---|:---:|:---:|:---:|:---:|
| Browse Public Operations Hub (`/`) | ✅ | ✅ | ✅ | ✅ |
| View Emergency First-Aid Protocols | ✅ | ✅ | ✅ | ✅ |
| File Emergency SOS (`/report`) | ✅ *(Guest Mode)* | ✅ *(Tracked)* | ✅ | ✅ |
| View Own Submissions (`/my-rescues`) | ❌ | ✅ | ✅ | ✅ |
| View Single Case Details (`/rescues/:id`) | ✅ *(Read-Only)* | ✅ | ✅ | ✅ |
| Accept Rescue Dispatch (`/rescuer`) | ❌ | ❌ | ✅ | ✅ |
| Update Status & Upload Rescue Proof | ❌ | ❌ | ✅ *(Assigned only)* | ✅ |
| Submit Citizen Feedback & Rating | ❌ | ✅ *(Reporter only)* | ❌ | ❌ |
| System Analytics & User Moderation | ❌ | ❌ | ❌ | ✅ |

---

## 4. Data Models & Schema Relationships

### 1. `User` Schema
- `_id`: ObjectId (UUID)
- `name`: String (required)
- `email`: String (unique, indexed)
- `password`: String (bcrypt hashed, `select: false`)
- `phone`: String (optional)
- `role`: Enum `['citizen', 'responder', 'admin']` (default: `'citizen'`)
- `isActive`: Boolean (default: `true`)
- `timestamps`: CreatedAt, UpdatedAt

### 2. `RescueCase` Schema
- `_id`: ObjectId
- `caseNumber`: String (e.g. `RL-2026-0042`)
- `reportedBy`: ObjectId → `User` (null if guest)
- `guestContact`: `{ name, phone, email }`
- `animalType`: Enum `['dog', 'cat', 'cattle', 'bird', 'wildlife', 'other']`
- `condition`: String (e.g., `'Fracture'`, `'Hit & Run'`, `'Dehydration'`)
- `urgency`: Enum `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
- `location`:
  - `type`: `'Point'` (GeoJSON)
  - `coordinates`: `[longitude, latitude]`
  - `address`: Human-readable landmark string
- `imageUrl`: Public photo URL
- `status`: Enum (State machine below)
- `assignedResponder`: ObjectId → `User`
- `assignedAt`: Date
- `rescuedAt`: Date
- `closedAt`: Date
- `notes`: Array of responder field updates

### 3. `ResponderProfile` Schema
- `user`: ObjectId → `User` (1-to-1)
- `isAvailable`: Boolean (Toggle for live dispatch queue)
- `currentLocation`: `[longitude, latitude]` (Updated via ping)
- `activeCasesCount`: Number (Workload ceiling check)
- `specializations`: Array of animal types handled

### 4. `Notification` Schema
- `recipient`: ObjectId → `User`
- `case`: ObjectId → `RescueCase`
- `type`: Enum `['CASE_ASSIGNED', 'STATUS_CHANGE', 'ESCALATION', 'FEEDBACK']`
- `message`: String
- `isRead`: Boolean

---

## 5. The End-to-End Rescue Case State Machine

A rescue incident progresses through strict state transitions:

```
[Incident Reported]
        │
        ▼
   ┌─────────┐
   │ PENDING │ ◄── Citizen files case; priority calculated
   └────┬────┘
        │
        ├────────────────────────────┐
        ▼ (Timeout / No Responders)  ▼ (Responder accepts)
  ┌───────────┐                 ┌──────────┐
  │ ESCALATED │                 │ ACCEPTED │
  └─────┬─────┘                 └────┬─────┘
        │                            │
        │ (Admin manual dispatch)    ▼ (Leaves base)
        │                       ┌─────────────┐
        └──────────────────────►│ IN_PROGRESS │ (En-route / On-scene)
                                └──────┬──────┘
                                       │
                                       ▼ (Animal secured & stabilized)
                                 ┌─────────┐
                                 │ RESCUED │
                                 └────┬────┘
                                      │
                                      ▼ (Vet verification / Proof uploaded)
                                  ┌────────┐
                                  │ CLOSED │
                                  └────────┘
```

---

## 6. Detailed Workflow Loops (Corner-by-Corner)

### Loop A: Incident Ingestion (Public & Authenticated)
1. **Trigger:** Citizen navigates to `/report`.
2. **GPS Acquisition:** The browser requests `navigator.geolocation.getCurrentPosition()`.
   - *If granted:* Coordinates are pinned on the interactive Leaflet map.
   - *If denied:* Citizen clicks anywhere on the Leaflet map to drop an exact pinpoint.
3. **Media Intake:** Citizen selects a photo of the animal (handled by `multer` memory storage).
4. **Auth Check:**
   - *If JWT exists in `localStorage`:* Backend attaches `req.user._id` to `reportedBy`.
   - *If Guest:* Citizen provides phone/name, stored in `guestContact`.
5. **Database Write:** Record saved in MongoDB Atlas with initial status `PENDING`.

---

### Loop B: Priority Scoring & Triage Calculation
Before notifying responders, the system calculates the **Triage Urgency Score (TUS)**:

$$\text{TUS} = W_{\text{animal}} + W_{\text{condition}} + W_{\text{location\_risk}}$$

1. **Animal Factor ($W_{\text{animal}}$):**
   - Endangered/Raptor/Wildlife: $+25$
   - Domestic (Dog/Cat/Cattle): $+15$
2. **Condition Factor ($W_{\text{condition}}$):**
   - Active arterial bleeding / Severe trauma / Hit-and-run: $+40$
   - Entrapped in drain / Highway median: $+30$
   - Starvation / Minor wound / Skin ailment: $+10$
3. **Resulting Classification:**
   - $\text{TUS} \ge 70 \implies \mathbf{CRITICAL}$ (Red)
   - $50 \le \text{TUS} < 70 \implies \mathbf{HIGH}$ (Orange)
   - $30 \le \text{TUS} < 50 \implies \mathbf{MEDIUM}$ (Yellow)
   - $\text{TUS} < 30 \implies \mathbf{LOW}$ (Green)

---

### Loop C: Geospatial Matching & Haversine Dispatch
Once priority is scored, the dispatch engine identifies eligible responders:
1. **Query Criteria:**
   - Role = `'responder'`
   - `isAvailable == true`
   - `activeCasesCount < MAX_CAPACITY (3)`
2. **Distance Calculation:**
   The backend applies the **Haversine Formula** over the coordinates:
   $$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
   Where $R = 6371\text{ km}$ (Earth radius).
3. **Dispatch Priority:** Sorted by ascending distance. Responders within a $15\text{ km}$ radius receive an immediate push dispatch notification.

---

### Loop D: Responder Field Action & Live Progression
1. Responder logs in via `/rescuer` or quick demo credentials.
2. The terminal lists pending cases ordered by urgency and proximity.
3. Responder clicks **Accept Case**:
   - Status changes from `PENDING` $\to$ `ACCEPTED`.
   - `assignedResponder` is locked to responder's ID.
   - `activeCasesCount` increments.
   - Reporter receives an automated alert: *"Responder [Name] has accepted your rescue request."*
4. Responder clicks **Depart to Scene**:
   - Status transitions to `IN_PROGRESS`.
   - GPS navigation link opens with direct directions to the animal.

---

### Loop E: Medical Verification, Proof, and Closure
1. Responder secures animal on-site and stabilizes injuries.
2. Responder uploads **Proof of Rescue** (Photo of secured animal, veterinary intake certificate, and field notes).
3. Status transitions to `RESCUED`.
4. Citizen receives a verification update with photo proof.
5. Case transitions to `CLOSED` after admin/coordinator confirmation.

---

### Loop F: Automated Escalation & Timeout Safeguards
*Corner Case: What happens if an emergency occurs at 2 AM and no responder accepts?*
1. Every `PENDING` case initializes an escalation timer (`ESCALATION_TIMEOUT_MS = 300,000` ms / 5 minutes).
2. If `status == 'PENDING'` when timer expires:
   - Status automatically mutates to `ESCALATED`.
   - High-priority notifications are sent to all System Administrators.
   - Secondary volunteer emergency shelters are broadcasted.

---

### Loop G: Duplicate Incident Detection
*Corner Case: Three citizens report the same injured stray dog on the same street.*
1. On each new submission, the engine checks for cases within:
   - **Radial proximity:** $< 100\text{ meters}$
   - **Temporal window:** $< 45\text{ minutes}$
   - **Animal category:** Matches (e.g., both `'dog'`)
2. If matched:
   - The new report is linked as a *Corroborating Report* under the primary case.
   - Prevents dispatching three separate ambulances to the same dog.

---

## 7. Authentication & Session Lifecycle

1. **Registration:**
   - POST `/api/auth/register` creates user with bcrypt-hashed password (cost factor 10).
2. **Login:**
   - POST `/api/auth/login` validates credentials and signs JWT:
     ```json
     { "id": "userId", "role": "citizen|responder|admin", "iat": 1728660000, "exp": 1729264800 }
     ```
3. **Storage & Interceptor:**
   - Stored in browser `localStorage` as `rescuelink_token`.
   - Client Axios interceptor in [api.js](file:///client/src/services/api.js) automatically injects:
     `Authorization: Bearer <token>` into all outbound HTTP requests.
4. **Token Expiration / 401 Handling:**
   - If server returns `401 Unauthorized`, response interceptor cleans `localStorage` and gracefully directs user to login or guest flow.

---

## 8. Edge Cases, Error Recovery, and Failure Modes

| Edge Case | Failure Mode | RescueLink Safeguard |
|---|---|---|
| **No GPS on User Device** | `geolocation.getCurrentPosition()` errors out | Interactive Leaflet fallback allows manual map clicking to pinpoint coordinates. |
| **Network Outage During Upload** | File upload drops mid-transit | Multipart upload validation with error rollbacks and client retry indicators. |
| **MongoDB Atlas SRV Lookup Block** | Campus/mobile ISP blocks DNS SRV | [db.js](file:///server/src/config/db.js) forces Google DNS (`8.8.8.8`, `8.8.4.4`) overrides at runtime. |
| **Responder Drops Out** | Vehicle breakdown or emergency | Responder can click *"Release Case"*, automatically returning case to `PENDING` queue. |
| **IP Whitelist Mismatch** | MongoDB rejects with SSL Alert 80 | Network access configured with `0.0.0.0/0` in Atlas dashboard. |

---

## 9. API Route Reference Matrix

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Public registration (Citizen)
- `POST /api/auth/login` — Public credentials exchange $\to$ JWT
- `GET  /api/auth/me` — Protected session restore

### Rescues (`/api/rescues`)
- `POST  /api/rescues` — Public/Auth incident submission
- `GET   /api/rescues/my` — Authenticated user's submitted incidents
- `GET   /api/rescues` — Responder/Admin queue of all cases
- `GET   /api/rescues/:id` — Case detailed timeline and location
- `PATCH /api/rescues/:id/status` — Responder status mutation
- `POST  /api/rescues/:id/updates` — Progress notes and medical log
- `POST  /api/rescues/:id/feedback` — Citizen resolution feedback

### System Health (`/api/health`)
- `GET /api/health` — Microservice uptime and database ping

---

## 10. Exhaustive Page-by-Page & Button-by-Button Catalog

This section covers every page, modal, form input, and interactive button in RescueLink, explaining its exact UI location, triggers, system actions, and downstream navigation.

---

### 10.1 Public Operations Hub & Landing (`/`)
*Component: [`HomeDashboard.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/HomeDashboard.jsx)*  
The initial public gateway designed for instantaneous incident reporting without requiring authentication.

#### Header Navigation Bar (Top)
| UI Element / Button | Type | Visual Style | Trigger / Action | Navigation / Target |
|---|---|---|---|---|
| **RescueLink Logo & Paw Icon** | `<Link>` | Gradient Paw badge with green active pulse | Returns user to page top (`#`) | `/` |
| **Emergency SOS** | Anchor `<a>` | Ghost nav link | Smooth scrolls viewport to `#emergency` Hero | In-page `#emergency` |
| **Live Feed** | Anchor `<a>` | Ghost nav link | Smooth scrolls viewport to `#live-feed` ticker | In-page `#live-feed` |
| **First Aid** | Anchor `<a>` | Ghost nav link | Smooth scrolls viewport to `#first-aid` interactive guide | In-page `#first-aid` |
| **How It Works** | Anchor `<a>` | Ghost nav link | Smooth scrolls viewport to `#how-it-works` cards | In-page `#how-it-works` |
| **Sign In** *(when guest)* | `<button>` | Ghost text button | Opens `AuthModal` in `login` mode | Modal overlay (`AuthModal`) |
| **Create Account →** *(when guest)* | `<button>` | Rose gradient button with shadow | Opens `AuthModal` in `register` mode | Modal overlay (`AuthModal`) |
| **My Portal (`[role]`)** *(when logged in)* | `<Link>` | Dark slate badge | Resolves role and redirects to portal | `/dashboard` (citizen), `/rescuer` (responder), `/admin` (admin) |
| **Logout** *(when logged in)* | `<button>` | Light gray ghost button | Clears `localStorage` token, resets AuthContext | Stays on `/` as guest |
| **Mobile Hamburger Toggle** | `<button>` | 3-bar animated hamburger | Toggles responsive slide-down menu on mobile screens | Opens mobile nav drawer |

#### Hero Section (`#emergency`)
| UI Element / Button | Type | Visual Style | Trigger / Action | Navigation / Target |
|---|---|---|---|---|
| **🚨 Report Animal in Distress** | `<Link>` | Large crimson button with "No Login Needed" pill | Direct entry to zero-friction reporting form | `/report` |
| **🔐 Responder / Citizen Sign In** *(guest)* | `<button>` | Glassmorphic white button with lock icon | Opens unified `AuthModal` | Modal overlay |
| **Open [ROLE] Dashboard →** *(logged in)* | `<Link>` | Slate button with role name | Navigates directly into user terminal | `/dashboard`, `/rescuer`, or `/admin` |
| **National Animal Helpline (1962)** | `<a>` | Direct `tel:1962` link | Triggers device telephony/dialer app | `tel:1962` |
| **Interactive KPI Counter Cards** | Display | Animated glass cards | Intersection observer counts up rescued animal stats | Read-only |

#### Live Incident Ticker Section (`#live-feed`)
| UI Element / Button | Type | Visual Style | Trigger / Action | Navigation / Target |
|---|---|---|---|---|
| **+ File New Report** | `<Link>` | Crimson small button | Starts new incident dispatch | `/report` |
| **Rescuer Log In** *(guest)* | `<button>` | Slate outline button | Triggers auth modal for field responders | Modal overlay |
| **Incident Case Cards** | Card | Status-colored border pills | Displays real-time urgency, location, status | Visual feed |

#### Interactive First-Aid & Triage Section (`#first-aid`)
| UI Element / Button | Type | Visual Style | Trigger / Action | Navigation / Target |
|---|---|---|---|---|
| **Animal Category Tabs** *(Dogs, Cats, Cattle, Birds, Wildlife)* | `<button>` | Icon tab pills with active highlight | Switches active triage advice, emergency instructions & helpline | In-page state change |
| **Emergency Hotline Dial Link** | `<a>` | Category-specific phone number | Opens phone dialer for specialized wildlife/avian trauma centers | Native phone dialer |

#### Footer (Bottom)
| UI Element / Button | Type | Visual Style | Trigger / Action | Navigation / Target |
|---|---|---|---|---|
| **Report Emergency Footer Link** | `<Link>` | Crimson text link | Jumps to report form | `/report` |
| **Volunteer Login Link** | `<button>` | Text button | Opens `AuthModal` in login mode | Modal overlay |
| **First Aid Guide Footer Link** | `<a>` | Text link | Scrolls to `#first-aid` | In-page `#first-aid` |

---

### 10.2 Global Authentication Modal (`AuthModal.jsx`)
*Component: [`AuthModal.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/components/AuthModal.jsx)*  
Unified modal overlay accessible from any screen without full page reloads.

| UI Element / Button | Type | Trigger / Action | Downstream Navigation |
|---|---|---|---|
| **Backdrop Click / Escape Key** | Overlay | Closes modal | Returns to background page |
| **✕ (Close Button)** | `<button>` | Closes modal | Returns to background page |
| **Quick Demo Fill: Citizen** | `<button>` | Injects `citizen@rescuelink.dev`, logs in automatically | Closes modal $\to$ Navigates to `/dashboard` |
| **Quick Demo Fill: Responder** | `<button>` | Injects `responder@rescuelink.dev`, logs in automatically | Closes modal $\to$ Navigates to `/rescuer` |
| **Quick Demo Fill: Admin** | `<button>` | Injects `admin@rescuelink.dev`, logs in automatically | Closes modal $\to$ Navigates to `/admin` |
| **Tab: Sign In** | `<button>` | Switches mode to credential login | Stays in modal |
| **Tab: Create Account** | `<button>` | Switches mode to registration form | Stays in modal |
| **Show/Hide Password (Eye icon)** | `<button>` | Toggles input type between `text` and `password` | Form interaction |
| **Sign In Button (`type="submit"`)** | `<button>` | Dispatches `POST /api/auth/login`; stores JWT | Redirects based on role (`/dashboard`, `/rescuer`, or `/admin`) |
| **Create Account Button (`type="submit"`)** | `<button>` | Dispatches `POST /api/auth/register`, then auto-logins | Redirects to `/dashboard` |

---

### 10.3 Standalone Login (`/login`) & Register (`/register`)
*Components: [`Login.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/Login.jsx) & [`Register.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/Register.jsx)*

| UI Element / Button | Page | Action | Downstream Navigation |
|---|---|---|---|
| **← Back to Operations Hub** | `/login` & `/register` | Returns user to homepage | `/` |
| **Demo Citizen / Responder / Admin** | `/login` | 1-click test credentials sign-in | Role-specific landing |
| **Sign In Button** | `/login` | Validates email/password via REST API | Redirects to `/dashboard` or `/rescuer` |
| **Don't have an account? Sign up** | `/login` | Switches to registration view | `/register` |
| **Create Account Button** | `/register` | Submits full profile (name, email, phone, password) | `/dashboard` |
| **Already have an account? Log in** | `/register` | Switches to login view | `/login` |

---

### 10.4 Emergency Rescue SOS Form (`/report`)
*Component: [`ReportRescue.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/ReportRescue.jsx)*  
The core incident intake form allowing photo attachment, auto-geolocation, and urgency selection.

#### Form Controls & Buttons
| UI Element / Button | Location | Action | Downstream Result |
|---|---|---|---|
| **RescueLink Paw Logo** | Top Nav | Home navigation | `/` (guest) or `/dashboard` (logged in) |
| **← Dashboard / Login Link** | Top Nav | Navigates back depending on auth status | `/dashboard` or `/login` |
| **Reporter Name Input** | Form Body | Auto-filled if logged in; editable | Ingested into submission payload |
| **Contact Number Input** | Form Body | Auto-filled with phone if logged in; validates phone | Essential callback number for rescuer |
| **Animal Type Dropdown** | Form Body | Selects Dog, Cat, Bird, Cow, Horse, Other | Categorizes triage and equipment dispatch |
| **Emergency Type Dropdown** | Form Body | Selects Injured, Trapped, Abandoned, Accident, Sick | Weights urgency score |
| **Description Textarea** | Form Body | Captures context, symptoms, physical landmarks | Displayed to responder in field queue |
| **📍 Use My Current Location** | Form Body | Requests browser GPS via `navigator.geolocation` | Auto-populates `latitude` & `longitude` |
| **Location Address Input** | Form Body | Street name, landmark, or district | Fallback search string and map pin label |
| **Severity / Priority Dropdown** | Form Body | Sets CRITICAL, HIGH, MEDIUM, or LOW | Sets SLA response timer and triage queue rank |
| **Upload Animal Image (`<input type="file">`)**| Form Body | Accepts JPEG, PNG, WEBP via multipart FormData | Stored on server, linked via `imageUrl` |
| **🚨 Report Emergency (Submit Button)** | Form Bottom | Sends `POST /api/rescues` with FormData | Transitions to Success Screen |

#### Submission Success Screen (Post-Submit State)
| UI Element / Button | Action | Downstream Navigation |
|---|---|---|
| **Case ID & Details Card** | Displays generated Case ID (e.g., `RL-20261011-8931`) and status pill | Visual confirmation |
| **📋 Track My Rescues** *(if logged in)* | Opens reporter's personal tracking screen | `/my-rescues` |
| **Report Another** | Clears state and resets form for a new incident | Resets `/report` form |

---

### 10.5 Member Portal & Role Dispatcher (`/dashboard`)
*Component: [`Dashboard.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/Dashboard.jsx)*  
The central workspace for authenticated users, showing role-specific actions and system status.

#### Navigation & Header
| UI Element / Button | Location | Action | Target / Navigation |
|---|---|---|---|
| **RescueLink Paw Logo** | Nav Left | Navigates to landing | `/` |
| **🌐 Public Hub Link** | Nav Right | Returns to public landing feed | `/` |
| **Notification Bell (`🔔`)** | Nav Right | Opens notifications popup with unread badge | Dropdown menu / `/notifications` |
| **Sign Out Button** | Nav Right | Clears auth session | Returns to `/` |

#### Welcome Banner & Primary CTAs
| UI Element / Button | Location | Action | Target / Navigation |
|---|---|---|---|
| **🚨 Report Emergency** | Banner Right | Quick shortcut to incident submission | `/report` |
| **🦺 Rescue Terminal** *(Responder/Admin)* | Banner Right | Direct entry to field operations queue | `/rescuer` |

#### Operational Quick Action Cards
| Card Title | Target | Icon | Purpose |
|---|---|---|---|
| **Report Emergency** | `/report` | 🚨 | File a new rescue case with GPS and photo |
| **My Reported Rescues** | `/my-rescues` | 📋 | Track live progress, assigned rescuer, and timelines |
| **Rescue Team Terminal** *(Responder/Admin)* | `/rescuer` | 🦺 | Open incoming dispatch queue and accept cases |
| **Admin Command Hub** *(Admin only)* | `/admin` | 👑 | Open system KPIs, audits, and user controls |
| **Live Operations Hub** | `/` | 🌐 | Public network statistics and first-aid guide |
| **Notifications** | `/notifications` | 🔔 | Dedicated inbox for all system and case alerts |

---

### 10.6 Citizen Case Tracking (`/my-rescues`)
*Component: [`MyRescues.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/MyRescues.jsx)*  
Allows citizens to monitor all emergencies they have filed in real time.

| UI Element / Button | Location | Action | Target / Result |
|---|---|---|---|
| **← Dashboard** | Nav Right | Jumps back to Member Portal | `/dashboard` |
| **+ Report** | Nav Right | Files an additional incident | `/report` |
| **Notification Bell (`🔔`)** | Nav Right | Opens notification dropdown | In-page dropdown |
| **Sign Out** | Nav Right | Logs user out | `/` |
| **↻ Refresh Button** | Page Header | Refetches `GET /api/rescues/my` | Updates case cards |
| **🚨 Report an Emergency** *(Empty state)* | Center | Jumps to report form when list is empty | `/report` |
| **Animated Progress Timeline** | Each Card | Visual multi-step progress bar (Pending $\to$ Accepted $\to$ In Progress $\to$ Rescued) | Read-only state display |
| **View Full Details →** | Card Footer | Opens comprehensive case view with interactive map and chat | `/rescues/:id` |

---

### 10.7 Responder Operations Terminal (`/rescuer`)
*Component: [`RescuerDashboard.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/RescuerDashboard.jsx)*  
High-intensity operational queue for verified rescuers and ambulances to triage and accept incoming cases.

#### Terminal Navigation & Action Header
| UI Element / Button | Location | Action | Target / Result |
|---|---|---|---|
| **🐾 RescueLink Logo** | Nav Left | Jumps to dashboard | `/dashboard` |
| **Notification Bell (`🔔`)** | Nav Right | Opens notifications | Dropdown menu |
| **Sign Out** | Nav Right | Logs responder out | `/` |
| **📍 Enable Location / Location Active** | Header Right | Captures responder GPS to compute live Haversine distances | Calibrates km distance badges on all cases |
| **↻ Refresh Queue** | Header Right | Refetches `GET /api/rescues` | Refreshes queue |

#### Queue Filter Tabs
| Tab Button | Trigger | Display Filter |
|---|---|---|
| **ALL** | Click | Shows all cases across all statuses |
| **PENDING** | Click | Shows unaccepted emergencies awaiting responder |
| **ACCEPTED** | Click | Shows cases assigned and confirmed by responders |
| **IN_PROGRESS** | Click | Shows rescues currently underway in the field |
| **RESCUED** | Click | Shows successfully completed rescues |
| **CANCELLED** | Click | Shows aborted or invalid cases |

#### Case Card Action Buttons
| Button Label | Shown When Status Is | Action Triggered | Resulting Case Status |
|---|---|---|---|
| **✅ Accept Case** | `PENDING` | `PATCH /api/rescues/:id/status` `{ status: 'ACCEPTED' }` | Assigned to responder $\to$ `ACCEPTED` |
| **✕ Cancel** | `PENDING` or `ACCEPTED` | `PATCH /api/rescues/:id/status` `{ status: 'CANCELLED' }` | Case marked `CANCELLED` |
| **🚀 Start Rescue** | `ACCEPTED` | `PATCH /api/rescues/:id/status` `{ status: 'IN_PROGRESS' }` | Moves to active transit $\to$ `IN_PROGRESS` |
| **🎉 Mark Rescued** | `IN_PROGRESS` | `PATCH /api/rescues/:id/status` `{ status: 'RESCUED' }` | Animal secured $\to$ `RESCUED` |
| **📷 View Photo** | Card Body | Opens uploaded animal image in new tab | Modal/New browser tab |
| **📄 Full Details →** | Card Body | Opens deep case inspection screen with Leaflet Map | `/rescues/:id` |

---

### 10.8 Case Details, Map & Live Timeline (`/rescues/:id`)
*Component: [`CaseDetails.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/CaseDetails.jsx)*  
Full operational dossier for a single case, featuring real-time activity polling (every 12 seconds), interactive Leaflet GPS mapping, responder notes, and citizen feedback.

| UI Element / Button | Location | Role Permissions | Action / Trigger |
|---|---|---|---|
| **← Back** | Nav Left | All Users | Returns to previous screen (`navigate(-1)`) |
| **Dashboard Link** | Nav Right | All Users | Navigates to `/dashboard` |
| **Notification Bell (`🔔`)** | Nav Right | All Users | Opens notifications |
| **Logout** | Nav Right | All Users | Clears auth session $\to$ `/login` |
| **📷 View Photo Link** | Case Info Card | All Users | Opens uploaded evidence photo |
| **Open in Maps ↗** | Map Card | All Users | Opens coordinates in Google Maps external directions |
| **Status Mutation Buttons** (`Accept`, `Start Rescue`, `Mark Rescued`, `Cancel`) | Actions Card | Responder / Admin | Triggers status state transitions |
| **Add Update (`Add Note`) Form** | Updates Card | Assigned Responder / Admin | Submits progress note to case timeline via `POST /api/rescues/:id/updates` |
| **Leave Feedback (Rating + Comment)** | Feedback Card | Citizen Reporter only (when `status == RESCUED`) | Submits 1–5 star rating and comments via `POST /api/rescues/:id/feedback` |
| **Activity Feed Icons** | Timeline Card | All Users | Chronological audit log with timestamps and actor badges |

---

### 10.9 System Command Hub (`/admin`)
*Component: [`AdminDashboard.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/AdminDashboard.jsx)*  
Platform oversight screen for authorized administrators to audit activity logs and system-wide performance.

| UI Element / Button | Location | Action | Target / Result |
|---|---|---|---|
| **🦺 Rescue View** | Nav Right | Switches to responder operational queue | `/rescuer` |
| **Notification Bell (`🔔`)** | Nav Right | Opens notifications | Dropdown menu |
| **Sign Out** | Nav Right | Logs admin out | `/` |
| **← Member Portal** | Banner Right | Returns to member home | `/dashboard` |
| **Total Cases Card** | Analytics Grid | Displays platform total case count | Analytics overview |
| **Pending Cases Card** | Analytics Grid | Highlights cases awaiting response | Identifies bottlenecks |
| **Resolved Rescues Card**| Analytics Grid | Shows completed rescue success rate | Performance tracking |
| **Active Responders Card**| Analytics Grid | Displays field volunteers currently online | Capacity audit |
| **Audit Logs Table** | Page Bottom | Displays timestamped user actions, status changes, and role badges | Forensic auditing |

---

### 10.10 Notifications Inbox (`/notifications`) & Bell Dropdown
*Components: [`Notifications.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/pages/Notifications.jsx) & [`NotificationBell.jsx`](file:///c:/Users/Selvakumar/OneDrive/Documents/Projects/RescueLink/client/src/components/NotificationBell.jsx)*

| UI Element / Button | Location | Action | Downstream Result |
|---|---|---|---|
| **🔔 Bell Icon** | Global Navbar | Toggles floating notification popup; shows badge count | Opens dropdown with 5 latest alerts |
| **View all notifications** | Bell Dropdown Bottom | Navigates to full notifications archive | `/notifications` |
| **Mark all as read** | Notifications Header | Dispatches `PATCH /api/notifications/read-all` | Clears all unread badges across app |
| **↻ Refresh** | Notifications Header | Refetches notifications list | Updates alerts |
| **Notification Item Card** | Dropdown / Inbox | Marks notification as read and navigates to case | Jumps directly to `/rescues/:id` |

---

## 11. Top-to-Bottom User Navigation Flows & State Diagrams

Here is how buttons and pages chain together in the primary real-world execution paths:

### Flow 1: Guest / Citizen Emergency SOS Reporting Flow
```
[Public Landing Page /]
       │
       ▼ Click "🚨 Report Animal in Distress" button
[/report Form Page]
       │
       ├── Fill: Name & Phone Number
       ├── Select: Animal Type (Dog, Cat, etc.) & Emergency Type
       ├── Click: "📍 Use My Current Location" (Browser GPS captured)
       ├── Attach: Animal Photo (file upload)
       │
       ▼ Click "🚨 Report Emergency" submit button
[Success Screen (/report state)]
       │
       ├── Option A: Click "Report Another" ───────► (Resets /report form)
       └── Option B: Click "📋 Track My Rescues" ───► (Navigates to /my-rescues)
```

---

### Flow 2: Responder On-Duty Acceptance & Rescue Verification Flow
```
[Public Landing / or /login]
       │
       ▼ Click "Sign In" / Quick Fill "Responder"
[/rescuer - Rescue Operations Center]
       │
       ├── Click "📍 Enable Location" (Calculates Haversine distance to all incidents)
       ├── Click "PENDING" filter tab
       │
       ▼ Locate nearest critical case & Click "✅ Accept Case"
[Case Status becomes ACCEPTED]
       │
       ▼ Responder heads to location & Clicks "🚀 Start Rescue"
[Case Status becomes IN_PROGRESS]
       │
       ▼ Click "📄 Full Details →" button
[/rescues/:id - Detailed Case Dossier]
       │
       ├── Click "Open in Maps ↗" (Google Maps navigation to rescue scene)
       ├── Type field report in "💬 Add Progress Update" form
       ├── Click "Add Update" button (Saved to public timeline)
       │
       ▼ Animal successfully secured & treated
       ▼ Click "🎉 Mark Rescued" button
[Case Status becomes RESCUED - Terminal state reached]
```

---

### Flow 3: Citizen Real-Time Tracking & Resolution Feedback Flow
```
[/my-rescues - Citizen Dashboard]
       │
       ▼ Case Card shows real-time progress:
         [1: PENDING] ──► [2: ACCEPTED] ──► [3: IN_PROGRESS] ──► [4: RESCUED ✓]
       │
       ▼ Click "View Full Details →"
[/rescues/:id - Case Details View]
       │
       ├── View real-time assigned Responder contact
       ├── View interactive Leaflet location pin
       ├── Read live progress notes added by responder
       │
       ▼ Once status reaches RESCUED:
       ├── Fill 1-5 Star Rating & Experience Comment
       ▼ Click "Submit Feedback" button
[Case dossier permanently updated with citizen verification]
```

---

### Flow 4: Administrator Audit & Network Oversight Flow
```
[/admin - System Command Hub]
       │
       ├── Inspect KPI Stat Cards (Total Cases, Pending Queue, Rescue Rate)
       ├── Review Audit Log table for responder timestamps and role actions
       │
       ├── Option A: Click "🦺 Rescue View" ──► (Jumps to /rescuer queue)
       └── Option B: Click "← Member Portal" ─► (Jumps to /dashboard)
```

---

*Authored for the RescueLink Engineering & Evaluation Team.*

