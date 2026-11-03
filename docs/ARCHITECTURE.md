# Companion Architecture

Version: 1.0

====================================================
TECH STACK
====================================================

Frontend

Next.js 15

React

TypeScript

Tailwind CSS

Framer Motion

Firebase Authentication

Backend

Node.js

Next.js API Routes

MongoDB Atlas

Mongoose

Future

Live2D Cubism

OpenAI

Gemini

Firebase Cloud Messaging

PWA

====================================================
FOLDER STRUCTURE
====================================================

src/

app/

components/

hooks/

lib/

services/

contexts/

store/

animations/

types/

utils/

styles/

public/

docs/

====================================================
COMPONENTS
====================================================

Character

MissionCard

MissionBoard

FocusTimer

JournalCard

MemoryGarden

MemoryCapsule

WorldSelector

MoodCheck

XPBar

Navbar

Sidebar

Notification

====================================================
STATE MANAGEMENT
====================================================

React Context

For:

Authentication

Character

Theme

Notifications

User

Later:

Zustand

or

Redux Toolkit

if required.

====================================================
API ROUTES
====================================================

/api/auth

/api/missions

/api/character

/api/journal

/api/focus

/api/memory

/api/worlds

/api/notifications

/api/analytics

====================================================
DATABASE FLOW
====================================================

Firebase

↓

Authentication

↓

MongoDB

↓

Application Data

====================================================
ANIMATION FLOW
====================================================

Animation Components

↓

Framer Motion

↓

Live2D

↓

Interaction

====================================================
DESIGN RULES
====================================================

Never hardcode values.

Never duplicate logic.

Always create reusable components.

Always use TypeScript.

Always separate UI from business logic.

====================================================
PERFORMANCE
====================================================

Lazy Loading

Dynamic Imports

Memoization

Image Optimization

Database Indexes

Caching

60 FPS animations

====================================================
SCALABILITY
====================================================

Every feature should be modular.

Every feature should be replaceable.

Nothing should depend on one large component.

Small reusable systems.

====================================================
FINAL RULE
====================================================

Code should be readable.

Future developers should understand it in minutes.