# Companion Database Design

Database

MongoDB Atlas

====================================================
COLLECTIONS
====================================================

users

companions

missions

habits

journalEntries

focusSessions

memoryMoments

memoryCapsules

achievements

worlds

inventory

notifications

relationships

settings

analytics

====================================================
USERS
====================================================

Firebase UID

Name

Email

Created At

Updated At

Current World

Current Companion

XP

Coins

Level

====================================================
COMPANIONS
====================================================

Name

Appearance

Hair

Eyes

Skin

Outfit

Accessories

Animations

Relationship Level

Mood

Unlocked Items

====================================================
MISSIONS
====================================================

Title

Description

Priority

Energy

Deadline

Completed

Created At

Completed At

Reward

====================================================
JOURNAL
====================================================

Mood

Reflection

Proud Moment

Tomorrow Goal

AI Summary

====================================================
MEMORY MOMENTS
====================================================

Type

Date

Description

AI Reflection

Importance

Linked Mission

====================================================
MEMORY CAPSULES
====================================================

Title

Message

Unlock Condition

Unlock Date

Opened

Attachments

====================================================
FOCUS SESSIONS
====================================================

Start

End

Duration

Completed

World Used

Music Used

Reward

====================================================
ANALYTICS
====================================================

Daily XP

Weekly XP

Mood Trend

Focus Trend

Mission Completion

Consistency

Burnout Score

====================================================
NOTIFICATIONS
====================================================

Title

Body

Category

Shown

Read

Priority

Scheduled Time

====================================================
SETTINGS
====================================================

Theme

Language

Music

Notifications

Accessibility

Character Settings

====================================================
ARCHITECTURE RULES
====================================================

Never duplicate data.

Reference using IDs.

Timestamp everything.

Soft delete where possible.

Indexes on:

Firebase UID

Mission Deadline

Created At

Relationship Level

====================================================
SCALABILITY
====================================================

Design every schema assuming

10 million users.

Collections should remain modular and easily extendable without major migrations.
====================================================
LONG-TERM MEMORY (IMPLEMENTED)
====================================================

Distinct from Conversation History (temporary), Memory Capsules
(deliberate messages to a future self), and the Journal (reflective
writing). This is meaningful, reusable information Nikki carries
across conversations — stable preferences, goals, habits, planning
preferences, important context, or things the user explicitly asked
to be remembered.

Firebase UID

Type (preference / planning_preference / goal_context / habit /
recurring_pattern / important_context / explicit_remember_request)

Content (the fact itself, plain text)

Source (explicit_request / inferred)

Confidence (0–1) — only confidence >= 0.75 is ever saved; anything
lower is discarded, never stored even as a draft

Status (active / deleted) — a real, stored soft-delete flag, unlike
Capsule's derived status, because deletion here is a permanent user
action rather than something that changes on its own over time

Source Message ID / Source Conversation ID (optional, where the
memory came from)

Last Used At — bumped whenever pulled into a chat's context; a simple
recency-based stand-in for real relevance scoring

Created At / Updated At

Indexes on:

Firebase UID + Status + Last Used At (context retrieval)

Firebase UID + Status + Created At (the Memory settings list)

Known limitation: retrieval is category + recency based, not
semantic/embedding-based yet — acceptable for a first implementation
per the milestone spec, with real relevance-aware retrieval as the
natural next iteration.

====================================================
TASKS (IMPLEMENTED — v1)
====================================================

A concrete action, distinct from a Goal (an aspiration). Deliberately
smaller than the "Missions" concept sketched earlier in this document
(no XP/coins/reward/energy/repeat-schedule fields yet) — this v1
covers the persistence/CRUD/ownership foundation, not the full
gamified vision. Fields can grow later without a schema rewrite.

Firebase UID

Title

Description (optional notes)

Status (PENDING / IN_PROGRESS / COMPLETED)

Due Date (optional — informational only, never flags anything as
"overdue")

Goal ID (optional — a task never requires a Goal; when present, it is
verified server-side to reference a Goal owned by the same user on
every create/update)

Completed At (set when status becomes COMPLETED, cleared otherwise)

Created At / Updated At

Indexes on:

Firebase UID + Created At (the tasks list)

Firebase UID + Goal ID (a future goal detail view listing its tasks)

Unlike Goals, a COMPLETED task can still be deleted — see
services/taskService.ts for why the Goal's delete-protection rule
wasn't carried over.

Reserved next step (not built here): FocusSession.taskId, once Focus
Mode is implemented.