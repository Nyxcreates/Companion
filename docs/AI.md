# Companion AI System

Version: 1.0

====================================================
MISSION
====================================================

The AI is invisible.

The user should notice the Companion.

Not the AI.

AI quietly powers everything.

====================================================
AI RESPONSIBILITIES
====================================================

Planning

Scheduling

Learning

Journal Summaries

Memory

Burnout Detection

Goal Tracking

Habit Analysis

Task Breakdown

Emotional Support

====================================================
PLANNING
====================================================

The user provides:

Goals

Deadlines

Working Hours

College

Events

The AI creates realistic plans.

Leave breaks.

Never overbook.

====================================================
ENERGY MODEL
====================================================

Tasks have:

Mental Energy

Creative Energy

Physical Energy

Recovery Energy

The AI learns:

Morning productivity

Night productivity

Creative hours

Low-energy hours

====================================================
MEMORY SYSTEM
====================================================

AI remembers:

Dreams

Goals

Achievements

Favorite Activities

Mood Trends

Focus Sessions

Learning Progress

Recovery Days

====================================================
EMOTIONAL MODEL
====================================================

Daily mood

Weekly mood

Stress

Burnout

Consistency

Motivation

====================================================
AI DIALOGUE
====================================================

Dialogue should be:

Short

Warm

Friendly

Supportive

Never robotic.

Never preachy.

Never guilt users.

====================================================
RECOVERY MODE
====================================================

When burnout detected:

Reduce workload.

Suggest one task.

Suggest hobbies.

Suggest sleep.

Suggest walks.

Suggest music.

====================================================
AI LEARNING
====================================================

The AI improves every week.

Learns:

Focus Time

Task Duration

Break Pattern

Exercise Pattern

Mood Triggers

Best Study Time

Favorite Worlds

Favorite Music

====================================================
MEMORY GARDEN
====================================================

AI creates:

Reflections

Anniversaries

Milestones

Memory Moments

Memory Capsules

====================================================
LONG TERM GOAL
====================================================

Eventually,

users should feel

"My Companion understands me better every month."

====================================================
LONG-TERM MEMORY (IMPLEMENTED)
====================================================

Extends the existing single Gemini call — no separate AI request.
Alongside her reply, Nikki now also proposes memoryCandidates
(type/content/confidence/reason, plus an optional supersedesId when a
candidate updates an existing memory rather than duplicating it).

Only high-confidence candidates (>= 0.75) are ever saved automatically
— an explicit "remember this" request from the user is the clearest
case. Medium-confidence candidates are discarded, not silently kept as
permanent memory. Low-confidence/speculative candidates are never
proposed at all. Nikki is explicitly told not to infer sensitive
personal attributes from speculation.

Retrieval: a bounded, category + recency-based set of the user's
active memories (never the whole store) is loaded into Nikki's system
context every turn. This keeps token usage predictable and is an
honest placeholder for real semantic/relevance-aware retrieval later.

Memory extraction and persistence are best-effort: a failure here
never prevents Nikki from replying normally (mirrors how emotion
persistence already worked).

Still NOT implemented: user confirmation flow for medium-confidence
candidates, semantic/embedding-based retrieval, automatic timetable
generation, burnout detection.