# RescueLink — Client-Side Architecture & Codebase Reference (`client.md`)

RescueLink's frontend is a modern, high-performance Single Page Application (SPA) built using **React 19**, **Vite 8**, **Tailwind CSS v3**, **React Router v7**, and **Leaflet / React-Leaflet**. It is designed with glassmorphism visual styling, role-based interfaces (Citizen, Responder, Administrator), real-time updates, interactive map tracking, and an integrated AI assistant.

---

## 1. Directory Tree Overview

```
client/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── images/
│       ├── form-bg-animals.jpg
│       ├── hero-rescue-dog.jpg
│       ├── rescue-coordination-hero.jpg
│       ├── rescuer-banner.jpg
│       └── sunset-sanctuary-friends.jpg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── components/
│   │   ├── AdminIncidentMap.jsx
│   │   ├── AuthModal.jsx
│   │   ├── ChatWidget.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── LocationPickerMap.jsx
│   │   ├── NotificationBell.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── RescueLinkLogo.jsx
│   │   ├── RescueMap.jsx
│   │   └── RoleRoute.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── AdminDashboard.jsx
│   │   ├── CaseDetails.jsx
│   │   ├── Dashboard.jsx
│   │   ├── HomeDashboard.jsx
│   │   ├── Login.jsx
│   │   ├── MyRescues.jsx
│   │   ├── NotFound.jsx
│   │   ├── Notifications.jsx
│   │   ├── Register.jsx
│   │   ├── ReportRescue.jsx
│   │   └── RescuerDashboard.jsx
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   │   ├── haversine.js
│   │   └── useParallax.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env
├── .env.example
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## 2. Root-Level Configuration & Build Files

| File | Purpose | What It Contains & Does in the Project |
| :--- | :--- | :--- |
| **`index.html`** | HTML entry point | Declares the HTML5 shell, page metadata, viewport configuration, Google Fonts preconnect (`Inter`), and loads the React entry point (`/src/main.jsx`). |
| **`package.json`** | Dependencies & scripts | Defines scripts (`dev`, `build`, `preview`, `lint`), client dependencies (`react`, `react-dom`, `react-router-dom`, `axios`, `leaflet`, `react-leaflet`), and dev tooling (`vite`, `tailwindcss`, `postcss`, `autoprefixer`, `oxlint`). |
| **`vite.config.js`** | Vite bundler config | Configures the `@vitejs/plugin-react` plugin, local development server port (`5173`), and builds optimization flags. |
| **`tailwind.config.js`** | Styling design tokens | Sets content paths (`./index.html`, `./src/**/*.{js,ts,jsx,tsx}`) and extends theme tokens (colors, box-shadows, animations, border radius, frosted glass effects). |
| **`postcss.config.js`** | PostCSS pipeline | Loads Tailwind CSS and Autoprefixer plugins for cross-browser CSS generation. |
| **`.oxlintrc.json`** | Code quality linter | Configuration for Oxlint to maintain high code standards and catch JavaScript/JSX syntax bugs. |
| **`.env` / `.env.example`** | Frontend environment variables | Configures `VITE_API_URL` (points to `http://localhost:5000/api` for backend communication). |

---

## 3. `public/` Folder

### Purpose
Contains static assets directly served by Vite without bundling or compilation. These assets are referenced via root-relative URLs (`/images/...`).

### Files in `public/` & `public/images/`:
1. **`public/favicon.svg`**:
   - Modern SVG favicon displaying the RescueLink paw emblem with emerald emergency cross.
2. **`public/icons.svg`**:
   - Vector icon definitions used throughout the interface.
3. **`public/images/sunset-sanctuary-friends.jpg`**:
   - High-resolution hero background image showing rescued animals at sunset. Used as the main backdrop in `HomeDashboard.jsx`.
4. **`public/images/hero-rescue-dog.jpg`**:
   - Showcase photography of an injured dog under care, emphasizing compassion and rapid rescue response.
5. **`public/images/rescue-coordination-hero.jpg`**:
   - Field operations imagery highlighting emergency animal dispatchers and responders on duty.
6. **`public/images/rescuer-banner.jpg`**:
   - Banner image for the responder dashboard showing veterinary ambulances and medical equipment.
7. **`public/images/form-bg-animals.jpg`**:
   - Subtle background imagery utilized in the incident report modal and submission cards.

---

## 4. `src/` Root Files

| File | Purpose | What It Contains & Does in the Project |
| :--- | :--- | :--- |
| **`main.jsx`** | Application bootstrap | Mounts the root React DOM (`createRoot(document.getElementById('root'))`) and loads global styling from `index.css`. |
| **`App.jsx`** | Primary routing hub | Defines all client routes wrapped inside `<ErrorBoundary>`, `<BrowserRouter>`, and `<AuthProvider>`. Coordinates public routes (`/`, `/login`, `/register`, `/report`), protected user routes (`/dashboard`, `/my-rescues`, `/notifications`, `/rescues/:id`), role-restricted routes (`/rescuer`, `/admin`), and mounts the persistent `<ChatWidget />`. |
| **`index.css`** | Global stylesheet & design system | Contains Tailwind directives (`@tailwind base; components; utilities;`), custom keyframe animations (`pulse-glow`, `shimmer`, `float`), scrollbar stylings, glassmorphism utilities (`backdrop-blur`, translucent glass panels), and Leaflet map overrides. |

---

## 5. `src/context/` Folder

### Purpose
Houses React Context providers for global, application-wide state management.

### Files:
1. **`AuthContext.jsx`**:
   - **Purpose**: Manages global authentication, logged-in user profile, JWT token lifecycle, and role verification.
   - **What it Contains**:
     - `AuthContext` and custom hook `useAuth()`.
     - State variables: `user`, `token`, `loading`, `error`.
     - Functions: `login(email, password)`, `register(formData)`, `logout()`, `updateUserProfile(newData)`.
     - Automatically verifies and loads the user profile on page refresh via `GET /api/auth/me` using the persisted token from `localStorage`.

---

## 6. `src/services/` Folder

### Purpose
Contains centralized API communication clients and HTTP request wrappers.

### Files:
1. **`api.js`**:
   - **Purpose**: Single Axios instance configured for all backend communications.
   - **What it Contains**:
     - Configured base URL (`import.meta.env.VITE_API_URL || 'http://localhost:5000/api'`).
     - **Request Interceptor**: Automatically attaches `Authorization: Bearer <token>` from `localStorage` to every outgoing request.
     - **Response Interceptor**: Automatically handles network failures and unauthorized errors (`401`), purging stale tokens and redirecting to login when appropriate.

---

## 7. `src/components/` Folder

### Purpose
Contains reusable UI elements, modals, layout guards, navigation components, and map renderers.

### Files:
1. **`AdminIncidentMap.jsx`**:
   - **Purpose**: Interactive Leaflet geospatial map for administrators.
   - **What it Does**: Renders clusters of reported incidents across regional coordinates. Color-codes pins based on urgency (`CRITICAL` = Red, `HIGH` = Orange, `MEDIUM` = Yellow, `LOW` = Green). Clicking a pin reveals animal species, status, reporter contact, and quick navigation.
2. **`AuthModal.jsx`**:
   - **Purpose**: Unified pop-up authentication dialog allowing instant login or registration without navigating away from the active page.
   - **What it Does**: Supports tab switching between "Sign In" and "Create Account", role selection (Citizen vs Responder), vehicle details inputs for rescuers, error messaging, and password visibility toggles.
3. **`ChatWidget.jsx`**:
   - **Purpose**: Floating, expandable AI Assistant accessible on all pages.
   - **What it Does**: Connects to the backend `/api/chat` route. Supports natural conversation for first-aid instructions, case ID status lookups, emergency keyword triggers with red alert banners, and interactive navigation buttons (e.g., *"View Case & History Details"*).
4. **`ErrorBoundary.jsx`**:
   - **Purpose**: React class component acting as a safety boundary around the application tree.
   - **What it Does**: Catches unhandled runtime JavaScript rendering errors, logs them to the console, and presents a user-friendly recovery screen with a "Refresh Page" button instead of crashing into a blank screen.
5. **`LocationPickerMap.jsx`**:
   - **Purpose**: Interactive map pin selector for incident reporting.
   - **What it Does**: Allows citizens to click anywhere on an OpenStreetMap tile or click *"Use Current GPS Location"* to populate accurate latitude and longitude coordinates.
6. **`NotificationBell.jsx`**:
   - **Purpose**: Header navigation bell showing real-time dispatch alerts and unread counts.
   - **What it Does**: Polls `/api/notifications`, displays a badge counter for unread notifications, renders a drop-down panel with quick previews, and provides a *"Mark all as read"* action.
7. **`ProtectedRoute.jsx`**:
   - **Purpose**: Navigation guard for authenticated citizen views.
   - **What it Does**: Checks if `user` exists in `AuthContext`. If unauthenticated, saves the attempted path and redirects to `/login`.
8. **`RescueLinkLogo.jsx`**:
   - **Purpose**: Brand visual asset component.
   - **What it Does**: Renders an SVG icon featuring an animal silhouette, emergency heartbeat line, and gradient RescueLink typography.
9. **`RescueMap.jsx`**:
   - **Purpose**: Single-case location visualizer.
   - **What it Does**: Displays an OpenStreetMap circle and pin for a specific animal distress case, showing exact incident coordinates, address, and dispatch radius.
10. **`RoleRoute.jsx`**:
    - **Purpose**: Strict Role-Based Access Control (RBAC) route wrapper.
    - **What it Does**: Takes an array of `allowedRoles` (e.g. `['responder', 'admin']`). If the current user lacks the required role, redirects to `/dashboard` or shows an access denied notice.

---

## 8. `src/pages/` Folder

### Purpose
Contains top-level route views and dashboard screens.

### Files:
1. **`HomeDashboard.jsx`**:
   - **Purpose**: The flagship landing and public operations dashboard.
   - **What it Does**:
     - Frosted glass navigation bar with emergency hotline (`1962`) and quick links.
     - Immersive hero section backed by `sunset-sanctuary-friends.jpg`.
     - Prominent **Citizen Emergency Guide** ("What to Do While Help Is En Route") with species-specific triage protocols (Dogs, Cats, Cattle, Birds, Wildlife) and visible `⚡ High Alert` severity badges.
     - Live platform impact counters (rescuers on-duty, average dispatch speed, rehabilitation rate).
     - Interactive step-by-step triage guide and direct SOS action buttons.
2. **`ReportRescue.jsx`**:
   - **Purpose**: Emergency incident submission form.
   - **What it Does**:
     - Captures animal species, condition, injuries, mobility status, aggression risk, and trapped indicators.
     - Calculates Triage Urgency Score (TUS) in real-time.
     - Uses `LocationPickerMap` to pin GPS coordinates.
     - Supports uploading evidence photos (processed by Cloudinary or local uploads).
     - Creates case via `POST /api/rescues` and redirects to the live tracking view.
3. **`Dashboard.jsx`**:
   - **Purpose**: General citizen portal.
   - **What it Does**: Shows quick stats of reports filed by the citizen, recent rescue updates, pending approvals, and links to file new incidents or explore first-aid guides.
4. **`MyRescues.jsx`**:
   - **Purpose**: Personal rescue case tracking list for citizens.
   - **What it Does**: Lists all cases submitted by the logged-in user with status badges (`PENDING`, `ACCEPTED`, `IN_PROGRESS`, `RESCUED`, `CANCELLED`), timestamps, animal photos, and buttons to open full case details.
5. **`CaseDetails.jsx`**:
   - **Purpose**: Deep-dive tracking and chronological timeline view for an individual case.
   - **What it Does**:
     - Accepts both MongoDB ObjectID and human-readable ID (`RC-...`).
     - Renders incident status bar, responder assignment card, animal condition details, and interactive map.
     - Displays chronological milestones from `RescueActivity` (report filed, accepted, transit started, medical notes, resolution).
     - Renders 5-star rating and feedback form once the case reaches `RESCUED` status.
6. **`RescuerDashboard.jsx`**:
   - **Purpose**: Field responder dispatch command center.
   - **What it Does**:
     - Displays incoming unassigned incident pool sorted by proximity and urgency.
     - **Accept Case Button**: Atomically claims an incident while checking responder capacity limit (maximum 3 concurrent cases).
     - **Start Transit Button**: Moves case to `IN_PROGRESS` and notifies the citizen.
     - **Add Progress Note Button**: Appends live field updates and medical observations.
     - **Mark Rescued Button**: Concludes mission, logs veterinary clinic handover, and uploads proof images.
     - Displays personal metrics: completed count, active workload meter, and on-duty toggle.
7. **`AdminDashboard.jsx`**:
   - **Purpose**: System-wide administrative oversight and analytics center.
   - **What it Does**:
     - Summary KPI cards: Total Cases, Pending Incidents, Active In-Progress, Rescued Total, Success Rate %, Average Response Time.
     - Visual charts: Status Distribution, Urgency Breakdown, Monthly Incident Trends.
     - Rescuer Roster & Performance Directory: Monitored workloads, completed counts, verification statuses.
     - Security & Audit Log: Live chronological table of system security events.
     - **Export CSV Button**: Triggers immediate download of all rescue data as CSV.
     - **Export PDF Button**: Triggers generation and download of formatted PDF reports.
8. **`Notifications.jsx`**:
   - **Purpose**: Dedicated notification inbox.
   - **What it Does**: Paginated list of all system dispatch alerts, case status changes, and escalation notices with filters for read/unread and quick navigation to cases.
9. **`Login.jsx` & `Register.jsx`**:
   - **Purpose**: Dedicated standalone authentication screens.
   - **What it Does**: Form handling, validation, error display, role selection, and seamless redirection upon successful authentication.
10. **`NotFound.jsx`**:
    - **Purpose**: Graceful 404 error page.
    - **What it Does**: Renders a friendly illustration with a *"Return to Home"* button for invalid or broken URLs.

---

## 9. `src/utils/` Folder

### Purpose
Reusable client-side utility functions and custom React hooks.

### Files:
1. **`haversine.js`**:
   - **Purpose**: Great-circle distance calculation.
   - **What it Does**: Computes distance in kilometers between two GPS coordinates `(lat1, lon1)` and `(lat2, lon2)` using the Haversine trigonometric formula. Used to display distance from rescuer to incident.
2. **`useParallax.js`**:
   - **Purpose**: Custom React hook for subtle 3D tilt and scroll parallax effects.
   - **What it Does**: Listens to mouse position and window scroll events to apply smooth transforms on hero imagery and cards without impacting performance.

---

## 10. `src/assets/` Folder

### Purpose
Local bundled graphic assets.
- **`hero.png`**: Transparent graphic element of companion animals.
- **`react.svg` & `vite.svg`**: Framework vector marks.
