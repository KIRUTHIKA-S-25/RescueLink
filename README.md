# RescueLink

**Intelligent Animal Rescue Coordination and Case Management System**

A full-stack web application that connects citizens reporting animal emergencies with rescue responders and coordinators — through an end-to-end workflow of reporting, prioritization, matching, tracking, escalation, verification, and analytics.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Leaflet + Recharts
- **Backend:** Node.js + Express + Socket.IO
- **Database:** MongoDB Atlas (Mongoose)
- **Auth:** JWT + bcrypt + RBAC
- **Images:** Cloudinary
- **Deployment:** Render

## Development Setup

See each phase README for setup instructions. Built incrementally over 10 days.

## Key Features

- Explainable rescue priority scoring
- Workload-aware responder matching (Haversine distance)
- Duplicate rescue detection
- Automatic escalation with configurable timeout
- Real-time case status tracking via Socket.IO
- Rescue proof verification workflow
- Complete case lifecycle (10 states)
- Admin analytics dashboard with rescue hotspot map

## Project Structure

```
RescueLink/
├── client/    ← React + Vite frontend
└── server/    ← Node.js + Express backend
```
